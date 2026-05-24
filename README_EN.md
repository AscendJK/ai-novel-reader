# AI Novel Reader

A browser-based intelligent novel reading tool powered by large language models. Upload TXT/EPUB files, configure any LLM API key, and get chapter summaries, character relationship graphs, plot timelines, AI-powered Q&A, and more.

Supports multi-device sync — all data stored in server-side SQLite, seamlessly switch between devices with one username.

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org) v18+

```bash
git clone https://github.com/AscendJK/ai-novel-reader.git
cd ai-novel-reader
npm install
```

### Launch

```bash
./start.sh    # Linux/macOS, choose 1=Dev or 2=Prod
start.bat     # Windows double-click
```

Open `http://localhost:5173`.

| Mode | Description |
|------|-------------|
| Dev (1) | Hot reload, but mobile may refresh on wake |
| Prod (2) | Build then serve, stable for mobile |

Stop: `./stop.sh` or `stop.bat`

## Usage

### 1. Login

First visit shows a login popup:
- **Create New** — pick a username, start a fresh reading space
- **Join Existing** — enter an existing username to restore all data

> One username, one active session. New login kicks old device.

### 2. Configure AI

Settings (top-right) → choose provider (OpenAI / Anthropic / DeepSeek / Custom) → enter API key and model → save.

API key is stored only in your browser.

### 3. Upload Novels

Drag TXT/EPUB files onto the bookshelf, or click "Import from Folder" for batch.

Uploaded novels are added to the server library and visible to all users.

### 4. Read & Analyze

Click any novel on your bookshelf:
- **Left sidebar** for chapter navigation, **bottom bar** for prev/next, **← → keys** for quick switching
- **AI Analysis button** → chapter summary / book analysis / Q&A / notes
- **Aa button** adjusts font size and weight, supports dark mode

### 5. Multi-Device Sync

After logging in with the same username, these sync automatically:

| Synced | Not Synced |
|--------|------------|
| Reading progress, AI summaries, notes, API config | Theme, font (per-device) |

Sync mechanism: client and server push/pull every 30 seconds. Chapter changes and summary generation trigger an immediate push.

**Notes:**
- Only one device per username at a time — new login kicks the old one
- Logout only clears **browser-local** data, never server data
- Logging back in restores all data from the server

### 6. Library (LAN Sharing)

On the same WiFi, other devices can access `http://<your-ip>:5173`.

- **Bookshelf** — your personal books with progress, summaries, notes
- **Library** — all books uploaded to this server, click "Add to Shelf" to read
- **Remove from shelf** — only deletes your data (progress, summaries, notes); the book stays in the library

### 7. Admin Panel

```bash
./admin.sh    # Linux/macOS
admin.bat     # Windows double-click
```

Opens the admin page (auto-generates admin token). View/delete users and novels.

## Architecture

```
React 19 + TypeScript + Vite (frontend)
Express + SQLite (backend)
├─ Multi-Agent Engine: summarizer / character / timeline
├─ Local RAG: TF-IDF + BGE Small ZH semantic retrieval
├─ d3-force character graph
└─ IndexedDB (browser cache) + SQLite (server persistence)
```

- **React 19 + Vite** — frontend
- **Tailwind CSS + shadcn/ui** — UI components
- **Express + better-sqlite3** — sync backend + data storage
- **Zustand + Dexie.js** — state management + browser cache
- **d3-force** — character relationship graph
- **JSZip** — EPUB parsing
- **BGE Small ZH / TF-IDF** — local semantic retrieval

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge 86+ | Full support |
| Firefox 120+ | Manual file selection for folders |
| Safari 15+ | Basic features |
| Mobile | Responsive design |

## License

MIT License · Built-in BGE Small ZH v1.5 model from BAAI, also MIT licensed
