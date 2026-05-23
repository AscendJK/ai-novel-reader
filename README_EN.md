# AI Novel Reader

A browser-based intelligent novel reading tool powered by large language models. Upload TXT/EPUB files, configure any LLM API key, and get chapter summaries, character relationship graphs, plot timelines, AI-powered Q&A, and more.

**All data is stored locally in your browser. API calls go directly from your browser to the LLM provider — no intermediate server.**

[中文](README.md)

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
- [Architecture](#architecture)
- [Privacy](#privacy)
- [Browser Support](#browser-support)
- [License](#license)

## Features

### Import
- Supports TXT and EPUB formats with automatic encoding detection (GBK / Big5 / UTF-8)
- Smart chapter title recognition (Chinese "Chapter", "Chapter 1", numbered patterns)
- Batch folder import with bookshelf-style management showing word count, chapter count, and reading progress

### AI Chapter Analysis
- One-click chapter summary (plot essentials, key characters, foreshadowing, theme development)
- Batch processing of all chapters
- Custom range summary: temporary analysis for arbitrary chapter ranges (e.g., chapters 5-12)

### Book-Level Analysis
- **Plot Timeline** — Extract 15-25 key events with type and causality annotations
- **Character Graph** — Auto-identify characters and generate a draggable force-directed network graph with full-screen support
- **Global Summary** — Main storyline, thematic analysis, structural overview, reading recommendations

### AI Q&A
- Multi-turn conversation about the novel with persistent chat history
- Start new sessions at any time
- All Q&A is ephemeral and not saved locally

### Reading Experience
- Adjustable font size and weight
- Dark / light mode toggle
- Collapsible chapter navigation sidebar with bottom navigation bar for prev/next chapter
- Keyboard shortcuts: ← → to switch chapters
- Automatic reading progress memory with restore on revisit
- Mobile-responsive design

## Quick Start

**Prerequisites:** Install [Node.js](https://nodejs.org) (v18 or later).

```bash
# Clone the repository
git clone https://github.com/AscendJK/ai-novel-reader.git
cd ai-novel-reader

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

Windows users can also double-click `start.bat` for a one-click launch (auto-installs dependencies on first run). Use `stop.bat` to stop the server, or `port-mgr.bat` to manage multiple ports.

## Usage Guide

### Configure API

1. Click the settings icon in the top-right corner
2. Choose an API provider (OpenAI / Anthropic / DeepSeek / custom OpenAI-compatible)
3. Enter your API key and select a model
4. Click save — your API key is stored only in your browser

### Read & Analyze

1. Upload a novel file on the bookshelf page
2. Click a book card to enter the reading view
3. Click the "AI Analysis" button to open the side panel
4. Use "Chapter Analysis" to summarize the current chapter
5. Switch to the "Book Analysis" tab for deep analysis
6. Use the "Q&A" tab for free-form questions

### LAN Sharing

```bash
npm run build
npx vite preview --host 0.0.0.0 --port 5173
```

Devices on the same WiFi network can access `http://<your-ip>:5173`. Each device's data is completely isolated.

## Architecture

```
┌──────────────────────────────────────────────┐
│  React 19 + TypeScript + Vite                │
├──────────────────────────────────────────────┤
│  Multi-Agent Engine                           │
│  ├ Chunker Agent     — Semantic splitting    │
│  ├ Summarizer Agent  — Chapter/book summary  │
│  ├ Character Agent   — Profile & graph JSON  │
│  ├ Timeline Agent    — Event extraction      │
│  ├ Graph Agent       — Standalone graph JSON │
│  └ Orchestrator      — Task scheduling       │
├──────────────────────────────────────────────┤
│  API Layer                                    │
│  ├ OpenAI / Anthropic / DeepSeek / Compat     │
│  ├ Token budget + AbortController             │
│  └ Error classification (auth/network/ctx)   │
├──────────────────────────────────────────────┤
│  Storage                                      │
│  ├ IndexedDB (Dexie.js) — books, analysis    │
│  └ localStorage — theme, font, progress      │
└──────────────────────────────────────────────┘
```

**Core Technologies:**
- **React 19 + TypeScript + Vite** — Frontend framework
- **Tailwind CSS + shadcn/ui** — UI components
- **Zustand** — State management
- **Dexie.js** — IndexedDB wrapper
- **d3-force** — Force-directed character graph
- **react-markdown** — Markdown rendering
- **JSZip** — EPUB file parsing

## Privacy

| Data Type | Storage | Notes |
|-----------|---------|-------|
| Novel text | Browser IndexedDB | Never uploaded |
| AI results | Browser IndexedDB | Deletable per category |
| API key | Browser IndexedDB | Used only for API calls |
| UI preferences | localStorage | Theme, font, progress |
| Q&A conversations | Memory only | Gone on page refresh |

- Deleting a novel removes all associated data (text, analysis, graph, progress)
- Different ports = completely isolated storage (localhost:5173 ≠ localhost:5174)
- Vite dev server only serves static files; it never stores or relays user data

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge 86+ | ✅ Full support (including folder import) |
| Firefox 120+ | ✅ Manual file selection for folder import |
| Safari 15+ | ✅ Basic functionality |
| Mobile Chrome / Safari | ✅ Responsive design |

## License

MIT License — see [LICENSE](LICENSE)
