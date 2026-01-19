/**
 * 文件服务 - 负责配置文件的读写和备份
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'

import { dirname, basename, join } from 'path'

// 别名区块标记（与 electron.cjs 保持一致）
const ALIAS_BLOCK_START = '# === AliasGUI Managed Aliases START ==='
const ALIAS_BLOCK_END = '# === AliasGUI Managed Aliases END ==='

/**
 * 读取配置文件
 * @param {string} filePath - 文件路径
 * @returns {string} 文件内容
 */
export function readConfig(filePath) {
  if (!existsSync(filePath)) {
    return ''
  }
  return readFileSync(filePath, 'utf-8')
}

/**
 * 创建备份
 * @param {string} filePath - 原文件路径
 * @returns {string} 备份文件路径
 */
export function createBackup(filePath) {
  if (!existsSync(filePath)) {
    return null
  }
  
  const dir = dirname(filePath)
  const name = basename(filePath)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = join(dir, `${name}.backup-${timestamp}`)
  
  copyFileSync(filePath, backupPath)
  
  // 清理旧备份，只保留最近 10 个
  try {
    const files = readdirSync(dir)
      .filter(f => f.startsWith(`${name}.backup-`))
      .map(f => ({ name: f, time: statSync(join(dir, f)).mtime }))
      .sort((a, b) => b.time - a.time)
    
    const MAX_BACKUPS = 10
    if (files.length > MAX_BACKUPS) {
      files.slice(MAX_BACKUPS).forEach(f => {
        unlinkSync(join(dir, f.name))
        console.log(`清理旧备份: ${f.name}`)
      })
    }
  } catch (err) {
    console.error('清理旧备份失败:', err)
  }
  
  return backupPath
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
 * @param {string} filePath - 文件路径
 * @param {string} newAliasContent - 新的别名内容
 * @returns {boolean} 是否成功
 */
export function writeConfig(filePath, newAliasContent) {
  let originalContent = ''
  
  if (existsSync(filePath)) {
    originalContent = readFileSync(filePath, 'utf-8')
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
  
  writeFileSync(filePath, newContent, 'utf-8')
  return true
}

