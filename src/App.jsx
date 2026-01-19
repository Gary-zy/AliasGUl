import React, { useState, useEffect, useMemo } from 'react'

// API 基础路径：开发模式用 Vite 代理，生产模式用完整地址
const API_BASE = import.meta.env.DEV ? '' : 'http://localhost:3001'

// SVG 图标组件
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const TerminalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4,17 10,11 4,5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
)

const RestoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
)

const BackupIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)


// Toast 组件
function Toast({ message, type, visible }) {
  return (
    <div className={`toast toast--${type} ${visible ? 'toast--visible' : ''}`}>
      {type === 'success' ? '✓' : '✕'} {message}
    </div>
  )
}

// 编辑模态框
function EditModal({ alias, onSave, onClose, isNew }) {
  const [name, setName] = useState(alias?.name || '')
  const [command, setCommand] = useState(alias?.command || '')
  const [hasParams, setHasParams] = useState(alias?.hasParams || false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !command.trim()) return
    onSave({ ...alias, name: name.trim(), command: command.trim(), hasParams })
  }

  // 处理 Tab 键在 textarea 中插入制表符
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = e.target.selectionStart
      const end = e.target.selectionEnd
      setCommand(command.substring(0, start) + '  ' + command.substring(end))
    }
  }

  return (
    <div className="modal-overlay modal-overlay--visible" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{isNew ? '新增别名' : '编辑别名'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-group__label">别名名称</label>
            <input
              type="text"
              className="form-group__input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如: gp"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-group__label">执行命令</label>
            <textarea
              className="form-group__input form-group__textarea"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如: git push&#10;支持多行命令"
              rows={4}
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="hasParams"
                checked={hasParams}
                onChange={e => setHasParams(e.target.checked)}
              />
              <label htmlFor="hasParams" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                支持参数 (function)
              </label>
              <span className="tooltip-trigger">
                ?
                <span className="tooltip-content">
                  <strong>什么时候需要勾选？</strong><br/><br/>
                  当你希望<u>别名后面能接参数</u>时，需要勾选。<br/><br/>
                  <strong>具体例子：</strong><br/>
                  假设你创建别名 <code>gco</code>，命令是 <code>git checkout</code><br/><br/>
                  <strong>不勾选（alias）：</strong><br/>
                  <code>gco</code> 只能执行 <code>git checkout</code><br/>
                  输入 <code>gco main</code> 会报错 ❌<br/><br/>
                  <strong>勾选（function）：</strong><br/>
                  <code>gco main</code> → <code>git checkout main</code> ✓<br/>
                  <code>gco -b dev</code> → <code>git checkout -b dev</code> ✓
                </span>
              </span>

            </div>
          </div>

          
          {/* 命令预览 */}
          <div className="form-group" style={{ 
            padding: '12px', 
            background: 'var(--paper-warm)', 
            border: '1px dashed var(--ink-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem'
          }}>
            <div style={{ color: 'var(--ink-faint)', marginBottom: '4px', fontSize: '0.7rem' }}>预览（将写入配置文件）:</div>
            <code style={{ color: 'var(--ink-black)', wordBreak: 'break-all' }}>
              {hasParams 
                ? `${name || 'name'}() { ${command || 'command'} "$@"; }`
                : `alias ${name || 'name'}='${command || 'command'}'`
              }
            </code>
          </div>


          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn--lg" onClick={onClose} style={{ flex: 1, background: 'var(--color-bg-tertiary)' }}>
              取消
            </button>
            <button type="submit" className="btn btn--primary btn--lg" style={{ flex: 1 }}>
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 单行别名
function AliasRow({ alias, onEdit, onDelete }) {
  return (
    <div className="alias-row">
      <span className="alias-row__name">{alias.name}</span>
      <span className="alias-row__command" title={alias.command}>{alias.command}</span>
      <div className="alias-row__status">
        {alias.hasParams ? (
          <span className="status-badge status-badge--function">fn</span>
        ) : (
          <span className="status-badge status-badge--alias">alias</span>
        )}
      </div>

      <div className="alias-row__actions">
        <button className="btn btn--icon" onClick={() => onEdit(alias)} title="编辑">
          <EditIcon />
        </button>
        <button className="btn btn--icon btn--danger" onClick={() => onDelete(alias)} title="删除">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// 主应用
export default function App() {
  const [aliases, setAliases] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingAlias, setEditingAlias] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })
  const [hasChanges, setHasChanges] = useState(false)
  const [showBackups, setShowBackups] = useState(false)
  const [backups, setBackups] = useState([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [platformInfo, setPlatformInfo] = useState({ platform: 'unix', configPath: '' })
  const [showPolicyGuide, setShowPolicyGuide] = useState(false)  // Windows 执行策略引导

  // 获取平台特定的重载命令提示
  const getReloadHint = () => {
    if (platformInfo.platform === 'win32') {
      return '重新打开 PowerShell 生效'
    }
    return '终端执行 source ~/.zshrc 生效'
  }

  // 加载别名和平台信息
  useEffect(() => {
    fetchAliases()
    fetchPlatformInfo()
  }, [])

  // 获取平台信息
  const fetchPlatformInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/info`)
      if (res.ok) {
        const data = await res.json()
        setPlatformInfo(data)
        
        // Windows 平台检测执行策略
        if (data.platform === 'win32') {
          checkExecutionPolicy()
        }
      }
    } catch (err) {
      console.error('获取平台信息失败:', err)
    }
  }

  // 检测 Windows 执行策略
  const checkExecutionPolicy = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/execution-policy`)
      if (res.ok) {
        const data = await res.json()
        if (data.needsSetup) {
          setShowPolicyGuide(true)
        }
      }
    } catch (err) {
      console.error('检测执行策略失败:', err)
    }
  }

  // 加载备份列表
  const fetchBackups = async () => {
    setLoadingBackups(true)
    try {
      const res = await fetch(`${API_BASE}/api/backups`)
      if (res.ok) {
        const data = await res.json()
        setBackups(data)
      }
    } catch (err) {
      console.error('加载备份失败:', err)
    } finally {
      setLoadingBackups(false)
    }
  }

  // 恢复备份
  const handleRestore = async (backupPath) => {
    try {
      const res = await fetch(`${API_BASE}/api/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath })
      })
      if (res.ok) {
        showToast(`已恢复备份！${getReloadHint()}`)
        setShowBackups(false)
        fetchAliases()
      } else {
        const data = await res.json()
        showToast(data.error || '恢复失败', 'error')
      }
    } catch (err) {
      showToast('恢复失败', 'error')
    }
  }

  // 打开备份列表
  const openBackupList = () => {
    fetchBackups()
    setShowBackups(true)
  }

  // 手动创建备份
  const handleCreateBackup = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        showToast('备份创建成功！')
      } else {
        const data = await res.json()
        showToast(data.error || '备份失败', 'error')
      }
    } catch (err) {
      showToast('备份失败', 'error')
    }
  }

  // 删除备份
  const handleDeleteBackup = async (backupPath, e) => {
    e.stopPropagation()  // 阻止触发恢复
    if (!confirm('确定删除这个备份吗？')) return
    
    try {
      const res = await fetch(`${API_BASE}/api/backup?path=${encodeURIComponent(backupPath)}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        showToast('备份已删除')
        fetchBackups()  // 刷新列表
      } else {
        const data = await res.json()
        showToast(data.error || '删除失败', 'error')
      }
    } catch (err) {
      showToast('删除失败', 'error')
    }
  }


  const fetchAliases = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/aliases`)
      if (res.ok) {
        const data = await res.json()
        setAliases(data)
      } else {
        console.error('API 响应错误:', res.status)
        showToast('无法连接到服务', 'error')
      }
    } catch (err) {
      console.error('加载失败:', err)
      showToast('无法加载别名数据', 'error')
    } finally {
      setIsLoading(false)
    }
  }


  // 过滤后的别名列表
  const filteredAliases = useMemo(() => {
    if (!searchQuery.trim()) return aliases
    const q = searchQuery.toLowerCase()
    return aliases.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.command.toLowerCase().includes(q)
    )
  }, [aliases, searchQuery])

  // 显示 Toast
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000)
  }

  // 保存别名
  const handleSave = (alias) => {
    if (alias.id) {
      setAliases(prev => prev.map(a => a.id === alias.id ? alias : a))
    } else {
      const newAlias = { ...alias, id: Date.now() }
      setAliases(prev => [...prev, newAlias])
    }
    setEditingAlias(null)
    setHasChanges(true)
    showToast('已保存')
  }

  // 删除别名 - 真删除，立即同步到文件
  const handleDelete = async (alias) => {
    if (confirm(`确定删除别名 "${alias.name}" 吗？`)) {
      const newAliases = aliases.filter(a => a.id !== alias.id)
      setAliases(newAliases)
      
      // 立即同步到文件
      try {
        const res = await fetch(`${API_BASE}/api/aliases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAliases)
        })
        if (res.ok) {
          showToast(`已删除并保存！${getReloadHint()}`)
        } else {
          showToast('删除保存失败', 'error')
        }
      } catch (err) {
        showToast('删除保存失败', 'error')
      }
    }
  }

  // 写入文件
  const handleWriteToFile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aliases)
      })
      if (res.ok) {
        setHasChanges(false)
        showToast(`已保存！${getReloadHint()}`)
      }

    } catch (err) {
      showToast('保存失败', 'error')
    }
  }

  return (
    <div className="app-container">
      {/* macOS 窗口拖动区域 */}
      <div className="drag-region" />
      
      {/* 顶部栏 */}
      <header className="header">
        <h1 className="header__title">
          <TerminalIcon /> AliasGUI
        </h1>
        <div className="search-box">
          <span className="search-box__icon"><SearchIcon /></span>
          <input
            type="text"
            className="search-box__input"
            placeholder="搜索别名或命令..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* 表头 */}
      <div className="alias-table__header">
        <span>别名</span>
        <span>命令</span>
        <span>类型</span>
        <span>操作</span>
      </div>

      {/* 别名列表 */}
      {isLoading ? (
        <div className="empty-state">
          <div className="loading-spinner" />
        </div>
      ) : filteredAliases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <p className="empty-state__text">
            {searchQuery ? '没有找到匹配的别名' : '还没有别名，点击下方按钮添加'}
          </p>
        </div>
      ) : (
        <div className="alias-table">
          {filteredAliases.map(alias => (
            <AliasRow
              key={alias.id}
              alias={alias}
              onEdit={setEditingAlias}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="action-bar">
        <div className="action-bar__info">
          共 {aliases.length} 个别名 {hasChanges && '• 有未保存的更改'}
        </div>
        <div className="action-bar__buttons">
          <button 
            className="btn btn--lg" 
            style={{ background: 'var(--color-bg-tertiary)' }} 
            onClick={handleCreateBackup}
            title="创建备份"
          >
            <BackupIcon /> 备份
          </button>
          <button 
            className="btn btn--lg" 
            style={{ background: 'var(--color-bg-tertiary)' }} 
            onClick={openBackupList}
            title="恢复备份"
          >
            <RestoreIcon /> 恢复
          </button>
          <button className="btn btn--lg" style={{ background: 'var(--color-bg-tertiary)' }} onClick={() => setEditingAlias({})}>
            <PlusIcon style={{ marginRight: '8px' }} /> 新增
          </button>
          <button
            className="btn btn--primary btn--lg"
            onClick={handleWriteToFile}
            disabled={!hasChanges}
            style={{ opacity: hasChanges ? 1 : 0.5 }}
          >
            保存并生效
          </button>
        </div>
      </div>

      {/* 编辑模态框 */}
      {editingAlias && (
        <EditModal
          alias={editingAlias}
          isNew={!editingAlias.id}
          onSave={handleSave}
          onClose={() => setEditingAlias(null)}
        />
      )}

      {/* 备份列表弹窗 */}
      {showBackups && (
        <div className="modal-overlay modal-overlay--visible" onClick={() => setShowBackups(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal__title">选择要恢复的备份</h2>
            <div className="backup-list">
              {loadingBackups ? (
                <div className="loading-spinner" />
              ) : backups.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>暂无备份</p>
              ) : (
                backups.slice(0, 10).map((backup, index) => (
                  <div key={backup.path} className="backup-item">
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleRestore(backup.path)}>
                      <span className="backup-item__time">
                        {new Date(backup.time).toLocaleString('zh-CN')}
                      </span>
                      <span className="backup-item__size" style={{ marginLeft: '12px' }}>
                        {(backup.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button 
                      className="btn btn--icon btn--danger" 
                      onClick={(e) => handleDeleteBackup(backup.path, e)}
                      title="删除备份"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="modal__actions">
              <button className="btn btn--lg" onClick={() => setShowBackups(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}

      {/* Windows 执行策略引导弹窗 */}
      {showPolicyGuide && (
        <div className="modal-overlay modal-overlay--visible" onClick={() => setShowPolicyGuide(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2 className="modal__title">⚠️ 首次使用设置</h2>
            <div style={{ padding: '16px 0', lineHeight: 1.8 }}>
              <p style={{ marginBottom: '12px' }}>
                检测到您的 PowerShell 执行策略可能阻止别名生效。
              </p>
              <p style={{ marginBottom: '12px' }}>
                请打开 PowerShell，运行以下命令：
              </p>
              <div style={{
                background: 'var(--color-bg-tertiary)',
                padding: '12px 16px',
                borderRadius: '8px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '14px',
                marginBottom: '12px',
                userSelect: 'all'
              }}>
                Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                这是一次性设置，之后无需再次操作。设置后请重新打开 PowerShell 使别名生效。
              </p>
            </div>
            <div className="modal__actions" style={{ gap: '12px' }}>
              <button className="btn btn--lg" onClick={() => setShowPolicyGuide(false)}>
                稍后手动设置
              </button>
              <button 
                className="btn btn--primary btn--lg" 
                onClick={async () => {
                  try {
                    const res = await fetch(`${API_BASE}/api/set-execution-policy`, { method: 'POST' })
                    const data = await res.json()
                    if (data.success) {
                      showToast('设置成功！请重新打开 PowerShell 使别名生效')
                      setShowPolicyGuide(false)
                    } else {
                      showToast(data.error || '设置失败，请手动运行命令', 'error')
                    }
                  } catch (err) {
                    showToast('设置失败，请手动运行命令', 'error')
                  }
                }}
              >
                一键设置
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
