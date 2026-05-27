# AI 小说精读助手

浏览器端 AI 小说阅读工具。上传 TXT/EPUB，配置任意 LLM API，获得章节总结、人物关系图谱、剧情时间线、AI 问答等深度阅读辅助。自带用户名系统，多设备自动同步阅读进度。

[English](README_EN.md)

## 快速开始

**前置条件：** [Node.js](https://nodejs.org) v18~22 LTS

> **Node.js 24+ 用户注意**：`better-sqlite3` 在 Node 24 上缺少预编译二进制，`npm install` 会尝试从源码编译，需要 Python 3.x 和 C++ 构建工具。建议使用 **Node.js 22 LTS** 以避免编译问题。如果需要同时使用多个 Node 版本，推荐用 [nvm](https://github.com/nvm-sh/nvm)（macOS/Linux）或 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)（Windows）管理版本。详见下方「常见问题」。

```bash
git clone https://github.com/AscendJK/ai-novel-reader.git
cd ai-novel-reader
npm install
```

### 启动

| 系统 | 命令 |
|------|------|
| Linux / macOS | `./start.sh` → 选 1（开发）或 2（生产） |
| Windows | 双击 `start.bat` → 选 1 或 2 |

打开 `http://localhost:5173`。

- 模式 1：代码热更新，手机切后台可能刷新
- 模式 2：先构建再启动，手机访问稳定

停止：`./stop.sh` 或双击 `stop.bat`

## 使用教程

### 1. 登录

首次访问弹出登录框：
- **创建新用户**：输入用户名（2-30 字符），建立独立阅读空间
- **加入已有**：输入已创建的用户名，恢复全部数据

> 同一用户名只能一台设备在线。新设备登录旧设备自动下线。退出登录只清除浏览器数据，服务器数据不会丢失，重新登录即可恢复。服务器重启后客户端自动重注册并拉取最新数据，无需手动重新登录。

### 2. 配置 AI

右上角设置 → 选择提供商（OpenAI、Anthropic、DeepSeek 及最多 5 个 OpenAI 格式自定义接口）→ 填写 API Key 和模型名称 → 保存。

- API Key 仅存在浏览器本地 IndexedDB，不经过第三方
- API 设置按用户名隔离，同一浏览器不同用户互不干扰
- 退出登录、切换用户后 API 设置不丢失

### 3. 上传小说

书架页面拖拽 TXT/EPUB 文件，或点击"从文件夹导入"批量导入。支持编码自动检测（GBK / Big5 / UTF-8），智能识别章节标题。

上传的小说自动存入服务端书库，其他人可见，需要手动加入书架。

### 4. 阅读

点击书架上任意小说进入阅读视图：
- 左侧目录切换章节，底部导航翻章，键盘 `←` `→` 上下章
- Aa 按钮调节字体大小、粗细、行距、段距、字体（系统默认 / 宋体 / 楷体 / 等宽）
- 支持暗色 / 亮色模式
- 移动端响应式适配，沉浸阅读模式（点击正文区域隐藏界面）
- 键盘快捷键：`Shift + ?` 查看全部快捷键

### 5. AI 分析

阅读页右上角打开 AI 分析面板：

| 功能 | 说明 |
|------|------|
| 本章分析 | 生成当前章节摘要（核心情节、关键人物、伏笔） |
| 全书总览 | 故事主线、主题分析、结构特点、阅读建议 |
| 人物关系 | 角色识别 + 家族/阵营/情感关系图谱（可拖拽、缩放、全屏） |
| 剧情时间线 | 15-25 个关键事件，标注类型和因果关系 |
| AI 问答 | 多轮对话，基于语义检索定位小说内容 |
| 范围总结 | 自定义章节区间（如第 5-15 章）的临时分析 |
| 笔记 | 章节笔记 + 全书笔记，AI 回答一键收藏 |
| 语义搜索 | 基于 RAG 引擎的全文语义检索，支持自然语言查询 |

AI 分析过程中状态栏实时显示当前阶段（加载数据 → 检索语义 → 组织提示词 → 等待 AI 回答 → 保存结果）。

### 6. RAG 检索引擎

项目支持**任意 Transformers.js 兼容的 ONNX 嵌入模型**作为语义检索引擎，同时内置 TF-IDF 作为零配置回退。

| 引擎 | 大小 | 说明 |
|------|------|------|
| TF-IDF | 0 MB | 纯字符级检索，瞬间可用，无需构建 |
| BGE Small ZH（内置） | ~26 MB | 中文语义检索，精度高，推荐中文小说使用 |
| GTE Small（内置） | ~34 MB | 中英文均衡，阿里通义实验室出品 |
| Multilingual E5 Small | ~120 MB | 中英文兼顾，多语言场景 |
| All-MiniLM-L6-v2 | ~23 MB | 英文轻量，体积最小 |
| Multilingual MiniLM L12 | ~120 MB | 多语言深度理解 |

- **每本书使用前需手动构建**：书架卡片点击"构建"按钮，服务端异步处理
- 构建完成后自动下载到浏览器缓存（约 1-3 MB/本）
- 未就绪时自动降级为 TF-IDF，不影响使用
- 设置页可切换引擎和调整索引缓存上限（100-500 MB）
- 模型名称支持前缀匹配（如 `deepseek-chat-0324` 自动匹配 `deepseek-chat` 的 Token 预算）

#### 自定义模型安装

支持所有 Transformers.js 兼容的 ONNX 嵌入模型（BGE、E5、MiniLM、GTE 等系列）：

1. 从 [Hugging Face](https://huggingface.co) 的 **Xenova 转换版**页面下载 4 个文件：`config.json`、`tokenizer.json`、`tokenizer_config.json`、`onnx/model_quantized.onnx`
2. 放到 `public/models/custom/Xenova/你的模型名/` 目录：
   ```
   public/models/custom/Xenova/你的模型名/
   ├── config.json
   ├── tokenizer.json
   ├── tokenizer_config.json
   └── onnx/
       └── model_quantized.onnx
   ```
3. 重启 dev server → 设置页点击"扫描" → 发现后点击选用

### 7. 多设备同步

同一用户名登录后自动同步：阅读进度、AI 总结、笔记。

- 服务器重启后客户端自动重注册，无需手动重新登录
- 断线恢复时自动拉取服务器最新数据
- 删除的小说和笔记通过软删除同步，确保多设备一致

> 主题、字体和 API 配置不同步，每台设备 / 每个用户独立存储。

### 8. 离线模式

设置页可开启离线模式。开启后浏览器停止与服务器通信，所有数据保留在本地 IndexedDB，关闭浏览器再打开仍可正常使用。适合服务器不确定是否在线的场景。

- 离线模式下退出登录会清除本地数据，但需服务器在线才能重新登录
- Service Worker 缓存所有页面资源，服务器关闭后仍可访问应用
- 有新版本时会提示更新

### 9. 导出 / 备份

设置页提供数据导出功能：
- **导出全部数据**：所有小说、摘要、笔记（不含 API Key）→ JSON 文件
- **单本导出**：下拉选择小说 → JSON 或 TXT 格式
- **导入备份**：从 JSON 文件恢复数据
- **存储用量**：显示浏览器已用 / 可用空间，接近上限时警告

### 10. 全局笔记

Header 点击"笔记"按钮查看所有小说的笔记，支持按小说筛选和按来源（用户 / AI）筛选。

### 11. 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `←` / `→` | 上一章 / 下一章 |
| `+` / `-` | 增大 / 减小字号 |
| `i` | 切换沉浸模式 |
| `t` | 切换主题 |
| `Esc` | 关闭弹窗 |
| `Shift + ?` | 显示快捷键帮助 |

设置页也提供快捷键参考卡片。

### 12. 书库

书架底部"书库"可浏览服务器上所有小说，点击"加入书架"即可开始阅读。从书架移除小说只删除你的阅读数据，小说仍保留在书库中。

### 13. 管理后台

```bash
./admin.sh       # Linux / macOS
admin.bat        # Windows 双击
```

自动启动服务并打开管理页面。可查看 / 删除用户和小说，调整 RAG 构建超时（最高 120 分钟）等设置。

> **注意**：管理后台在生产模式下由 Express 直接提供（非 Vite），首次打开或升级后请 `Ctrl + Shift + R` 强制刷新，或使用无痕模式，避免 Service Worker 缓存导致显示小说页面而非管理页面。

## 核心架构

```
React 19 + TypeScript + Vite
Express + better-sqlite3
├─ 多 Agent 引擎：总结 / 人物 / 时间线 / 图谱（实时状态反馈）
├─ 多引擎语义检索：BGE / E5 / MiniLM / GTE 等 ONNX 模型（Worker Thread 编码）
├─ d3-force 人物关系图谱（鼠标滚轮 + 移动端双指缩放）
├─ IndexedDB 浏览器缓存 + SQLite 服务端持久化
├─ PWA Service Worker 离线缓存
├─ 用户名系统 + Session Token 认证 + 服务端中心化同步（自动重注册）
└─ 定时 WAL checkpoint + 自动数据库备份（24h）
```

## 安全机制

- **Session Token 认证**：登录后服务端颁发 Token，所有同步接口（push / heartbeat）均验证 Token
- **自动重注册**：服务器重启或 Token 失效时，客户端自动以已有用户名重新加入，获取新 Token 并拉取全量数据
- **单设备在线**：同一用户名新设备登录时旧设备自动下线
- **API Key 本地隔离**：按用户名存储在 IndexedDB，不上传服务器，不同步，被踢下线时自动保留
- **CORS 限制**：仅允许 localhost 和局域网 IP（192.168.x.x / 10.x.x.x / 172.16-31.x.x）访问
- **CSP 安全策略**：限制 connect-src 仅允许同源请求，阻止外部数据泄露
- **请求限流**：RAG 构建、编码等高开销接口按 IP 限频
- **输入校验**：用户名长度限制、请求体大小限制（10MB）、文本长度限制
- **时间戳合并**：同步时按时间戳判断新旧，避免覆盖更新数据
- **同步互斥锁**：防止并发同步导致数据丢失
- **孤儿记录清理**：同步时自动跳过不存在的小说关联数据，删除小说时级联清理 RAG 缓存

## 注意事项

- **仅限局域网 / 本地使用，不要暴露到公网**。项目无 HTTPS、无密码认证、SQLite 不适合公网并发，暴露后存在 API Key 泄露、会话劫持、数据损坏等风险
- 大长篇（5000+ 章）BGE 首次构建可能需要 5-30 分钟，构建期间不影响正常阅读
- 服务端模型加载需要 ~2GB 内存峰值
- 同一台服务器多用户同时构建时自动排队，最多 10 个任务
- API Key 仅存在浏览器 IndexedDB，不会上传到服务器
- 调试面板默认关闭，移动端自动隐藏

## 浏览器支持

| 浏览器 | 状态 |
|--------|------|
| Chrome / Edge 86+ | 完全支持 |
| Firefox 120+ | 文件夹导入需手动选择文件 |
| Safari 15+ | 基本功能 |
| 移动端 Chrome / Safari | 响应式适配 |

## 开源协议

MIT License

内置模型协议：
- **BGE Small ZH v1.5** — 来自北京智源人工智能研究院（BAAI），MIT 协议
- **GTE Small** — 来自阿里通义实验室（Alibaba DAMO Academy），Apache 2.0 协议

## 常见问题

### npm install 失败，提示 better-sqlite3 编译错误

**原因**：`better-sqlite3` 是原生模块，Node.js 24+ 没有预编译二进制。本项目要求 Node.js 18-22 LTS。

**解决方案（任选其一）**：

1. **用 nvm 安装 Node.js 22 LTS**（推荐）
   - Windows：下载安装 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
   - macOS/Linux：终端运行 `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`
   - 安装后重启终端，执行：
     ```bash
     nvm install 22       # 安装 Node 22 LTS
     nvm use 22           # 切换到 Node 22
     ```
   - 重新运行 `start.bat` 或 `./start.sh`
   - 其他项目需要用 Node 24 时，`nvm use 24` 即可切换回来

2. **直接安装 Node.js 22 LTS**（不用 nvm）
   - 卸载当前 Node.js
   - 从 https://nodejs.org 下载 22.x.x LTS 版本安装
   - 重新运行 `start.bat` 或 `./start.sh`

### 如何重新安装依赖

遇到依赖异常或切换 Node 版本后，可删除旧依赖重新安装：

```bash
# Windows CMD
rmdir /s /q node_modules
del package-lock.json
start.bat

# macOS / Linux
rm -rf node_modules package-lock.json
./start.sh
```

运行 `start.bat` / `./start.sh` 时会自动检测并重新安装依赖。
