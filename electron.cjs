/**
 * AliasGUI - Electron 主进程
 */

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { createServer } = require('http')
const fs = require('fs')
const os = require('os')

// 配置路径
let CONFIG_PATH = ''

function getConfigPath() {
  const home = process.env.HOME || process.env.USERPROFILE
  if (process.platform === 'win32') {
    // 优先使用 PowerShell 的 $PROFILE 环境变量（在运行时设置）
    // 如果没有，则使用默认路径
    if (process.env.PROFILE) {
      return process.env.PROFILE
    }
    const psCorePath = path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
    const psLegacyPath = path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
    // 优先检查 PowerShell Core
    if (fs.existsSync(psCorePath)) return psCorePath
    return psLegacyPath
  } else {
    const shell = process.env.SHELL || '/bin/bash'
    return shell.includes('zsh') ? path.join(home, '.zshrc') : path.join(home, '.bashrc')
  }
}

// ===== 内联解析器 (避免 ES 模块导入问题) =====

function parseUnixAliases(content) {
  const aliases = []
  const lines = content.split('\n')
  
  const aliasRegex = /^\s*alias\s+(\w+)=['"](.*)['"]\s*$/
  const functionRegex = /^\s*(?:function\s+)?(\w+)\s*\(\)\s*\{\s*(.*?)\s*;?\s*\}/
  const functionStartRegex = /^\s*(?:function\s+)?(\w+)\s*\(\)\s*\{\s*$/
  
  let currentFunction = null
  let functionBody = []
  
  lines.forEach((line, index) => {
    if (line.trim().startsWith('#')) return
    
    const aliasMatch = line.match(aliasRegex)
    if (aliasMatch) {
      aliases.push({
        id: Date.now() + index,
        name: aliasMatch[1],
        command: aliasMatch[2],
        hasParams: false,
        lineNumber: index + 1
      })
      return
    }
    
    const funcMatch = line.match(functionRegex)
    if (funcMatch) {
      aliases.push({
        id: Date.now() + index,
        name: funcMatch[1],
        command: funcMatch[2].replace(/\$@/g, '...').trim(),
        hasParams: true,
        lineNumber: index + 1
      })
      return
    }
    
    const funcStartMatch = line.match(functionStartRegex)
    if (funcStartMatch) {
      currentFunction = { name: funcStartMatch[1], lineNumber: index + 1 }
      functionBody = []
      return
    }
    
    if (currentFunction) {
      if (line.trim() === '}') {
        aliases.push({
          id: Date.now() + index,
          name: currentFunction.name,
          command: functionBody.join('; ').replace(/\$@/g, '...').trim(),
          hasParams: true,
          lineNumber: currentFunction.lineNumber
        })
        currentFunction = null
        functionBody = []
      } else if (line.trim()) {
        functionBody.push(line.trim().replace(/;$/, ''))
      }
    }
  })
  
  return aliases
}

function parsePowerShellAliases(content) {
  const aliases = []
  const lines = content.split('\n')
  
  const setAliasRegex = /^\s*Set-Alias\s+(?:-Name\s+)?(\w+)\s+(?:-Value\s+)?["']?([^"'\n]+)["']?\s*$/i
  const newAliasRegex = /^\s*New-Alias\s+(?:-Name\s+)?(\w+)\s+(?:-Value\s+)?["']?([^"'\n]+)["']?\s*$/i
  const functionRegex = /^\s*function\s+(\w+)\s*\{\s*(.+?)\s*\}\s*$/i
  const functionStartRegex = /^\s*function\s+(\w+)\s*\{\s*$/i
  
  let currentFunction = null
  let functionBody = []
  
  lines.forEach((line, index) => {
    if (line.trim().startsWith('#')) return
    
    let aliasMatch = line.match(setAliasRegex) || line.match(newAliasRegex)
    if (aliasMatch) {
      aliases.push({
        id: Date.now() + index,
        name: aliasMatch[1],
        command: aliasMatch[2].trim(),
        hasParams: false,
        lineNumber: index + 1
      })
      return
    }
    
    const funcMatch = line.match(functionRegex)
    if (funcMatch) {
      aliases.push({
        id: Date.now() + index,
        name: funcMatch[1],
        command: funcMatch[2].replace(/\$args/gi, '...').trim(),
        hasParams: true,
        lineNumber: index + 1
      })
      return
    }
    
    const funcStartMatch = line.match(functionStartRegex)
    if (funcStartMatch) {
      currentFunction = { name: funcStartMatch[1], lineNumber: index + 1 }
      functionBody = []
      return
    }
    
    if (currentFunction) {
      if (line.trim() === '}') {
        aliases.push({
          id: Date.now() + index,
          name: currentFunction.name,
          command: functionBody.join('; ').replace(/\$args/gi, '...').trim(),
          hasParams: true,
          lineNumber: currentFunction.lineNumber
        })
        currentFunction = null
        functionBody = []
      } else if (line.trim()) {
        functionBody.push(line.trim())
      }
    }
  })
  
  return aliases
}

function parseAliases(content) {
  return process.platform === 'win32' ? parsePowerShellAliases(content) : parseUnixAliases(content)
}

function generateConfig(aliases) {
  if (process.platform === 'win32') {
    // Windows PowerShell: 统一使用 function（Set-Alias 不支持带参数的命令）
    return aliases.map(alias => {
      const cmd = alias.command.replace(/\.\.\./g, '')
      // 使用 @args 展开参数，确保参数正确传递
      return `function ${alias.name} { ${cmd} @args }`
    }).join('\n')
  } else {
    return aliases.map(alias => {
      if (alias.hasParams) {
        const cmd = alias.command.replace(/\.\.\./g, '$@')
        return `${alias.name}() { ${cmd} "$@"; }`
      } else {
        return `alias ${alias.name}='${alias.command}'`
      }
    }).join('\n')
  }
}

// 别名区块标记
const ALIAS_BLOCK_START = '# === AliasGUI Managed Aliases START ==='
const ALIAS_BLOCK_END = '# === AliasGUI Managed Aliases END ==='

function readConfig(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    console.error('读取配置文件失败:', err)
    return ''
  }
}

function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const backupPath = path.join(dir, `${base}.backup.${timestamp}`)
  try {
    fs.copyFileSync(filePath, backupPath)
    
    // 清理旧备份，只保留最近 10 个
    const backupDir = path.dirname(filePath)
    const baseName = path.basename(filePath)
    const backupPattern = `${baseName}.backup.`
    
    try {
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(backupPattern))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
        .sort((a, b) => b.time - a.time)
      
      // 删除超出 10 个的旧备份
      const MAX_BACKUPS = 10
      if (files.length > MAX_BACKUPS) {
        files.slice(MAX_BACKUPS).forEach(f => {
          fs.unlinkSync(path.join(backupDir, f.name))
          console.log(`清理旧备份: ${f.name}`)
        })
      }
    } catch (err) {
      console.error('清理旧备份失败:', err)
    }
    
    return backupPath
  } catch (err) {
    console.error('创建备份失败:', err)
    return null
  }
}


