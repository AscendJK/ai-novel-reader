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

> 同一用户名只能一台设备在线。新设备登录旧设备自动下线。退出登录只清除浏览器数据，服务器数据不会丢失，重新登录即可恢复。

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
- Aa 按钮调节字体大小和粗细，支持暗色 / 亮色模式
- 移动端响应式适配，沉浸阅读模式（点击正文区域隐藏界面）

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

### 6. RAG 检索引擎

项目内置 **TF-IDF** 和 **BGE Small ZH** 两种检索引擎：

| 引擎 | 说明 |
|------|------|
| TF-IDF | 纯字符级检索，瞬间可用，无需构建 |
| BGE Small ZH | 中文语义向量检索，精度更高，需服务端构建索引 |

- **每本书使用前需手动构建**：书架卡片点击"构建"按钮，服务端异步处理
- 构建完成后自动下载到浏览器缓存（约 1-3 MB/本）
- BGE 未就绪时自动降级为 TF-IDF，不影响使用
- 设置页可切换引擎和调整索引缓存上限（100-500 MB）

### 7. 多设备同步

同一用户名登录后自动同步：阅读进度、AI 总结、笔记。

> 主题、字体和 API 配置不同步，每台设备 / 每个用户独立存储。

### 8. 书库

书架底部"书库"可浏览服务器上所有小说，点击"加入书架"即可开始阅读。从书架移除小说只删除你的阅读数据，小说仍保留在书库中。

### 9. 管理后台

```bash
./admin.sh       # Linux / macOS
admin.bat        # Windows 双击
```

自动启动服务并打开管理页面。可查看 / 删除用户和小说。

## 核心架构

```
React 19 + TypeScript + Vite
Express + better-sqlite3
├─ 多 Agent 引擎：总结 / 人物 / 时间线 / 图谱
├─ BGE Small ZH 语义检索引擎（Worker Thread 编码）
├─ d3-force 人物关系图谱（鼠标滚轮 + 移动端双指缩放）
├─ IndexedDB 浏览器缓存 + SQLite 服务端持久化
└─ 用户名系统 + Session Token 认证 + 服务端中心化同步
```

## 安全机制

- **Session Token 认证**：登录后服务端颁发 Token，所有 API 请求通过 `Authorization: Bearer <token>` 验证
- **单设备在线**：同一用户名新设备登录时旧设备自动下线
- **API Key 本地隔离**：按用户名存储在 IndexedDB，不上传服务器，不同步
- **CORS 限制**：仅允许 localhost 和局域网 IP（192.168.x.x / 10.x.x.x / 172.16-31.x.x）访问
- **请求限流**：RAG 构建、编码等高开销接口按 IP 限频
- **输入校验**：用户名长度限制、请求体大小限制、文本长度限制

## 注意事项

- 大长篇（5000+ 章）BGE 首次构建可能需要 5-30 分钟，构建期间不影响正常阅读
- 服务端模型加载需要 ~2GB 内存峰值
- 同一台服务器多用户同时构建时自动排队，最多 10 个任务
- 本书仅限局域网或本地使用，不要在公网直接暴露端口
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

内置 BGE Small ZH v1.5 模型来自北京智源人工智能研究院（BAAI），MIT 协议。

## 常见问题

### npm install 失败，提示 better-sqlite3 编译错误

**原因**：`better-sqlite3` 是原生模块，Node.js 24+ 没有预编译二进制，需要从源码编译，依赖 Python 和 C++ 构建工具。

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

3. **安装编译工具链**（适合高级用户，不换 Node 版本）
   - 安装 Python 3.x：https://www.python.org/downloads/ （安装时勾选 "Add Python to PATH"）
   - Windows：安装 Visual Studio Build Tools https://visualstudio.microsoft.com/visual-cpp-build-tools/ ，选择"使用 C++ 的桌面开发"工作负载
   - macOS：终端运行 `xcode-select --install`
   - Linux：`sudo apt install build-essential`（Ubuntu）或 `sudo dnf groupinstall "Development Tools"`（Fedora）
   - 安装完成后重启终端，重新运行 `start.bat` 或 `./start.sh`
