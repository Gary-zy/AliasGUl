/**
 * AliasGUI 后端服务
 * 极简 Node.js API 服务器
 */

import { createServer } from 'http'
import { readdirSync, statSync, copyFileSync, existsSync } from 'fs'
import { dirname, basename, join, normalize } from 'path'
import { parseAliases, generateConfig, getDefaultConfigPath } from './parser.js'
import { readConfig, writeConfig, createBackup } from './fileService.js'

const PORT = 3001
const CONFIG_PATH = process.env.ALIAS_CONFIG_PATH || getDefaultConfigPath()

console.log(`📁 配置文件路径: ${CONFIG_PATH}`)

/**
 * 解析请求体
 */
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        resolve(null)
      }
    })
  })
}

/**
 * 发送 JSON 响应
 */
function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(JSON.stringify(data))
}

/**
 * 请求处理器
 */
async function handleRequest(req, res) {
  const { method, url } = req
  
  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end()
    return
  }
  
  // 获取别名列表
  if (method === 'GET' && url === '/api/aliases') {
    try {
      const content = readConfig(CONFIG_PATH)
      const aliases = parseAliases(content)
      sendJson(res, aliases)
    } catch (err) {
      sendJson(res, { error: err.message }, 500)
    }
    return
  }
  
  // 保存别名（不再自动备份）
  if (method === 'POST' && url === '/api/aliases') {
    try {
      const aliases = await parseBody(req)
      if (!aliases) {
        sendJson(res, { error: '无效的请求数据' }, 400)
        return
      }
      
      // 生成新配置并写入（不再自动备份）
      const newContent = generateConfig(aliases)
      writeConfig(CONFIG_PATH, newContent)
      
      console.log(`✅ 配置已更新，共 ${aliases.length} 个别名`)
      sendJson(res, { success: true })
    } catch (err) {
      sendJson(res, { error: err.message }, 500)
    }
    return
  }
  
  // 获取备份列表
  if (method === 'GET' && url === '/api/backups') {
    try {
      const dir = dirname(CONFIG_PATH)
      const base = basename(CONFIG_PATH)
      const files = readdirSync(dir)
        .filter(f => f.startsWith(`${base}.backup`))
        .map(f => {
          const fullPath = join(dir, f)
          const stat = statSync(fullPath)
          return {
            name: f,
            path: fullPath,
            time: stat.mtime.toISOString(),
            size: stat.size
          }
        })
        .sort((a, b) => new Date(b.time) - new Date(a.time))
      
      sendJson(res, files)
    } catch (err) {
      sendJson(res, { error: err.message }, 500)
    }
    return
  }
  
  // 手动创建备份
  if (method === 'POST' && url === '/api/backup') {
    try {
      const backupPath = createBackup(CONFIG_PATH)
      if (backupPath) {
        console.log(`💾 手动备份已创建: ${backupPath}`)
        sendJson(res, { success: true, backupPath })
      } else {
        throw new Error('备份创建失败')
      }
    } catch (err) {
      sendJson(res, { error: err.message }, 500)
    }
    return
  }
  
  // 恢复备份
  if (method === 'POST' && url === '/api/restore') {
    try {
      const body = await parseBody(req)
      if (!body || !body.backupPath) {
        sendJson(res, { error: '无效的备份路径' }, 400)
        return
      }
      
      const { backupPath } = body
      const dir = dirname(CONFIG_PATH)
      const base = basename(CONFIG_PATH)
      const backupName = basename(backupPath)
      
      // 安全检查：使用 normalize 进行跨平台路径比较
      if (!backupName.startsWith(`${base}.backup`) || normalize(dirname(backupPath)) !== normalize(dir)) {
        sendJson(res, { error: '无效的备份文件路径' }, 400)
        return
      }
      
      if (!existsSync(backupPath)) {
        sendJson(res, { error: '备份文件不存在' }, 404)
        return
      }
      
      // 先备份当前配置
      createBackup(CONFIG_PATH)
      
      // 恢复备份
      copyFileSync(backupPath, CONFIG_PATH)
      console.log(`🔄 已恢复备份: ${backupPath}`)
      
      sendJson(res, { success: true, message: '已恢复备份' })
    } catch (err) {
      sendJson(res, { error: err.message }, 500)
    }
    return
  }
  
  // 删除备份
  if (method === 'DELETE' && url.startsWith('/api/backup?')) {
    try {
      const urlParams = new URLSearchParams(url.split('?')[1])
      const backupPath = urlParams.get('path')
      
      if (!backupPath) {
        sendJson(res, { error: '缺少备份路径参数' }, 400)
        return
      }
      
      const dir = dirname(CONFIG_PATH)
      const base = basename(CONFIG_PATH)
      const backupName = basename(backupPath)
      
      // 安全检查：使用 normalize 进行跨平台路径比较
      if (!backupName.startsWith(`${base}.backup`) || normalize(dirname(backupPath)) !== normalize(dir)) {
        sendJson(res, { error: '无效的备份文件路径' }, 400)
        return
      }
      
      if (!existsSync(backupPath)) {
        sendJson(res, { error: '备份文件不存在' }, 404)
        return
      }
      
      // 删除备份文件
      const { unlinkSync } = await import('fs')
      unlinkSync(backupPath)
      console.log(`🗑️ 已删除备份: ${backupPath}`)
      
      sendJson(res, { success: true, message: '已删除备份' })
    } catch (err) {
      sendJson(res, { error: err.message }, 500)
    }
    return
  }
  
  // 获取配置信息
  if (method === 'GET' && url === '/api/info') {
    sendJson(res, {
      configPath: CONFIG_PATH,
      platform: process.platform,
      shell: process.env.SHELL || 'unknown'
    })
    return
  }
  
  // 404
  sendJson(res, { error: 'Not Found' }, 404)
}

// 启动服务器
const server = createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 AliasGUI Server 已启动            ║
║   http://localhost:${PORT}                 ║
╚════════════════════════════════════════╝
  `)
})
