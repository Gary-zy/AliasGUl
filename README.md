# AliasGUI

> 🚀 可视化 Shell 别名管理工具 | Visual Shell Alias Manager

一个跨平台的桌面应用程序，让你告别命令行，通过图形界面轻松管理 Shell 别名和函数。

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能特性

- 🖥️ **跨平台支持** - macOS、Windows、Linux
- 📝 **可视化管理** - 无需编辑配置文件，图形界面操作
- 🔍 **快速搜索** - 即时搜索已有别名
- 💾 **备份恢复** - 一键备份，随时恢复
- 🔧 **智能检测** - 自动检测系统 Shell 和配置文件
- 🛡️ **安全保护** - 保留原有配置，只管理 AliasGUI 区块

## 📦 安装

### macOS
下载 `AliasGUI-x.x.x.dmg` 或 `AliasGUI-x.x.x-arm64.dmg`（Apple Silicon）

### Windows
下载 `AliasGUI Setup x.x.x.exe`

### 从源码构建
```bash
# 克隆仓库
git clone https://github.com/Gary-zy/AliasGUl.git
cd AliasGUl

# 安装依赖
npm install

# 开发模式
npm run electron:dev

# 构建
npm run electron:build        # macOS
npm run electron:build:win    # Windows
```

## 🎯 使用方法

### 1. 添加别名
点击 **+新增** 按钮，输入别名名称和命令：
- **别名名称**: 你想使用的快捷命令，如 `g`
- **命令**: 实际执行的命令，如 `git`

### 2. 保存生效
点击 **保存并生效** 按钮保存更改。

**生效方式：**
- **macOS/Linux**: 终端执行 `source ~/.zshrc` 或 `source ~/.bashrc`
- **Windows**: 重新打开 PowerShell

### 3. 备份恢复
- **备份**: 点击 **备份** 按钮创建当前配置的备份
- **恢复**: 点击 **恢复** 按钮选择历史备份还原

## 🔧 支持的配置文件

| 平台 | 配置文件 |
|------|----------|
| macOS (Zsh) | `~/.zshrc` |
| macOS (Bash) | `~/.bashrc` |
| Linux | `~/.bashrc` 或 `~/.zshrc` |
| Windows | `Documents\PowerShell\Microsoft.PowerShell_profile.ps1` |

## 📝 生成的配置格式

### macOS/Linux
```bash
# === AliasGUI Managed Aliases START ===
alias g='git'
gco() { git checkout "$@"; }
# === AliasGUI Managed Aliases END ===
```

### Windows PowerShell
```powershell
# === AliasGUI Managed Aliases START ===
function g { git @args }
function gco { git checkout @args }
# === AliasGUI Managed Aliases END ===
```

## ⚠️ Windows 用户注意

首次使用需要设置 PowerShell 执行策略，应用会自动检测并提供一键设置功能。

手动设置命令：
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用框架
- **React** - 前端 UI 框架
- **Vite** - 构建工具
- **Node.js** - 后端服务

## 📄 许可证

MIT License

## 🙏 贡献

欢迎提交 Issue 和 Pull Request！
