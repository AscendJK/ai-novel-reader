# AI 小说精读助手

基于大语言模型的浏览器端智能小说阅读工具。上传 TXT/EPUB 文件，填入任意大模型 API Key，即可对小说进行章节总结、人物关系分析、剧情时间线梳理、AI 问答等深度交互。

**全部数据存储在浏览器本地，API 调用直接从浏览器发出，不经过任何第三方服务器。**

[English](README_EN.md)

## 功能

- **小说导入** — 支持 TXT、EPUB 格式，自动识别章节目录和编码（GBK/UTF-8）
- **AI 章节总结** — 逐章生成摘要，支持批量总结
- **全书分析** — 故事主线、主题分析、结构特点
- **人物关系图谱** — 自动识别角色并生成可拖拽的力导向关系图
- **剧情时间线** — 提取关键事件，标注因果关系和伏笔
- **AI 问答** — 支持多轮对话，追问小说内容
- **范围总结** — 自定义章节范围的临时分析
- **暗色模式** — 支持亮色/暗色切换
- **移动端适配** — 响应式设计，手机/平板可用

## 支持的 API 提供商

| 提供商 | 默认模型 |
|--------|---------|
| OpenAI | gpt-4o |
| Anthropic Claude | claude-sonnet-4-6 |
| DeepSeek | deepseek-chat |
| OpenAI 兼容接口 | 自定义 |

API Key 存储在浏览器 IndexedDB 中，不会上传到任何服务器。

## 快速开始

**前置条件：** 安装 [Node.js](https://nodejs.org)（v18 或以上）。

```bash
# 安装依赖（仅首次需要）
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

Windows 用户也可以双击 `start.bat` 一键启动（首次使用会自动安装依赖）。

## 局域网部署

```bash
npm run build
npx vite preview --host 0.0.0.0 --port 5173
```

同一 WiFi 下的手机/平板访问 `http://你的电脑IP:5173` 即可使用。

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Zustand（状态管理）
- Dexie.js（IndexedDB）
- d3-force（人物关系图谱）
- react-markdown（Markdown 渲染）

## 数据隐私

- 所有小说文本、AI 分析结果、API Key 均存储在浏览器本地 IndexedDB 中
- API 调用直接从浏览器发起，不经任何中间服务器
- 删除小说时自动清除所有关联数据
- 不同端口的访问数据完全隔离

## 开源协议

MIT License
