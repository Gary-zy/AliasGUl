/**
 * Shell 配置文件解析器
 * 支持 macOS/Linux (bash/zsh) 和 Windows (PowerShell)
 */

import { platform } from 'os'
import { join } from 'path'

/**
 * 检测当前平台
 */
export function getPlatform() {
  return platform() === 'win32' ? 'windows' : 'unix'
}

/**
 * 解析配置文件中的别名 (自动检测平台)
 */
export function parseAliases(content, forcePlatform = null) {
  const plat = forcePlatform || getPlatform()
  return plat === 'windows' ? parsePowerShellAliases(content) : parseUnixAliases(content)
}

/**
 * 解析 Unix (bash/zsh) 别名
 */
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

/**
 * 解析 PowerShell 别名
 * 支持: Set-Alias name command / function name { ... }
 */
function parsePowerShellAliases(content) {
  const aliases = []
  const lines = content.split('\n')
  
  // Set-Alias -Name name -Value command 或 Set-Alias name command
  const setAliasRegex = /^\s*Set-Alias\s+(?:-Name\s+)?(\w+)\s+(?:-Value\s+)?["']?([^"'\n]+)["']?\s*$/i
  // New-Alias 也支持
  const newAliasRegex = /^\s*New-Alias\s+(?:-Name\s+)?(\w+)\s+(?:-Value\s+)?["']?([^"'\n]+)["']?\s*$/i
  // function name { command }
  const functionRegex = /^\s*function\s+(\w+)\s*\{\s*(.+?)\s*\}\s*$/i
  // 多行函数开头
  const functionStartRegex = /^\s*function\s+(\w+)\s*\{\s*$/i
  
  let currentFunction = null
  let functionBody = []
  
  lines.forEach((line, index) => {
    // 跳过注释
    if (line.trim().startsWith('#')) return
    
    // Set-Alias
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
    
    // 单行函数
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
    
    // 多行函数开头
    const funcStartMatch = line.match(functionStartRegex)
    if (funcStartMatch) {
      currentFunction = { name: funcStartMatch[1], lineNumber: index + 1 }
      functionBody = []
      return
    }
    
    // 处理多行函数
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

/**
 * 生成配置文件内容 (自动检测平台)
 */
export function generateConfig(aliases, forcePlatform = null) {
  const plat = forcePlatform || getPlatform()
  return plat === 'windows' ? generatePowerShellConfig(aliases) : generateUnixConfig(aliases)
}

/**
 * 生成 Unix 配置
 */
function generateUnixConfig(aliases) {
  return aliases.map(alias => {
    if (alias.hasParams) {
      const cmd = alias.command.replace(/\.\.\./g, '$@')
      return `${alias.name}() { ${cmd} "$@"; }`
    } else {
      return `alias ${alias.name}='${alias.command}'`
    }
  }).join('\n')
}

/**
 * 生成 PowerShell 配置
 * 注意：统一使用 function 而非 Set-Alias，因为 Set-Alias 不支持带参数的命令
 */
function generatePowerShellConfig(aliases) {
  return aliases.map(alias => {
    const cmd = alias.command.replace(/\.\.\./g, '')
    // 使用 @args 展开参数，确保参数正确传递
    return `function ${alias.name} { ${cmd} @args }`
  }).join('\n')
}

/**
 * 获取默认配置文件路径
 */
export function getDefaultConfigPath() {
  const home = process.env.HOME || process.env.USERPROFILE
  const os = platform()
  
  if (os === 'win32') {
    // Windows PowerShell - 优先检查 PowerShell Core，然后是 Windows PowerShell
    const psCorePath = join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
    const psLegacyPath = join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
    return process.env.PROFILE || psCorePath
  } else {
    const shell = process.env.SHELL || '/bin/bash'
    if (shell.includes('zsh')) {
      return `${home}/.zshrc`
    }
    return `${home}/.bashrc`
  }
}