/**
 * 移除配置文件中的散落别名（标记区块外的 alias 和 function 定义）
 * @param {string} content - 原始文件内容
 * @returns {string} 清理后的内容
 */
function removeScatteredAliases(content) {
  const lines = content.split('\n')
  const filteredLines = []
  let skipUntilCloseBrace = false
  let braceDepth = 0
  
  for (const line of lines) {
    // 跳过多行函数体
    if (skipUntilCloseBrace) {
      if (line.includes('{')) braceDepth++
      if (line.includes('}')) braceDepth--
      if (braceDepth <= 0 && line.trim().endsWith('}')) {
        skipUntilCloseBrace = false
        braceDepth = 0
      }
      continue
    }
    
    // 检查是否是 alias 定义
    if (/^\s*alias\s+\w+=['"]/.test(line)) {
      continue
    }
    
    // 检查是否是单行函数 name() { command; }
    if (/^\s*(?:function\s+)?\w+\s*\(\)\s*\{.*\}\s*$/.test(line)) {
      continue
    }
    
    // 检查是否是多行函数开头 name() {
    if (/^\s*(?:function\s+)?\w+\s*\(\)\s*\{\s*$/.test(line)) {
      skipUntilCloseBrace = true
      braceDepth = 1
      continue
    }
    
    filteredLines.push(line)
  }
  
  return filteredLines.join('\n')
}

/**
 * 安全写入配置：只更新 AliasGUI 管理的区块，保留其他内容
 */
function writeConfigSafely(filePath, newAliasContent) {
  let originalContent = ''
  try {
    originalContent = fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    // 文件不存在，创建新文件
    originalContent = ''
  }
  
  const startIdx = originalContent.indexOf(ALIAS_BLOCK_START)
  const endIdx = originalContent.indexOf(ALIAS_BLOCK_END)
  
  let newContent
  const aliasBlock = `${ALIAS_BLOCK_START}\n${newAliasContent}\n${ALIAS_BLOCK_END}`
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // 已有标记区块，只替换标记区块内容
    newContent = originalContent.substring(0, startIdx) + aliasBlock + originalContent.substring(endIdx + ALIAS_BLOCK_END.length)
  } else {
    // 没有标记区块（首次保存）
    // 1. 先移除文件中散落的别名定义，避免重复
    const cleanedContent = removeScatteredAliases(originalContent)
    // 2. 追加标记区块到末尾
    newContent = cleanedContent.trimEnd() + '\n\n' + aliasBlock + '\n'
  }
  
  // 确保目录存在（Windows 上 PowerShell 配置目录可能不存在）
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`创建配置目录: ${dir}`)
  }
  
  fs.writeFileSync(filePath, newContent, 'utf-8')
}


