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

### Notes
- **Chapter Notes** — Per-chapter notes that switch automatically with chapters
- **Book Notes** — Cross-chapter global notes
- **AI Bookmark** — Save AI responses to notes with one click (chapter or book scope)
- **Accordion View** — Notes collapsed to 2-line preview, tap to expand full text, one expanded at a time
- **Move to Book** — Chapter notes can be moved to book notes
- All notes stored in browser IndexedDB, individually deletable

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

### Quick Scripts

**Windows (.bat)** — double-click to run:

| File | Purpose | Usage |
|------|---------|-------|
| `start.bat` | One-click launch | Choose mode 1 (dev/HMR) or mode 2 (prod/stable for mobile) |
| `stop.bat` | Stop server | Kill the process on port 5173 |
| `port-mgr.bat` | Port manager | Menu: list ports, start server, kill specific/all |

**Linux / macOS (.sh)** — run in terminal:

| File | Purpose | Usage |
|------|---------|-------|
| `start.sh` | One-click launch | `./start.sh` choose mode 1 or 2 |
| `stop.sh` | Stop server | `./stop.sh` kill port 5173 |
| `port-mgr.sh` | Port manager | `./port-mgr.sh` interactive menu |

First use: `chmod +x start.sh stop.sh port-mgr.sh`

Launch modes:
- **Mode 1 (Dev)**: Fast hot-reload, but mobile may refresh on wake
- **Mode 2 (Prod, recommended for mobile)**: Build then preview, no HMR, mobile won't refresh

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
- **TF-IDF / BGE Small ZH** — Local semantic retrieval engine
- **Transformers.js** — Browser-side ONNX model inference

## Local Retrieval Engine

The project ships with the **BGE Small ZH v1.5** Chinese embedding model (~26 MB, Xenova INT8 quantized), enabling full-text vector search directly in the browser. When using book analysis or AI Q&A, the system retrieves the most relevant passages instead of randomly sampling chapter content.

Available engines:

| Engine | Size | Description |
|--------|------|-------------|
| TF-IDF (built-in) | 0 MB | Character-level keyword search, instant |
| BGE Small ZH (built-in) | ~26 MB | Chinese-optimized, semantic-level matching |
| Custom models | Any | Xenova-converted models supported |

See the "Local Retrieval Engine" section in Settings for details.

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
