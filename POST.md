# AI 小说精读助手 —— 完整技术文档

> 开源地址：https://github.com/AscendJK/ai-novel-reader

---

## 目录

1. [项目简介](#1-项目简介)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [项目目录结构](#3-项目目录结构)
4. [整体架构图](#4-整体架构图)
5. [前端架构详解](#5-前端架构详解)
6. [后端架构详解](#6-后端架构详解)
7. [用户完整使用流程](#7-用户完整使用流程)
8. [功能详解与流程图](#8-功能详解与流程图)
9. [多设备同步系统](#9-多设备同步系统)
10. [RAG 语义检索系统](#10-rag-语义检索系统)
11. [数据库设计](#11-数据库设计)
12. [API 接口全览](#12-api-接口全览)
13. [安全机制](#13-安全机制)
14. [构建与部署](#14-构建与部署)
15. [常见问题](#15-常见问题)

---

## 1. 项目简介

### 它是什么？

AI 小说精读助手是一个**运行在浏览器中的小说阅读 + AI 分析工具**。你把 TXT 或 EPUB 格式的小说上传进去，它能：

- 像普通阅读器一样翻页阅读
- 用 AI 自动生成每章摘要、人物关系图谱、剧情时间线
- 跟 AI 对话讨论剧情，AI 能"看到"小说内容而不是瞎编
- 多设备同步阅读进度和笔记

### 它解决什么问题？

| 问题 | 本项目的解决方案 |
|------|-----------------|
| 网络小说追了几百章，前面剧情忘了 | AI 自动生成每章摘要，随时回顾 |
| 人物太多记不住谁是谁 | 人物关系图谱，自动识别角色关系 |
| 想快速了解第 50-100 章发生了什么 | 范围总结功能，自定义章节区间分析 |
| 跟 AI 讨论剧情，AI 总说"我没有这本书的内容" | RAG 语义检索，精准找到相关段落传给 AI |
| 换设备阅读进度丢失 | 多设备自动同步 |
| 想跟家人共用一台服务器 | 用户名系统，每人独立空间 |

### 它的技术亮点

- **RAG（检索增强生成）**：不是把整本书丢给 AI（token 不够、成本高），而是用语义检索精准找到最相关的段落，只传有用的内容
- **离线可用**：PWA 架构，Service Worker 缓存所有资源，服务器关了也能继续阅读和使用已缓存的 AI 分析
- **客户端编码**：服务器离线时，浏览器端直接加载 ONNX 模型做语义编码，不需要服务器

---

## 2. 技术栈与依赖

### 一图看懂技术栈

```
┌─────────────────────────────────────────────────────┐
│                    浏览器 (前端)                       │
│  React 19 + TypeScript + Vite                        │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Zustand   │ │ Dexie    │ │ @xenova/          │    │
│  │ 状态管理   │ │ IndexedDB│ │ transformers      │    │
│  │           │ │ 浏览器数据库│ │ ONNX 语义编码     │    │
│  └───────────┘ └──────────┘ └──────────────────┘    │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ d3-force  │ │ Tailwind │ │ react-markdown    │    │
│  │ 人物图谱   │ │ CSS 样式  │ │ Markdown 渲染     │    │
│  └───────────┘ └──────────┘ └──────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP 请求
                        ▼
┌─────────────────────────────────────────────────────┐
│                    服务器 (后端)                       │
│  Express (Node.js HTTP 框架)                          │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ better-   │ │ SQLite   │ │ ONNX Runtime      │    │
│  │ sqlite3   │ │ WAL 模式  │ │ Worker Thread 编码 │    │
│  │ 数据库驱动  │ │ 数据持久化 │ │ 服务端语义编码     │    │
│  └───────────┘ └──────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 详细依赖列表

#### 运行时依赖（项目运行需要的库）

| 类别 | 库名 | 版本 | 用途 |
|------|------|------|------|
| **UI 框架** | react | ^19.2.6 | 构建用户界面的核心框架 |
| | react-dom | ^19.2.6 | React 在浏览器中的渲染引擎 |
| **UI 组件库** | @radix-ui/react-dialog | - | 弹窗组件 |
| | @radix-ui/react-tabs | - | 标签页组件 |
| | @radix-ui/react-select | - | 下拉选择组件 |
| | @radix-ui/react-scroll-area | - | 自定义滚动条 |
| | @radix-ui/react-tooltip | - | 悬浮提示 |
| | lucide-react | ^1.16.0 | 图标库 |
| **样式** | tailwind-merge | ^3.6.0 | 合并 Tailwind CSS 类名 |
| | clsx | ^2.1.1 | 条件拼接 CSS 类名 |
| | class-variance-authority | ^0.7.1 | 组件变体样式管理 |
| **状态管理** | zustand | ^5.0.13 | 轻量级全局状态管理（类似 Redux 但简单得多） |
| **浏览器数据库** | dexie | ^4.4.2 | IndexedDB 的封装库，让浏览器数据库更好用 |
| **服务器数据库** | better-sqlite3 | ^12.10.0 | SQLite 数据库驱动，同步 API 性能好 |
| **服务器框架** | express | ^5.2.1 | Node.js 的 HTTP 服务器框架 |
| | cors | ^2.8.6 | 处理跨域请求 |
| **AI/机器学习** | @xenova/transformers | ^2.17.2 | 在浏览器/服务器中运行 ONNX 模型的库 |
| | onnxruntime-web | ^1.14.0 | 浏览器端 ONNX 模型推理引擎 |
| | onnxruntime-node | ^1.14.0 | 服务器端 ONNX 模型推理引擎 |
| **文件解析** | jszip | ^3.10.1 | 解析 EPUB 文件（EPUB 本质是 ZIP 压缩包） |
| **图谱可视化** | d3-force | ^3.0.0 | 力导向图布局算法（人物关系图谱） |
| | d3-selection | ^3.0.0 | DOM 选择和操作 |
| **Markdown** | react-markdown | ^10.1.0 | 在 React 中渲染 Markdown 文本 |

#### 开发依赖（只在开发/构建时需要）

| 类别 | 库名 | 用途 |
|------|------|------|
| **构建工具** | vite | 前端构建工具，开发时热更新，生产时打包 |
| | @vitejs/plugin-react | Vite 的 React 插件 |
| | vite-plugin-pwa | PWA 支持（Service Worker 生成） |
| **类型检查** | typescript | TypeScript 编译器，提供类型安全 |
| **代码检查** | eslint | 代码质量检查工具 |
| **CSS 工具** | tailwindcss | 实用优先的 CSS 框架 |
| | autoprefixer | 自动添加浏览器前缀 |
| | postcss | CSS 后处理工具 |

---

## 3. 项目目录结构

```
ai-novel-reader/
│
├── server/                          # ===== 后端代码 =====
│   ├── index.js                     # 服务器入口，定义所有 API 路由
│   ├── database.js                  # 数据库操作：建表、增删改查、同步
│   ├── sync-handler.js              # 同步逻辑：会话管理、数据合并
│   ├── rag-builder.js               # RAG 索引构建器（用 Worker 线程编码）
│   ├── rag-worker.mjs               # Worker 线程：实际执行 ONNX 编码
│   ├── admin.js                     # 管理后台 API
│   ├── admin.html                   # 管理后台页面
│   └── data/                        # 运行时数据目录
│       ├── novels.db                # SQLite 数据库文件
│       ├── .admin_token             # 管理员令牌
│       └── backups/                 # 自动备份（保留 7 天）
│
├── src/                             # ===== 前端代码 =====
│   ├── main.tsx                     # 前端入口，挂载 React 应用
│   ├── App.tsx                      # 根组件
│   │
│   ├── agents/                      # --- AI Agent 模块 ---
│   │   ├── types.ts                 # Agent 接口定义
│   │   ├── orchestrator.ts          # 任务编排器（管理依赖关系）
│   │   ├── summarizer.ts            # 章节总结 + 全书总览 Agent
│   │   ├── analyzers.ts             # 人物分析 + 时间线 Agent
│   │   ├── graph-agent.ts           # 人物关系图谱 Agent（输出 JSON）
│   │   └── chunker.ts               # 文本分块 Agent
│   │
│   ├── api/                         # --- AI 提供商模块 ---
│   │   ├── types.ts                 # API 类型定义
│   │   ├── registry.ts              # 提供商注册表
│   │   ├── token-manager.ts         # Token 预算管理（不同模型的限制）
│   │   ├── error-handler.ts         # API 错误处理
│   │   └── providers/               # 各提供商实现
│   │       ├── openai.ts            # OpenAI（GPT 系列）
│   │       ├── anthropic.ts         # Anthropic（Claude 系列）
│   │       ├── deepseek.ts          # DeepSeek
│   │       └── openai-compat.ts     # 通用 OpenAI 兼容接口
│   │
│   ├── components/                  # --- UI 组件 ---
│   │   ├── layout/                  # 布局组件
│   │   │   ├── AppLayout.tsx        # 应用主布局（登录、同步、路由）
│   │   │   ├── Header.tsx           # 顶部导航栏
│   │   │   └── BookSelect.tsx       # 书架页面
│   │   ├── login/
│   │   │   └── UsernameLogin.tsx    # 登录界面
│   │   ├── reader/                  # 阅读组件
│   │   │   ├── ReadingPanel.tsx     # 阅读主面板
│   │   │   ├── ChapterContent.tsx   # 章节内容渲染
│   │   │   └── ChapterNav.tsx       # 章节导航
│   │   ├── summary/                 # AI 分析组件
│   │   │   ├── SummaryPanel.tsx     # AI 分析面板（总结、问答、笔记）
│   │   │   └── CharacterGraph.tsx   # 人物关系图谱可视化
│   │   ├── settings/                # 设置组件
│   │   │   ├── ApiSettings.tsx      # API 配置页面
│   │   │   ├── ProviderSelect.tsx   # 提供商选择
│   │   │   ├── RAGSettings.tsx      # RAG 引擎配置
│   │   │   └── ExportPanel.tsx      # 数据导出
│   │   ├── notes/
│   │   │   └── GlobalNotes.tsx      # 全局笔记管理
│   │   ├── common/                  # 通用组件
│   │   │   ├── BuildProgress.tsx    # RAG 构建进度条
│   │   │   ├── DebugPanel.tsx       # 调试面板
│   │   │   ├── UpdateBanner.tsx     # 版本更新提示
│   │   │   └── ShortcutHelp.tsx     # 快捷键帮助
│   │   └── ui/                      # 基础 UI 组件（按钮、卡片等）
│   │
│   ├── db/                          # --- 浏览器数据库 ---
│   │   ├── database.ts              # Dexie 数据库定义（IndexedDB 表结构）
│   │   └── repositories.ts          # 数据访问层（增删改查封装）
│   │
│   ├── hooks/                       # --- React Hooks ---
│   │   ├── useSummarizer.ts         # AI 分析的核心 Hook（调用 Agent + RAG）
│   │   ├── useFileParser.ts         # 文件解析 Hook
│   │   └── useKeyboardShortcuts.ts  # 键盘快捷键 Hook
│   │
│   ├── lib/                         # --- 工具库 ---
│   │   ├── prompt-templates.ts      # AI 提示词模板
│   │   ├── text-utils.ts            # 文本处理工具
│   │   ├── export.ts                # 数据导出工具
│   │   ├── auth-headers.ts          # 认证请求头
│   │   ├── ai-state.ts              # AI 运行状态标记
│   │   └── utils.ts                 # 通用工具函数
│   │
│   ├── parsers/                     # --- 文件解析器 ---
│   │   ├── txt.ts                   # TXT 文件解析（编码检测）
│   │   ├── epub.ts                  # EPUB 文件解析
│   │   ├── chapter-detector.ts      # 章节标题智能识别
│   │   ├── types.ts                 # 解析器类型定义
│   │   └── utils.ts                 # 解析工具函数
│   │
│   ├── rag/                         # --- RAG 检索模块 ---
│   │   ├── index.ts                 # RAG 入口（buildIndex、retrieveRelevant）
│   │   ├── retriever.ts             # TF-IDF 检索器（纯 JS，离线可用）
│   │   ├── embedding-retriever.ts   # 向量检索器（ONNX 模型）
│   │   ├── engines.ts               # 引擎注册表和元数据
│   │   ├── client-encoder.ts        # 浏览器端查询编码器
│   │   └── model-loader.ts          # 模型文件检测和加载
│   │
│   ├── stores/                      # --- Zustand 状态管理 ---
│   │   ├── api-store.ts             # AI 提供商配置状态
│   │   ├── build-store.ts           # RAG 构建进度状态
│   │   ├── novel-store.ts           # 小说和阅读进度状态
│   │   ├── rag-store.ts             # RAG 引擎配置状态
│   │   ├── summary-store.ts         # AI 总结数据状态
│   │   └── ui-store.ts              # 界面设置状态（主题、字体等）
│   │
│   └── sync/                        # --- 同步模块 ---
│       ├── sync-client.ts           # 同步客户端（心跳、推送、重注册）
│       ├── sync-bridge.ts           # 同步桥接层（收集变更、应用数据）
│       └── types.ts                 # 同步类型定义
│
├── public/                          # ===== 静态资源 =====
│   ├── models/                      # ONNX 模型文件
│   │   ├── builtin/Xenova/          # 内置模型（随项目发布）
│   │   │   ├── bge-small-zh-v1.5/   # BGE 中文语义模型（~26MB）
│   │   │   └── gte-small/           # GTE 中英文模型（~34MB）
│   │   └── custom/Xenova/           # 用户自定义模型目录
│   │       ├── all-MiniLM-L6-v2/    # 英文轻量模型（~23MB）
│   │       ├── multilingual-e5-small/
│   │       └── paraphrase-multilingual-MiniLM-L12-v2/
│   └── favicon.svg
│
├── vite.config.ts                   # Vite 构建配置 + PWA 配置
├── tailwind.config.js               # Tailwind CSS 配置
├── tsconfig.json                    # TypeScript 配置
├── package.json                     # 项目依赖清单
│
├── start.bat / start.sh             # 启动脚本（Windows / macOS Linux）
├── stop.bat / stop.sh               # 停止脚本
├── admin.bat / admin.sh             # 管理后台启动脚本
└── port-mgr.bat / port-mgr.sh       # 端口管理工具
```

---

## 4. 整体架构图

### 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户浏览器                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    React 应用                              │   │
│  │                                                          │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │ 书架    │  │ 阅读面板  │  │ AI 分析   │  │ 设置     │ │   │
│  │  │ BookSelect│ │ Reading  │  │ Summary  │  │ Settings │ │   │
│  │  │         │  │ Panel    │  │ Panel    │  │          │ │   │
│  │  └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │   │
│  │       │            │             │              │        │   │
│  │  ┌────▼────────────▼─────────────▼──────────────▼─────┐  │   │
│  │  │              Zustand 状态管理层                       │  │   │
│  │  │  novelStore | summaryStore | apiStore | uiStore     │  │   │
│  │  └────┬────────────┬─────────────┬──────────────┬─────┘  │   │
│  │       │            │             │              │        │   │
│  │  ┌────▼────┐  ┌────▼─────┐  ┌───▼────┐  ┌─────▼─────┐  │   │
│  │  │ IndexedDB│  │ AI Agent │  │  RAG   │  │   Sync    │  │   │
│  │  │ Dexie   │  │ 系统      │  │ 检索   │  │   同步     │  │   │
│  │  │ 浏览器DB │  │          │  │ 引擎   │  │   客户端   │  │   │
│  │  └─────────┘  └────┬─────┘  └───┬────┘  └─────┬─────┘  │   │
│  │                    │             │              │        │   │
│  └────────────────────┼─────────────┼──────────────┼────────┘   │
│                       │             │              │            │
└───────────────────────┼─────────────┼──────────────┼────────────┘
                        │             │              │
              ┌─────────▼─────────────▼──────────────▼──────────┐
              │              HTTP API (Express 服务器)            │
              │                                                  │
              │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
              │  │ 小说管理  │  │ RAG 构建  │  │ 同步服务       │  │
              │  │ /api/    │  │ /api/rag/ │  │ /api/sync/    │  │
              │  │ novels   │  │           │  │               │  │
              │  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
              │       │             │                 │          │
              │  ┌────▼─────────────▼─────────────────▼───────┐  │
              │  │            SQLite 数据库 (WAL 模式)          │  │
              │  │  novels | chapters | summaries | notes      │  │
              │  │  users | user_novels | reading_progress     │  │
              │  │  user_settings | rag_indices                │  │
              │  └────────────────────────────────────────────┘  │
              └──────────────────────────────────────────────────┘
```

### 数据流图

```
用户操作                   前端处理                    后端处理
─────────                 ─────────                  ─────────
                          ┌─────────┐
上传小说 ──────────────►  │ 文件解析  │ ───────────►  POST /api/novels
                          │ TXT/EPUB │               存入 SQLite
                          └─────────┘

                          ┌─────────┐               ┌─────────┐
点击"构建索引" ─────────►  │ 发送请求  │ ───────────►  │ RAG 构建 │
                          │         │               │ Worker  │
                          │ 轮询进度  │ ◄──────────── │ 线程编码 │
                          │ 下载索引  │ ◄──────────── │ 返回索引 │
                          │ 存入 IDB │               └─────────┘
                          └─────────┘

                          ┌─────────┐
点击"总结本章" ─────────►  │ RAG 检索  │ 本地向量搜索
                          │ 相关段落  │
                          │         │
                          │ 构建提示  │ 把检索结果 + 提示词组装
                          │         │
                          │ 调用 AI  │ ───────────►  POST /api/proxy/chat
                          │ 展示结果  │               代理转发到 AI API
                          │ 存入 IDB │
                          └────┬────┘
                               │
                          ┌────▼────┐               ┌─────────┐
30 秒自动同步 ──────────►  │ 收集变更  │ ───────────►  │ 合并数据 │
                          │ push    │ ◄──────────── │ 返回新数据│
                          │ pull    │               └─────────┘
                          │ 存入 IDB │
                          └─────────┘
```

---

## 5. 前端架构详解

### 5.1 React 组件树

```
App
└── AppLayout                          # 应用主布局
    ├── UsernameLogin                  # 登录界面（未登录时显示）
    ├── Header                         # 顶部导航栏
    │   ├── 返回按钮（阅读时显示）
    │   ├── 书名（阅读时显示）
    │   ├── 笔记按钮
    │   └── 设置按钮
    │
    ├── BookSelect                     # 书架页面（未选书时显示）
    │   ├── 小说卡片列表
    │   ├── 上传区域（拖拽 / 点击）
    │   └── 书库浏览
    │
    ├── ReadingPanel                   # 阅读面板（选书后显示）
    │   ├── ChapterNav                 # 章节目录 + 上下章导航
    │   └── ChapterContent             # 章节正文渲染
    │
    ├── SummaryPanel                   # AI 分析面板（阅读时右侧）
    │   ├── 章节总结
    │   ├── 全书总览
    │   ├── 人物关系分析
    │   ├── 剧情时间线
    │   ├── 范围总结
    │   ├── AI 问答（多轮对话）
    │   └── 笔记管理
    │
    ├── CharacterGraph                 # 人物关系图谱（d3-force）
    ├── ApiSettings                    # 设置页面
    │   ├── ProviderSelect             # AI 提供商配置
    │   ├── RAGSettings               # RAG 引擎配置
    │   └── ExportPanel               # 数据导出
    │
    ├── GlobalNotes                    # 全局笔记（书架页时显示）
    ├── DebugPanel                     # 调试面板（默认隐藏）
    ├── BuildProgress                  # RAG 构建进度弹窗
    ├── ShortcutHelp                   # 快捷键帮助
    └── UpdateBanner                   # 版本更新提示
```

### 5.2 状态管理（Zustand Store）

项目使用 **Zustand** 做全局状态管理。Zustand 是一个轻量级的状态管理库，比 Redux 简单很多。可以把它理解为"全局变量 + 自动更新 UI"。

每个 Store 管理一个特定领域的状态：

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand 状态层                         │
│                                                         │
│  ┌─────────────┐  当前小说、章节列表、阅读进度             │
│  │ novelStore  │  ──────────────────────────► 书架/阅读  │
│  └─────────────┘                                        │
│                                                         │
│  ┌─────────────┐  AI 总结列表、生成进度                   │
│  │summaryStore │  ──────────────────────────► AI 面板    │
│  └─────────────┘                                        │
│                                                         │
│  ┌─────────────┐  AI 提供商配置、API Key                  │
│  │ apiStore    │  ──────────────────────────► 设置/AI    │
│  └─────────────┘                                        │
│                                                         │
│  ┌─────────────┐  RAG 引擎、缓存大小、TopK 配置           │
│  │ ragStore    │  ──────────────────────────► RAG/设置   │
│  └─────────────┘                                        │
│                                                         │
│  ┌─────────────┐  构建状态、进度、错误                     │
│  │ buildStore  │  ──────────────────────────► 进度弹窗   │
│  └─────────────┘                                        │
│                                                         │
│  ┌─────────────┐  主题、字体、离线模式、调试模式            │
│  │ uiStore     │  ──────────────────────────► 全局 UI    │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

各 Store 的持久化策略：
- `apiStore` → IndexedDB `settings` 表（按用户名隔离）
- `uiStore` → localStorage（所有值）
- `ragStore` → localStorage
- `novelStore` → 阅读进度存 localStorage，小说数据在 IndexedDB
- `summaryStore` → 不持久化（从 IndexedDB 加载）
- `buildStore` → 不持久化（运行时状态）

### 5.3 浏览器数据库（IndexedDB / Dexie）

IndexedDB 是浏览器内置的数据库，可以存储大量结构化数据。Dexie 是它的封装库，让 API 更好用。

项目在浏览器中存储以下数据：

| 表名 | 存储内容 | 类比 |
|------|---------|------|
| `novels` | 小说元数据（标题、作者、字数） | 图书馆的书目卡 |
| `chapters` | 章节内容（标题、正文） | 书的每一页 |
| `summaries` | AI 生成的总结 | 读书笔记 |
| `notes` | 用户和 AI 的笔记 | 便利贴 |
| `settings` | 各种配置（API Key、图谱数据等） | 设置文件 |
| `ragCache` | RAG 索引缓存（向量 + 片段） | 搜索引擎的索引 |

---

## 6. 后端架构详解

### 6.1 服务器入口 (`server/index.js`)

服务器使用 **Express** 框架，监听 3001 端口。它做以下几件事：

1. **提供 API 接口**：小说管理、RAG 构建、同步、代理转发
2. **提供静态文件**：生产模式下直接提供前端构建产物
3. **定时任务**：WAL checkpoint（每小时）、数据库备份（每 24 小时）

```
Express 服务器 (端口 3001)
│
├── 中间件
│   ├── CORS（限制 localhost + 局域网 IP）
│   ├── JSON body 解析（限制 10MB）
│   └── 请求日志
│
├── API 路由
│   ├── /api/novels/*      小说 CRUD
│   ├── /api/rag/*         RAG 索引构建和查询
│   ├── /api/sync/*        多设备同步
│   ├── /api/proxy/chat    AI API 代理
│   └── /api/admin/*       管理后台
│
├── 定时任务
│   ├── WAL checkpoint     每小时整理数据库日志
│   └── 数据库备份          每 24 小时备份，保留 7 天
│
└── 静态文件服务
    └── dist/              前端构建产物（生产模式）
```

### 6.2 数据库 (`server/database.js`)

使用 **SQLite** 数据库，开启 **WAL（Write-Ahead Logging）模式**提高并发性能。

WAL 模式简单解释：普通模式下，读写操作会互相阻塞。WAL 模式让读和写可以同时进行，就像图书馆可以同时有人借书和还书。

```
SQLite 数据库 (data/novels.db)
│
├── WAL 模式：读写不阻塞
├── 自动备份：每 24 小时，保留 7 天
└── WAL checkpoint：每小时整理日志文件
```

### 6.3 RAG 构建器 (`server/rag-builder.js`)

RAG 构建是一个 CPU 密集型任务（要把小说文本编码成向量），所以放在 **Worker 线程**中执行，不阻塞主线程。

```
主线程 (index.js)              Worker 线程 (rag-worker.mjs)
────────────────              ─────────────────────────
发起构建请求 ───────────────►  加载 ONNX 模型
                               分批编码文本（每批 16 个片段）
轮询进度 ◄───────────────────  报告进度
                               编码完成，返回向量
存储到 SQLite ◄─────────────── 返回结果
```

构建队列：
- 最多同时 10 个构建任务排队
- 同时只执行 1 个构建（串行执行）
- 超时时间：`max(10分钟, 片段数 × 300毫秒)`，上限 120 分钟

---

## 7. 用户完整使用流程

### 7.1 首次使用流程

```
用户打开浏览器访问 http://localhost:5173
│
▼
┌─────────────────────────────────────┐
│ 步骤 1：登录                         │
│                                     │
│  ┌──────────┐    ┌──────────┐      │
│  │ 创建新用户 │    │ 加入已有  │      │
│  │ 输入用户名 │    │ 输入用户名 │      │
│  │ 自动创建   │    │ 恢复数据  │      │
│  └────┬─────┘    └────┬─────┘      │
│       └───────┬───────┘            │
│               ▼                     │
│       同步服务器数据到本地            │
│       显示书架页面                   │
└─────────────────────────────────────┘
│
▼
┌─────────────────────────────────────┐
│ 步骤 2：配置 AI                      │
│                                     │
│  右上角 → 设置                       │
│  选择提供商（OpenAI / Anthropic /    │
│           DeepSeek / 自定义）        │
│  填写 API Key                       │
│  填写模型名称                        │
│  保存                               │
└─────────────────────────────────────┘
│
▼
┌─────────────────────────────────────┐
│ 步骤 3：上传小说                     │
│                                     │
│  书架页面 → 拖拽 TXT/EPUB 文件       │
│  或点击"从文件夹导入"批量导入         │
│  系统自动：                          │
│    • 检测编码（GBK/Big5/UTF-8）      │
│    • 识别章节标题                    │
│    • 上传到服务器                    │
└─────────────────────────────────────┘
│
▼
┌─────────────────────────────────────┐
│ 步骤 4：构建 RAG 索引（可选但推荐）   │
│                                     │
│  书架卡片 → 点击"构建"按钮           │
│  服务器异步处理（1-30 分钟）          │
│  完成后自动下载到浏览器缓存           │
│  之后 AI 分析会更精准                │
└─────────────────────────────────────┘
│
▼
┌─────────────────────────────────────┐
│ 步骤 5：开始阅读 + AI 分析           │
│                                     │
│  点击小说进入阅读                    │
│  右上角打开 AI 面板                  │
│  选择功能：总结 / 图谱 / 时间线 / 问答│
└─────────────────────────────────────┘
```

### 7.2 日常使用流程

```
用户打开浏览器
│
▼
Service Worker 检测到已缓存的应用
│
▼
自动登录（从 localStorage 读取会话）
│
├── 服务器在线 → 心跳 + 同步 → 显示书架
│
└── 服务器离线 → 离线模式 → 显示书架
    （已缓存的数据仍可使用）
│
▼
点击小说 → 进入阅读 → 打开 AI 面板 → 分析 / 问答
│
▼
每 30 秒自动同步阅读进度和笔记到服务器
```

---

## 8. 功能详解与流程图

### 8.1 文件上传与解析

#### 支持的格式

| 格式 | 编码支持 | 章节识别 |
|------|---------|---------|
| TXT | UTF-8、GBK、Big5（自动检测） | 智能识别中文章节标题 |
| EPUB | UTF-8（EPUB 标准编码） | 从目录结构提取 |

#### 解析流程

```
用户拖拽文件到书架
│
▼
┌─────────────────────────────┐
│ useFileParser Hook           │
│                             │
│ 1. 判断文件格式              │
│    ├── .txt → TXT 解析器    │
│    └── .epub → EPUB 解析器  │
│                             │
│ 2. TXT 解析流程：            │
│    a. 读取文件为 ArrayBuffer │
│    b. 检测编码（chardet）    │
│    c. 按编码解码为文本       │
│    d. 调用章节检测器         │
│                             │
│ 3. EPUB 解析流程：           │
│    a. 用 JSZip 解压         │
│    b. 读取 container.xml    │
│    c. 解析 OPF 获取章节列表  │
│    d. 提取各章节 XHTML 内容  │
│    e. 去除 HTML 标签        │
│                             │
│ 4. 章节检测（chapter-detector）：│
│    正则匹配中文标题模式：     │
│    "第X章"、"第X回"、        │
│    "Chapter X"、数字开头等   │
│    未匹配到则按 5000 字分割  │
└─────────────────────────────┘
│
▼
解析结果：{ title, chapters: [{ title, content }] }
│
▼
POST /api/novels  →  服务端存入 SQLite
│
▼
本地 IndexedDB 也存一份 → 更新书架 UI
```

### 8.2 阅读功能

#### 阅读设置

| 设置项 | 范围 | 持久化 |
|--------|------|--------|
| 字号 | 12-32px | localStorage |
| 字重 | 100-900 | localStorage |
| 行距 | 1.2-2.4 | localStorage |
| 段距 | 0-20px | localStorage |
| 字体 | 系统默认 / 宋体 / 楷体 / 等宽 | localStorage |
| 主题 | 亮色 / 暗色 | localStorage |

#### 阅读进度保存

```
用户翻到新章节
│
▼
novelStore.setSelectedChapter(chapterId)
│
├── 更新 UI 显示
│
├── 保存到 localStorage
│   key: "novel-reader-reading-position-{novelId}"
│   value: { chapterId, chapterIndex, timestamp }
│
└── 触发 syncClient.pushNow()
    └── 立即同步到服务器
```

### 8.3 AI 分析功能

#### AI 分析总览

所有 AI 分析功能都通过 `useSummarizer` Hook 协调。核心流程是：

```
用户点击分析按钮
│
▼
useSummarizer 对应函数
│
├── 1. RAG 检索相关文本（getRelevantText）
│      ├── 加载 RAG 索引（缓存优先）
│      ├── 用查询文本检索最相关的段落
│      └── 返回拼接好的文本
│
├── 2. 调用对应 Agent
│      ├── Agent 组装提示词（prompt）
│      │   ├── 系统提示（角色设定）
│      │   ├── 小说元数据（书名、章节数）
│      │   ├── RAG 检索结果 或 章节样本
│      │   └── 用户指令（分析要求）
│      │
│      └── Agent 调用 AI API
│          └── POST /api/proxy/chat（代理转发）
│
├── 3. 保存结果到 IndexedDB
│
└── 4. 同步到服务器
```

#### 各分析功能对比

| 功能 | 输入 | AI 收到的内容 | 输出 |
|------|------|--------------|------|
| 本章分析 | 单章 ID | 该章全文 | 核心情节、人物、伏笔 |
| 全书总览 | 整本书 | 章节目录 + RAG 检索段落 | 故事主线、主题、结构 |
| 人物关系 | 整本书 | 章节目录 + RAG 检索段落 | 角色列表、关系网络 |
| 人物图谱 | 整本书 | 章节目录 + RAG 检索段落 | JSON 格式的节点+边 |
| 时间线 | 整本书 | 章节目录 + RAG 检索段落 | 15-25 个关键事件 |
| 范围总结 | 章节范围 | RAG 检索该范围的段落 | 核心情节、事件、人物 |
| AI 问答 | 用户问题 | 章节目录 + RAG 检索段落 + 对话历史 | 回答文本 |

#### AI 提供商调用流程

```
Agent 需要调用 AI
│
▼
getProvider(config) 获取提供商实例
│
▼
检查离线模式
├── 离线模式 ON → doDirect()（直连 AI API）
└── 离线模式 OFF → 有 token?
    ├── 有 → fetch("/api/proxy/chat")（通过服务器代理）
    └── 无 → doDirect()（直连）
│
▼
服务器代理流程：
POST /api/proxy/chat
│
├── 服务器接收请求
├── 转发到实际 AI API（OpenAI / Anthropic / DeepSeek）
├── 收到响应
└── 返回给前端
│
▼
前端解析响应
├── 提取回复内容
├── 提取 token 使用量
└── 返回给 Agent
```

#### 人物关系图谱

人物关系图谱使用 **d3-force** 力导向图算法：

```
AI 返回 JSON 格式的图谱数据
│
{
  "nodes": [
    { "id": "张无忌", "group": "主角", "description": "明教教主" },
    { "id": "赵敏", "group": "主角", "description": "蒙古郡主" }
  ],
  "edges": [
    { "source": "张无忌", "target": "赵敏", "label": "恋人" }
  ]
}
│
▼
CharacterGraph 组件渲染
│
├── 创建 SVG 画布
├── 初始化 d3-force 力导向布局
│   ├── forceLink（边的弹力）
│   ├── forceManyBody（节点间的斥力）
│   ├── forceCenter（居中）
│   └── forceCollide（防碰撞）
│
├── 绘制节点（圆形 + 文字）
├── 绘制边（线条 + 标签）
│
└── 交互功能
    ├── 鼠标拖拽移动节点
    ├── 鼠标滚轮缩放
    ├── 移动端双指缩放
    └── 全屏模式
```

### 8.4 笔记系统

```
笔记来源                    存储                     展示
──────────                 ─────                    ────
用户手动写 ──► source: "user" ──┐
                                ├──► IndexedDB notes 表 ──► 章节笔记 / 全书笔记
AI 回答收藏 ─► source: "ai"  ──┘                           / 全局笔记页面

笔记属性：
- novelId    属于哪本小说
- chapterId  属于哪章（__book__ 表示全书笔记）
- content    笔记内容
- source     来源（user / ai）
- deleted    软删除标记（同步用）
```

### 8.5 数据导出

```
设置页 → 导出面板
│
├── 导出全部数据
│   ├── 读取 IndexedDB 所有表
│   ├── 排除 API Key（安全考虑）
│   └── 生成 JSON 文件下载
│
├── 单本导出
│   ├── 选择小说
│   ├── JSON 格式：小说 + 章节 + 总结 + 笔记
│   └── TXT 格式：纯文本导出
│
├── 导入备份
│   ├── 读取 JSON 文件
│   ├── 写入 IndexedDB
│   └── 同步到服务器
│
└── 存储用量
    └── navigator.storage.estimate()
        显示已用 / 可用空间
```

---

## 9. 多设备同步系统

### 9.1 同步架构

```
设备 A (浏览器)                 服务器                    设备 B (浏览器)
─────────────                 ────────                  ─────────────
IndexedDB A ◄────────────►  SQLite  ◄────────────►  IndexedDB B
   (Dexie)        push/pull   (better-sqlite3)    push/pull    (Dexie)
```

### 9.2 会话生命周期

```
用户输入用户名
│
▼
POST /api/sync/register
│
├── mode: "create" → 创建新用户
│   ├── 检查用户名是否已存在
│   ├── 创建用户记录
│   ├── 生成 clientId（24位十六进制）
│   ├── 生成 token（48位十六进制）
│   └── 返回 { clientId, token, isNew: true, activeCount: 1 }
│
└── mode: "join" → 加入已有用户
    ├── 检查用户名是否存在
    ├── 踢掉旧会话（如果有的话）
    ├── 生成新的 clientId + token
    └── 返回 { clientId, token, isNew: false, activeCount: 1 }
│
▼
客户端保存会话信息到 localStorage
├── sync-username
├── sync-clientId
└── sync-token
│
▼
启动定时任务
├── 心跳：每 15 秒
└── 同步：每 30 秒
```

### 9.3 心跳机制

```
每 15 秒
│
▼
POST /api/sync/heartbeat
body: { username, clientId, token }
│
▼
服务器检查
├── token 有效？
│   ├── 否 → 返回 401（会话过期）
│   └── 是 ↓
├── clientId 是当前活跃会话？
│   ├── 否 → 返回 403（被踢下线）
│   └── 是 ↓
├── 更新最后活跃时间
└── 返回 { activeCount: N }
│
▼
客户端处理响应
├── 401/403 → 尝试重新注册
│   ├── 成功 → 用新凭证继续
│   └── 失败 → handleKicked()（清除本地数据，提示下线）
│
├── activeCount === 0 → 尝试重新注册
│
└── 正常 → 更新连接数显示
```

### 9.4 数据同步流程

```
每 30 秒（或 pushNow() 触发）
│
▼
检查条件
├── 离线模式？ → 跳过
├── AI 正在运行？ → 跳过
└── 正在重注册？ → 跳过
│
▼
┌─────────────────────────────────┐
│ gatherChanges(lastSyncTime)     │
│                                 │
│ 从 IndexedDB 收集变更：          │
│ ├── summaries                   │
│ │   WHERE updatedAt > lastSync  │
│ ├── notes                       │
│ │   WHERE updatedAt > lastSync  │
│ ├── settings                    │
│ │   只同步图谱数据，不同步 API Key│
│ └── readingProgress             │
│     从 localStorage 读取        │
└─────────────────────────────────┘
│
▼
POST /api/sync/push
body: { username, clientId, token, changes, lastSyncTime }
│
▼
┌─────────────────────────────────┐
│ 服务器 mergeAndSave()            │
│                                 │
│ 1. 验证会话有效性                │
│                                 │
│ 2. 在事务中应用客户端变更：       │
│    ├── summaries                 │
│    │   INSERT ... ON CONFLICT    │
│    │   DO UPDATE SET ...         │
│    │   WHERE @updatedAt >=       │
│    │         updated_at          │
│    │   （新的覆盖旧的）           │
│    ├── notes（同上）             │
│    ├── settings（同上）          │
│    └── readingProgress（同上）   │
│                                 │
│ 3. 查询服务器上 lastSyncTime     │
│    之后的所有变更                │
│                                 │
│ 4. 返回变更数据给客户端          │
└─────────────────────────────────┘
│
▼
客户端 applyServerData(serverData)
│
├── 对每条记录比较 updatedAt
│   ├── 服务器更新 → 写入本地
│   └── 本地更新   → 保留本地
│
├── 合并阅读进度到 localStorage
│
└── 更新 lastSyncTime
```

### 9.5 冲突解决策略

本项目使用**最后写入者胜出（Last-Write-Wins）**策略：

```
设备 A 在 10:00 修改了笔记（updatedAt = 10:00）
设备 B 在 10:05 修改了同一条笔记（updatedAt = 10:05）

同步时：
├── 设备 A 推送 → 服务器记录 updatedAt = 10:00
└── 设备 B 推送 → 服务器记录 updatedAt = 10:05（更新，覆盖 A 的版本）

下次设备 A 同步时：
└── 拉取到 B 的版本（10:05 > 10:00），A 的本地数据被更新
```

### 9.6 软删除

删除操作不会真正删除数据，而是标记 `deleted = 1`：

```
用户删除一条笔记
│
▼
本地 IndexedDB：设置 deleted = 1，更新 updatedAt
│
▼
同步时推送到服务器
│
▼
服务器也标记 deleted = 1
│
▼
其他设备拉取时看到 deleted = 1 → 在本地也标记删除
```

### 9.7 服务器重启恢复

```
服务器重启
│
▼
所有客户端的 token 失效（内存中的会话丢失）
│
▼
客户端下次心跳/同步时收到 401
│
▼
客户端 tryReRegister()
├── 用已知的 username 发送 POST /api/sync/register (mode: "join")
├── 服务器创建新会话，返回新 clientId + token
├── 客户端保存新凭证
└── 用 lastSyncTime = 0 触发全量同步
│
▼
全量同步拉取服务器所有数据 → 恢复正常
```

---

## 10. RAG 语义检索系统

### 10.1 什么是 RAG？

**RAG = Retrieval-Augmented Generation（检索增强生成）**

传统 AI 问答的问题：
```
用户：张无忌在光明顶做了什么？
AI：抱歉，我没有这本书的内容，无法回答。
```

RAG 的解决方案：
```
用户：张无忌在光明顶做了什么？
│
├── 1. 检索：从书中找到最相关的 30 个段落
│      "张无忌挺身而出，以九阳神功化解了六大派的围攻..."
│      "光明顶一战，张无忌展现出了惊人的武功..."
│      ...
│
├── 2. 增强：把检索结果 + 用户问题一起发给 AI
│      "以下是小说中的相关段落：[段落1][段落2]...
│       请根据这些内容回答：张无忌在光明顶做了什么？"
│
└── 3. 生成：AI 基于实际内容回答
       "张无忌在光明顶以九阳神功和乾坤大挪移化解了
        六大派对明教的围攻，展现出惊人的武功和领袖气质..."
```

### 10.2 两种检索引擎

#### 引擎对比

| 特性 | TF-IDF | BGE Small ZH |
|------|--------|-------------|
| **原理** | 字符级关键词匹配 | 深度语义理解 |
| **依赖** | 无（纯 JS） | ONNX 模型（~26MB） |
| **速度** | 毫秒级 | 秒级（首次需加载模型） |
| **离线** | 完全离线 | 需要构建索引 |
| **精度** | 能找到包含相同词的段落 | 能理解同义词和语义 |
| **示例** | "张无忌" → 只找含"张无忌"的段落 | "那个少年" → 也能找到张无忌相关段落 |

#### TF-IDF 引擎详解

TF-IDF 是一种经典的文本检索算法，本项目的实现完全用 JavaScript 编写，零依赖。

```
文本预处理
│
▼
中文分词：字符二元组（bigram）
例如："张无忌光明顶" → ["张无", "无忌", "忌光", "光明", "明顶"]
│
▼
计算每个片段的 BM25 分数
├── TF（词频）：这个词在这个片段中出现多少次
├── IDF（逆文档频率）：这个词在多少个片段中出现（越少越重要）
└── BM25 公式：综合 TF 和 IDF 的加权分数
│
▼
每个片段生成 128 维向量
│
▼
查询时：
├── 把查询文本也转成 128 维向量
├── 计算查询向量和所有片段向量的余弦相似度
└── 返回相似度最高的 top-K 个片段
```

#### BGE 向量引擎详解

BGE（BAAI General Embedding）是北京智源人工智能研究院的语义向量模型。

```
文本输入："张无忌在光明顶化解了六大派的围攻"
│
▼
Tokenizer：把文本切成 token（模型能理解的最小单元）
│
▼
ONNX 模型推理：512 层神经网络计算
│
▼
输出：512 维浮点数向量
[0.023, -0.156, 0.089, ..., 0.234]
│
▼
这个向量代表了这句话的"语义"
语义相似的句子，向量距离更近
```

**向量相似度计算：**

```
查询："那个少年在山顶做了什么？"
→ 编码为向量 Q = [0.1, 0.3, -0.2, ...]

片段 1："张无忌挺身而出..." 
→ 向量 D1 = [0.12, 0.28, -0.18, ...]
→ 相似度 = Q · D1 = 0.95（很高）

片段 2："赵敏看着他离去..."
→ 向量 D2 = [-0.3, 0.1, 0.5, ...]
→ 相似度 = Q · D2 = 0.23（较低）

结果：片段 1 排在前面
```

### 10.3 可用引擎列表

| 引擎 ID | 名称 | 维度 | 大小 | 说明 |
|---------|------|------|------|------|
| `tfidf` | TF-IDF | 128 | 0 MB | 纯 JS，瞬间可用 |
| `bge-small-zh` | BGE Small 中文 | 512 | ~26 MB | **推荐**，中文最佳 |
| `gte-small` | GTE Small | 384 | ~34 MB | 中英文均衡 |
| `Xenova/multilingual-e5-small` | E5 Small | 384 | ~120 MB | 多语言 |
| `Xenova/all-MiniLM-L6-v2` | MiniLM | 384 | ~23 MB | 英文轻量 |
| `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | MiniLM L12 | 384 | ~120 MB | 多语言深度 |

### 10.4 索引构建流程

```
用户点击"构建"按钮
│
▼
POST /api/rag/{novelId}/build
body: { engine: "bge-small-zh" }
│
▼
服务器 rag-builder.js
│
├── 1. 分块（Chunking）
│      把小说文本切成 500 字的片段，重叠 100 字
│      每个片段前缀加章节标题："[第一章 张无忌] 那一日..."
│
├── 2. 编码（Encoding）
│      启动 Worker 线程
│      加载 ONNX 模型
│      每批 16 个片段并行编码
│      每个片段 → 512 维向量
│
├── 3. 存储
│      片段列表 → JSON 存入 chunks_json
│      向量数组 → Float32Array 存入 vectors_blob
│      状态更新为 "ready"
│
└── 4. 客户端下载
       GET /api/rag/{novelId}/index
       返回 { chunks, vectors（base64）, dim }
       客户端存入 IndexedDB ragCache 表
```

### 10.5 检索流程（完整链路）

```
用户提问或触发分析
│
▼
getRelevantText(query)
│
├── 1. 加载索引
│      ├── 检查内存缓存（indexCache Map）→ 命中则直接用
│      ├── 检查 IndexedDB 缓存（ragCache 表）→ 命中则加载
│      ├── 检查服务器状态 → 服务器有则下载
│      └── 都没有 → 降级为 TF-IDF
│
├── 2. 查询编码
│      ├── 尝试服务器编码 POST /api/rag/encode
│      │   └── 服务器用 ONNX 模型编码
│      │
│      ├── 服务器不可用 → 浏览器端编码
│      │   └── client-encoder.ts
│      │       用 Transformers.js 加载本地 ONNX 模型
│      │       首次加载约 4-6 秒，之后缓存在内存
│      │
│      └── 都失败 → 返回空
│
├── 3. 向量搜索
│      计算查询向量和所有文档向量的点积
│      按相似度排序
│      取 top-K 个结果
│
├── 4. 格式化结果
│      "[相关度: 0.952] 第一章 张无忌...那段文本"
│      "---"
│      "[相关度: 0.847] 第三章 光明顶...那段文本"
│      ...
│
└── 5. 返回给 Agent
       Agent 把这些段落放进提示词发给 AI
```

### 10.6 三级缓存架构

```
查询一个片段
│
├── L1: 内存缓存（LRU Cache）
│   ├── 最快，直接从 JS 对象读取
│   ├── 大小限制：100-500 MB（可配置）
│   ├── 淘汰策略：最近最少使用（LRU）
│   └── 生命周期：页面关闭即清空
│
├── L2: 浏览器缓存（IndexedDB ragCache 表）
│   ├── 持久化，关闭浏览器再打开仍在
│   ├── 每本书约 1-3 MB
│   └── 生命周期：手动清除或存储空间不足
│
├── L3: 服务器索引（SQLite rag_indices 表）
│   ├── 服务端持久化
│   ├── 新设备登录时自动下载
│   └── 生命周期：随服务器数据保留
│
└── 都没有 → 需要重新构建
```

### 10.7 Top-K 配置

Top-K 是检索时返回的最相关片段数量。项目支持分层配置：

| 片段总数 | 默认 Top-K | 说明 |
|---------|-----------|------|
| ≤ 200 | 15 | 短篇小说，15 个片段足够 |
| ≤ 1000 | 30 | 中篇小说 |
| ≤ 5000 | 50 | 长篇小说 |
| > 5000 | 80 | 超长篇（如网络小说） |

可以在设置页自定义这些值。

---

## 11. 数据库设计

### 11.1 服务端 SQLite 表结构

#### novels 表（小说）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID） |
| title | TEXT | 书名 |
| author | TEXT | 作者（可空） |
| file_name | TEXT | 原始文件名 |
| file_format | TEXT | 格式（txt/epub） |
| total_chars | INTEGER | 总字数 |
| chapter_count | INTEGER | 章节数 |
| created_at | INTEGER | 创建时间（时间戳） |
| updated_at | INTEGER | 更新时间（时间戳） |

#### chapters 表（章节）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID） |
| novel_id | TEXT | 外键 → novels(id)，级联删除 |
| index_num | INTEGER | 章节序号 |
| title | TEXT | 章节标题 |
| content | TEXT | 章节正文 |
| start_offset | INTEGER | 原文件中的字节偏移起始 |
| end_offset | INTEGER | 原文件中的字节偏移结束 |

索引：`idx_chapters_novel` on (novel_id, index_num)

#### users 表（用户）

| 列名 | 类型 | 说明 |
|------|------|------|
| username | TEXT | 主键（用户名） |
| created_at | INTEGER | 创建时间 |

#### user_novels 表（用户-小说关联）

| 列名 | 类型 | 说明 |
|------|------|------|
| username | TEXT | 联合主键之一 |
| novel_id | TEXT | 联合主键之一，外键 → novels(id) |
| added_at | INTEGER | 加入时间 |

#### reading_progress 表（阅读进度）

| 列名 | 类型 | 说明 |
|------|------|------|
| username | TEXT | 联合主键之一 |
| novel_id | TEXT | 联合主键之一 |
| chapter_id | TEXT | 当前章节 ID |
| chapter_index | INTEGER | 当前章节序号 |
| last_opened | INTEGER | 最后打开时间 |

#### summaries 表（AI 总结）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID） |
| novel_id | TEXT | 所属小说 |
| chapter_id | TEXT | 所属章节（全书总结为空） |
| chapter_title | TEXT | 章节标题 |
| username | TEXT | 所属用户 |
| content | TEXT | 总结内容 |
| tokens_used | INTEGER | 消耗的 token 数 |
| created_at | INTEGER | 创建时间 |
| updated_at | INTEGER | 更新时间 |
| type | TEXT | 类型：chapter/global/timeline/characters |
| deleted | INTEGER | 软删除标记（0/1） |
| used_fallback | INTEGER | 是否使用了精简模式（0/1） |

索引：`idx_summaries_novel_user` on (novel_id, username, type)

#### notes 表（笔记）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键（UUID） |
| novel_id | TEXT | 所属小说 |
| chapter_id | TEXT | 所属章节（全书笔记为空） |
| chapter_title | TEXT | 章节标题 |
| username | TEXT | 所属用户 |
| content | TEXT | 笔记内容 |
| source | TEXT | 来源：user / ai |
| source_label | TEXT | 来源标签 |
| created_at | INTEGER | 创建时间 |
| updated_at | INTEGER | 更新时间 |
| deleted | INTEGER | 软删除标记（0/1） |

#### user_settings 表（用户设置）

| 列名 | 类型 | 说明 |
|------|------|------|
| username | TEXT | 联合主键之一 |
| key | TEXT | 联合主键之一 |
| value | TEXT | JSON 序列化的值 |

#### rag_indices 表（RAG 索引）

| 列名 | 类型 | 说明 |
|------|------|------|
| novel_id | TEXT | 联合主键之一，外键 → novels(id) |
| engine | TEXT | 联合主键之一，引擎名称 |
| status | TEXT | 状态：none/building/encoding/ready/error |
| chunks_json | TEXT | 片段列表（JSON 数组） |
| vectors_blob | BLOB | 向量数据（Float32Array 二进制） |
| dim | INTEGER | 向量维度 |
| chunk_count | INTEGER | 片段数量 |
| build_time | INTEGER | 构建耗时（毫秒） |
| error_msg | TEXT | 错误信息 |

### 11.2 浏览器 IndexedDB 表结构

IndexedDB 表结构与 SQLite 基本对应，但有一些差异：

| IndexedDB 表 | 对应 SQLite 表 | 差异 |
|-------------|---------------|------|
| novels | novels | 字段名用驼峰（novelId vs novel_id） |
| chapters | chapters | 同上 |
| summaries | summaries | 多了 usedFallback 字段 |
| notes | notes | 同上 |
| settings | user_settings | 不按用户隔离（本地只有一个用户） |
| ragCache | ragCache | 浏览器端缓存，服务器端是 rag_indices |

---

## 12. API 接口全览

### 12.1 小说管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/novels` | 获取所有小说列表 | 无 |
| GET | `/api/novels?username=xxx` | 获取小说列表（含加入状态） | 无 |
| GET | `/api/novels/:id` | 获取小说元数据 | 无 |
| GET | `/api/novels/:id/chapters` | 获取所有章节（含内容） | 需要 |
| POST | `/api/novels` | 上传小说 | 需要 |
| POST | `/api/novels/:id/join` | 加入书架 | 需要 |
| POST | `/api/novels/:id/leave` | 移出书架 | 需要 |

### 12.2 RAG 检索

| 方法 | 路径 | 说明 | 限流 |
|------|------|------|------|
| GET | `/api/rag/test` | 测试引擎 | 5次/分钟 |
| POST | `/api/rag/encode` | 编码查询文本 | 30次/分钟 |
| GET | `/api/rag/statuses` | 批量查询构建状态 | 无 |
| GET | `/api/rag/:novelId/status` | 查询单本构建状态 | 无 |
| POST | `/api/rag/:novelId/build` | 触发构建 | 5次/分钟 |
| GET | `/api/rag/:novelId/index` | 下载构建好的索引 | 无 |

### 12.3 同步

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync/register` | 注册/登录 |
| POST | `/api/sync/heartbeat` | 心跳保活 |
| POST | `/api/sync/push` | 推送+拉取变更 |
| POST | `/api/sync/disconnect` | 断开连接 |
| GET | `/api/sync/status` | 健康检查 |

### 12.4 代理

| 方法 | 路径 | 说明 | 限流 |
|------|------|------|------|
| POST | `/api/proxy/chat` | 代理 AI API 调用 | 60次/分钟 |

### 12.5 管理后台

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/stats` | 系统统计 |
| GET | `/api/admin/users` | 用户列表 |
| DELETE | `/api/admin/users/:name` | 删除用户 |
| GET | `/api/admin/novels` | 小说列表 |
| DELETE | `/api/admin/novels/:id` | 删除小说 |
| GET | `/api/admin/settings` | 获取设置 |
| PUT | `/api/admin/settings/timeout` | 设置超时 |

---

## 13. 安全机制

### 13.1 认证

```
登录时：
POST /api/sync/register
│
▼
服务器生成：
├── clientId: 24 位随机十六进制
└── token: 48 位随机十六进制
    过期时间：24 小时
│
▼
客户端存储到 localStorage
├── sync-username
├── sync-clientId
└── sync-token
│
▼
后续请求带上 token
POST /api/sync/push
headers: { username, clientId, token }
│
▼
服务器验证 token 有效性
```

### 13.2 单设备在线

```
用户 A 在设备 1 登录
│
▼
用户 A 在设备 2 登录
│
▼
服务器删除设备 1 的会话
│
▼
设备 1 下次心跳时发现会话已失效
│
▼
设备 1 提示"该账号已在另一设备登录"
│
▼
设备 1 清除本地数据
```

### 13.3 API Key 保护

```
API Key 存储位置：浏览器 IndexedDB settings 表
│
├── 按用户名隔离
│   key: "api-providers:{username}"
│
├── 不上传到服务器
│   gatherChanges() 跳过 api-providers 和 api-active-provider
│
├── 被踢下线时保留
│   handleKicked() 清除数据前先保存 API Key
│   清除后恢复
│
└── 不同步
    applyServerData() 跳过 api-* 相关的 settings
```

### 13.4 网络安全

| 机制 | 说明 |
|------|------|
| CORS | 仅允许 localhost 和局域网 IP |
| CSP | connect-src 限制为同源请求 |
| 请求体限制 | 10MB 上限 |
| 限流 | RAG 构建 5次/分，编码 30次/分，代理 60次/分 |
| 输入校验 | 用户名 2-30 字符，文本长度限制 |

### 13.5 数据隔离

```
用户 A 的数据                用户 B 的数据
────────────                ────────────
summaries 表                summaries 表
WHERE username = 'A'        WHERE username = 'B'

notes 表                    notes 表
WHERE username = 'A'        WHERE username = 'B'

reading_progress 表         reading_progress 表
WHERE username = 'A'        WHERE username = 'B'
```

每个用户只能看到自己的总结、笔记和阅读进度。

---

## 14. 构建与部署

### 14.1 两种运行模式

| 模式 | 命令 | 说明 |
|------|------|------|
| 模式 1：开发 | `start.bat` → 选 1 | Vite 开发服务器，代码热更新 |
| 模式 2：生产 | `start.bat` → 选 2 | 先构建再启动，稳定适合手机访问 |

#### 模式 1（开发模式）

```
start.bat → 选 1
│
├── 启动 Express 服务器（端口 3001）
│   └── 提供 API 接口
│
└── 启动 Vite 开发服务器（端口 5173）
    ├── 代码热更新（改代码自动刷新）
    ├── /api 请求代理到 3001
    └── 直接从 src/ 目录编译（不打包）
```

#### 模式 2（生产模式）

```
start.bat → 选 2
│
├── npm run build
│   ├── Vite 编译 TypeScript → JavaScript
│   ├── 压缩、打包、tree-shaking
│   ├── 生成 Service Worker
│   └── 输出到 dist/ 目录
│
└── 启动 Express 服务器（端口 3001）
    ├── 提供 API 接口
    └── 提供 dist/ 目录的静态文件
        └── 直接访问 http://localhost:3001
```

### 14.2 PWA（渐进式 Web 应用）

项目通过 `vite-plugin-pwa` 生成 Service Worker，实现：

```
Service Worker 缓存策略
│
├── 预缓存（构建时生成）
│   ├── *.js    JavaScript 文件
│   ├── *.css   样式文件
│   ├── *.html  页面文件
│   └── *.svg   图标文件
│
├── 运行时缓存
│   ├── *.onnx          模型文件 → CacheFirst（优先用缓存）
│   ├── *.json          模型配置 → CacheFirst（优先用缓存）
│   └── /api/(非sync/)  API 请求 → NetworkFirst（优先用网络，3秒超时）
│
└── 更新策略
    ├── registerType: "prompt"
    ├── 有新版本时提示用户更新
    └── 用户确认后激活新 SW
```

### 14.3 环境要求

| 项目 | 要求 |
|------|------|
| Node.js | 18-22 LTS（24+ 有编译问题） |
| npm | 随 Node.js 安装 |
| 操作系统 | Windows / macOS / Linux |
| 浏览器 | Chrome 86+ / Edge 86+ / Firefox 120+ / Safari 15+ |
| 内存 | 建议 2GB+（ONNX 模型加载时峰值约 2GB） |
| 磁盘 | 数据库 + 备份约 100MB，模型文件约 100MB |

### 14.4 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/AscendJK/ai-novel-reader.git
cd ai-novel-reader

# 2. 安装依赖（自动执行）
npm install

# 3. 启动
# Windows：双击 start.bat → 选 1 或 2
# macOS/Linux：./start.sh → 选 1 或 2

# 4. 打开浏览器
# 模式 1：http://localhost:5173
# 模式 2：http://localhost:3001
```

---

## 15. 常见问题

### Q: npm install 失败，提示 better-sqlite3 编译错误

**原因**：`better-sqlite3` 是原生模块，Node.js 24+ 没有预编译二进制。

**解决**：
```bash
# 安装 nvm 后
nvm install 22
nvm use 22
# 重新运行 start.bat
```

### Q: 服务器重启后前端显示"该账号已在另一设备登录"

**原因**：服务器重启后内存中的会话丢失，但客户端的 token 还在。

**解决**：客户端会自动重新注册，无需手动操作。如果没自动恢复，刷新页面即可。

### Q: 离线模式下 AI 分析不可用

**原因**：离线模式下仍需直连 AI API（如 OpenAI）。如果完全没有网络，AI 分析不可用。但 RAG 语义检索在离线模式下可用（使用浏览器缓存的索引）。

### Q: 构建索引很慢

**原因**：ONNX 模型需要逐片段编码，CPU 密集型任务。

**参考时间**：
- 100 章小说：约 1-3 分钟
- 1000 章小说：约 10-30 分钟
- 构建期间不影响正常阅读

### Q: 如何使用自定义模型？

1. 从 Hugging Face 下载 Xenova 转换版模型的 4 个文件
2. 放到 `public/models/custom/Xenova/你的模型名/`
3. 重启 dev server → 设置页点击"扫描" → 发现后点击选用

### Q: 如何备份数据？

- **设置页导出**：导出全部数据为 JSON 文件
- **服务端备份**：自动每 24 小时备份到 `server/data/backups/`，保留 7 天
- **手动备份**：复制 `server/data/novels.db` 文件

---

> GitHub 地址：https://github.com/AscendJK/ai-novel-reader
>
> 欢迎 Star、Issue、PR。
