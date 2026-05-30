# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指引。

## 参考文档

`DEVELOPER_MANUAL.md` 是项目的完整开发者手册，包含架构设计、功能分类（浏览器本地 vs 服务端）、数据库设计、关键系统详解、所有功能的端到端流程、设计决策和已知限制。修改代码前必须参考该手册，确保改动符合项目的设计原则（浏览器本地优先、服务器只做 RAG 构建和数据备份）。

## 常用命令

```bash
npm run dev          # Vite 开发服务器 :5173（HMR，/api 代理到 :3001）
npm run server       # 仅启动 Express API 服务器 :3001
npm run start        # 构建前端 + 完整服务器 :5173
npx tsc --noEmit     # 类型检查（项目未配置测试套件）
```

开发时需在两个终端分别运行 `npm run server` 和 `npm run dev`。Vite 开发服务器会将 `/api/*` 请求代理到 Express 的 3001 端口。

## 架构概览

**AI 小说精读助手** — 基于浏览器的小说阅读工具，支持 AI 分析（章节总结、人物关系图谱、时间线、问答、语义搜索）和多设备同步。

### 双数据库架构

- **客户端**: Dexie (IndexedDB) — `src/db/database.ts`，两个数据库：SharedDB（`settings`、`ragCache`）和 UserDB（`novels`、`chapters`、`summaries`、`notes`，按用户名隔离）。支持离线模式。
- **服务端**: SQLite (better-sqlite3) — `server/database.js`，WAL 模式，8 张表。存储共享书库、用户数据、RAG 向量索引。

### 服务端（纯 JS，非 TypeScript）

`server/index.js` — 所有 Express 路由集中在一个文件中。主要路由组：
- `/api/novels/*` — 小说 CRUD、章节获取、加入/离开书架
- `/api/rag/*` — RAG 构建触发、状态轮询、索引下载、查询编码
- `/api/sync/*` — 注册、心跳、推送/拉取
- `/api/proxy/chat` — 转发 LLM 请求（API key 留在浏览器端）
- `/api/admin/*` — 管理后台（token 认证，见 `server/admin.js`）

`server/rag-builder.js` — 串行构建队列（最大 10 个），Worker 线程执行 ONNX 编码，超时根据 chunk 数量动态计算。

### 前端（React 19 + TypeScript + Vite）

无 React Router — 单页布局由 `AppLayout.tsx` 通过视图状态管理。

**Zustand 状态管理** (`src/stores/`): `ui-store`, `api-store`, `novel-store`, `summary-store`, `rag-store`, `build-store`。

**Agent 系统** (`src/agents/`): Agent 实现 `{ name, run(context): AgentResult }` 接口。编排逻辑在 `src/hooks/useSummarizer.ts`（核心 hook，串联 Agent、RAG 检索和同步）。

**RAG 系统** (`src/rag/`): 三级缓存 — LRU 内存（固定 100MB）→ IndexedDB（100-500MB 用户可调）→ 服务端 SQLite。`indexCache` 以 `${novelId}-${engine}` 为 key。LRU 淘汰只清内存，IndexedDB 独立淘汰。降级链：首选嵌入引擎 → TF-IDF。查询编码：优先服务端 `/api/rag/encode`，服务不可用时降级为客户端 ONNX 编码。`ragCache` 表 schema：`id`（复合主键）+ `novelId`（纯 UUID）+ `engine` + `createdAt`。

**API Provider** (`src/api/`): `registry.ts` 中的工厂模式。支持 OpenAI、Anthropic、DeepSeek 和最多 5 个自定义 OpenAI 兼容端点。配置按用户存储在 IndexedDB。

**同步系统** (`src/sync/`): 基于用户名的认证（无密码）。`SyncClient` 每 15 秒心跳，每 30 秒同步。心跳失败 3 次自动进入离线模式，恢复后自动退出。按 `updatedAt` 最后写入胜出。软删除跨设备传播。API key 永不离开浏览器。登录为本地操作，服务器仅用于数据备份和跨设备同步。

### 关键文件

| 文件 | 职责 |
|---|---|
| `src/hooks/useSummarizer.ts` | 核心 AI 编排 hook |
| `src/rag/index.ts` | RAG 构建/检索，多引擎缓存管理 |
| `src/rag/rag-cache-utils.ts` | IndexedDB 缓存大小计算、配额淘汰 |
| `server/rag-builder.js` | 服务端 RAG 构建队列 + Worker 编码 |
| `server/index.js` | 所有服务端路由 |
| `server/database.js` | SQLite schema + prepared statements |
| `src/db/database.ts` | Dexie 客户端 schema（SharedDB + UserDB） |
| `src/sync/sync-client.ts` | 登录、心跳、推送/拉取、自动重注册、自动离线检测 |
| `src/api/registry.ts` | LLM Provider 工厂 |
| `src/components/layout/AppLayout.tsx` | 登录流程、离线检测、数据同步 |
| `src/components/layout/BookSelect.tsx` | 书架 UI，构建状态轮询 |
| `src/components/summary/SummaryPanel.tsx` | 所有 AI 分析功能（最大组件） |

### 路径别名

`@/` 映射到 `src/`（在 `vite.config.ts` 和 `tsconfig.app.json` 中配置）。

## 关键约定

- **中文优先**: 所有 UI 文案、提示词、默认嵌入模型（BGE Small ZH）均针对中文小说优化。
- **浏览器本地优先**: 阅读、笔记、总结、设置、API Key 全部存在本地 IndexedDB，服务器仅用于 RAG 构建和数据备份。
- **登录是本地操作**: 用户名检测在浏览器完成，服务器仅在同步时参与。离线时可创建本地账户。
- **无密码认证**: 简洁优先于安全性，不要暴露到公网。
- **API key 仅存浏览器**: 存储在 IndexedDB，永不同步到服务端。
- **服务端是纯 JS**: `server/` 目录使用 ES modules（`import`/`export`）但无 TypeScript。前端是 TypeScript。
- **ONNX 运行时锁定**: `onnxruntime-node` 和 `onnxruntime-web` 锁定为 `1.14.0`（`@xenova/transformers@2.17.2` 要求）。
- **RAG 缓存分层管理**: 内存 LRU 固定 100MB（`embedding-retriever.ts`），IndexedDB 独立管理 100-500MB（`rag-cache-utils.ts`）。LRU 淘汰只清内存，IndexedDB 有自己的配额淘汰。
- **ragCache schema**: 复合键 `${novelId}-${engine}` 存在 `id` 字段，`novelId` 存纯 UUID，`engine` 单独索引，`createdAt` 用于淘汰排序。
- **离线模式自动检测**: 心跳失败 3 次自动开启，恢复后自动关闭。设置页可手动切换。
- **Git 推送需确认**: 执行 `git push` 推送到 GitHub 前必须先询问用户确认，不得自动推送。
- **修改代码前必须先给方案**: 任何代码修改之前，必须先给出修改方案并询问用户是否接受，确认后再动手。方案说明必须同时包含功能角度（用户会看到什么变化）和代码角度（改哪些文件、什么逻辑），不能只说代码。