// ===== API 服务器 =====
let server = null
const PORT = 3001

function startServer() {
  // 开发模式使用 Vite 代理
  if (process.env.NODE_ENV === 'development') {
    console.log('开发模式：使用 Vite 代理，跳过内嵌服务器')
    return
  }
  
  server = createServer((req, res) => {
    const { method, url } = req
    
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    
    if (method === 'GET' && url === '/api/aliases') {
      try {
        const content = readConfig(CONFIG_PATH)
        const aliases = parseAliases(content)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(aliases))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }
    
    if (method === 'POST' && url === '/api/aliases') {
      let body = ''
      const MAX_BODY_SIZE = 1024 * 100  // 100KB 限制
      
      req.on('data', chunk => {
        body += chunk
        // 防止过大请求
        if (body.length > MAX_BODY_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '请求体过大' }))
          req.destroy()
        }
      })
      req.on('end', () => {
        try {
          const aliases = JSON.parse(body)
          
          // 输入验证
          if (!Array.isArray(aliases)) {
            throw new Error('数据格式错误：必须是数组')
          }
          
          for (const alias of aliases) {
            // 验证别名名称：只允许字母、数字、下划线和连字符
            if (!alias.name || !/^[\w-]+$/.test(alias.name)) {
              throw new Error(`无效的别名名称: ${alias.name}`)
            }
            // 验证命令：不能为空
            if (!alias.command || typeof alias.command !== 'string') {
              throw new Error(`无效的命令: ${alias.name}`)
            }
            // 检测危险命令模式
            const dangerousPatterns = [
              /;\s*rm\s+-rf\s+[\/~]/i,
              /;\s*sudo\s+/i,
              /\$\(.*\)/,  // 命令替换
              /`.*`/,      // 反引号命令替换
            ]
            for (const pattern of dangerousPatterns) {
              if (pattern.test(alias.command)) {
                console.warn(`警告：检测到潜在危险命令: ${alias.name}`)
              }
            }
          }
          
          // 不再自动备份，改为手动备份
          const newAliasContent = generateConfig(aliases)
          writeConfigSafely(CONFIG_PATH, newAliasContent)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // 获取备份列表
    if (method === 'GET' && url === '/api/backups') {
      try {
        const dir = path.dirname(CONFIG_PATH)
        const base = path.basename(CONFIG_PATH)
        const files = fs.readdirSync(dir)
          .filter(f => f.startsWith(`${base}.backup`))
          .map(f => {
            const stat = fs.statSync(path.join(dir, f))
            return {
              name: f,
              path: path.join(dir, f),
              time: stat.mtime.toISOString(),
              size: stat.size
            }
          })
          .sort((a, b) => new Date(b.time) - new Date(a.time))
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(files))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }
    
    // 手动创建备份
    if (method === 'POST' && url === '/api/backup') {
      try {
        const backupPath = createBackup(CONFIG_PATH)
        if (backupPath) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, backupPath }))
        } else {
          throw new Error('备份创建失败')
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }
    
    // 恢复备份
    if (method === 'POST' && url === '/api/restore') {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => {
        try {
          const { backupPath } = JSON.parse(body)
          
          // 安全检查：确保是有效的备份文件路径（使用 normalize 进行跨平台比较）
          const dir = path.dirname(CONFIG_PATH)
          const base = path.basename(CONFIG_PATH)
          const backupName = path.basename(backupPath)
          
          if (!backupName.startsWith(`${base}.backup`) || 
              path.normalize(path.dirname(backupPath)) !== path.normalize(dir)) {
            throw new Error('无效的备份文件路径')
          }
          
          if (!fs.existsSync(backupPath)) {
            throw new Error('备份文件不存在')
          }
          
          // 先备份当前配置
          createBackup(CONFIG_PATH)
          
          // 恢复备份
          fs.copyFileSync(backupPath, CONFIG_PATH)
          
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, message: '已恢复备份' }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }
    
    // 删除备份
    if (method === 'DELETE' && url.startsWith('/api/backup?')) {
      try {
        const urlParams = new URLSearchParams(url.split('?')[1])
        const backupPath = urlParams.get('path')
        
        if (!backupPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '缺少备份路径参数' }))
          return
        }
        
        const dir = path.dirname(CONFIG_PATH)
        const base = path.basename(CONFIG_PATH)
        const backupName = path.basename(backupPath)
        
        // 安全检查
        if (!backupName.startsWith(`${base}.backup`) || 
            path.normalize(path.dirname(backupPath)) !== path.normalize(dir)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '无效的备份文件路径' }))
          return
        }
        
        if (!fs.existsSync(backupPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '备份文件不存在' }))
          return
        }
        
        // 删除备份文件
        fs.unlinkSync(backupPath)
        console.log(`🗑️ 已删除备份: ${backupPath}`)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, message: '已删除备份' }))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }
    
    if (method === 'GET' && url === '/api/info') {

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        configPath: CONFIG_PATH,
        platform: process.platform,
        shell: process.env.SHELL || 'powershell'
      }))
      return
    }
    
    // 检测 Windows 执行策略
    if (method === 'GET' && url === '/api/execution-policy') {
      if (process.platform !== 'win32') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ policy: 'not-applicable', needsSetup: false }))
        return
      }
      
      const { exec } = require('child_process')
      exec('powershell -Command "Get-ExecutionPolicy"', (error, stdout, stderr) => {
        if (error) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ policy: 'unknown', needsSetup: true, error: error.message }))
          return
        }
        const policy = stdout.trim()
        const needsSetup = policy === 'Restricted' || policy === 'AllSigned'
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ policy, needsSetup }))
      })
      return
    }
    
    // 设置 Windows 执行策略
    if (method === 'POST' && url === '/api/set-execution-policy') {
      if (process.platform !== 'win32') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: '仅支持 Windows 平台' }))
        return
      }
      
      const { exec } = require('child_process')
      exec('powershell -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force"', (error, stdout, stderr) => {
        if (error) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: stderr || error.message }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      })
      return
    }
    
    res.writeHead(404)
    res.end('Not Found')
  })
  
  server.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`)
  })
}

// ===== 创建窗口 =====
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FDFBF7'
  })
  
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools()
  } else {
    // 生产模式下加载打包的前端，并代理 API 请求
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
  
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ===== 应用启动 =====

// 单实例模式：确保只有一个应用实例运行
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 已有实例在运行，退出当前实例
  app.quit()
} else {
  // 当尝试打开第二个实例时，激活已有窗口
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    CONFIG_PATH = getConfigPath()
    console.log(`配置文件: ${CONFIG_PATH}`)
    
    startServer()
    createWindow()
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('before-quit', () => {
    if (server) server.close()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
