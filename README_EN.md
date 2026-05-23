# AI Novel Reader

A browser-based intelligent novel reading tool powered by large language models. Upload TXT/EPUB files, configure any LLM API key, and get chapter summaries, character analysis, plot timelines, AI Q&A, and more.

**All data is stored locally in your browser. API calls go directly from your browser to the LLM provider — no intermediate server.**

[中文](README.md)

## Features

- **Novel Import** — TXT & EPUB, auto-detect chapters and encoding (GBK/UTF-8)
- **Chapter Summary** — AI-generated summaries, batch mode supported
- **Book Analysis** — Main storyline, themes, structural analysis
- **Character Graph** — Auto-identify characters, generate draggable force-directed relationship graph
- **Plot Timeline** — Extract key events with causality and foreshadowing markers
- **AI Q&A** — Multi-turn conversation about the novel
- **Range Summary** — Temporary analysis for custom chapter ranges
- **Dark Mode** — Light/dark theme toggle
- **Mobile Responsive** — Works on phones and tablets

## Supported API Providers

| Provider | Default Model |
|----------|--------------|
| OpenAI | gpt-4o |
| Anthropic Claude | claude-sonnet-4-6 |
| DeepSeek | deepseek-chat |
| OpenAI-compatible | Custom |

API keys are stored in browser IndexedDB and never sent to any server.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:5173
```

Windows users can also double-click `start.bat`.

## LAN Deployment

```bash
npm run build
npx vite preview --host 0.0.0.0 --port 5173
```

Devices on the same WiFi can access `http://<your-ip>:5173`.

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Zustand (state management)
- Dexie.js (IndexedDB)
- d3-force (character graph)
- react-markdown (Markdown rendering)

## Privacy

- All novel text, AI results, and API keys are stored in browser IndexedDB
- API calls go directly from browser to LLM provider
- Deleting a novel clears all associated data
- Different ports = completely isolated data

## License

MIT License
