# AI Novel Reader

A browser-based AI-powered novel reading tool. Upload TXT/EPUB files, configure any LLM API, and get chapter summaries, character relationship graphs, plot timelines, AI Q&A, and more. Built-in user system with cross-device sync.

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org) v18~22 LTS

> **Node.js 24+ users**: `better-sqlite3` lacks prebuilt binaries for Node 24, so `npm install` will attempt to compile from source (requires Python 3.x and C++ build tools). We recommend **Node.js 22 LTS** to avoid compilation issues. See FAQ below.

```bash
git clone https://github.com/AscendJK/ai-novel-reader.git
cd ai-novel-reader
npm install
```

### Launch

| OS | Command |
|----|---------|
| Linux / macOS | `./start.sh` → choose 1 (Dev) or 2 (Prod) |
| Windows | Double-click `start.bat` → choose 1 or 2 |

Open `http://localhost:5173`.

- Mode 1: Hot reload, may refresh on mobile background switch
- Mode 2: Build then serve, stable for mobile access

Stop: `./stop.sh` or double-click `stop.bat`

## Usage

### 1. Login

- **Create New**: Pick a username (2-30 chars) for a fresh reading space
- **Join Existing**: Enter an existing username to restore all data

> One active session per username. Logging in from a new device kicks the old one. Logout only clears browser data — server data persists, just log back in to restore.

### 2. Configure AI

Settings → choose provider (OpenAI, Anthropic, DeepSeek, or up to 5 custom OpenAI-compatible APIs) → enter API key and model name.

- API keys are stored only in your browser's IndexedDB
- API settings are isolated per user — different users on the same browser don't interfere
- Settings survive logout, user switching, and browser restarts

### 3. Upload Novels

Drag TXT/EPUB files onto the bookshelf, or use "Import from Folder" for batch upload. Supports GBK/Big5/UTF-8 encoding detection and smart chapter recognition. Uploaded novels appear in the shared library.

### 4. Read & Analyze

Click a novel to enter reading view. Left sidebar navigates chapters; bottom bar provides prev/next; `←` `→` keys switch chapters. Aa button adjusts font size and weight. Dark mode supported. Mobile-responsive with immersive reading mode.

The AI analysis panel (top-right) provides:

| Feature | Description |
|---------|-------------|
| Chapter Summary | Core plot, key characters, foreshadowing |
| Book Overview | Main storyline, themes, structure, reading advice |
| Characters | Auto-identify roles + interactive force-directed graph with zoom/pan |
| Timeline | 15-25 key events with causality annotations |
| Q&A | Multi-turn conversation with semantic text retrieval |
| Range Summary | Custom chapter range analysis |
| Notes | Per-chapter and global notes, one-click bookmark AI responses |

### 5. RAG Engine

Two retrieval engines included: **TF-IDF** (zero-config, instant) and **BGE Small ZH** (semantic vector search, higher accuracy).

- Build BGE index per novel via the "Build" button on the bookshelf card
- Built index downloads to browser cache (~1-3 MB per novel)
- Falls back to TF-IDF automatically when BGE is unavailable
- Settings page allows engine switching and cache limit adjustment (100-500 MB)

### 6. Multi-Device Sync

Same username syncs: reading progress, AI summaries, notes.

> Theme, font, and API config are per-device / per-user, not synced.

### 7. Library

The Library at the bottom of the bookshelf browses all novels on the server. Click "Add to Shelf" to start reading. Removing from shelf only clears your data — the novel stays in the library.

### 8. Admin Panel

```bash
./admin.sh       # Linux / macOS
admin.bat        # Windows double-click
```

Auto-starts server and opens admin page for viewing/deleting users and novels.

## Architecture

```
React 19 + TypeScript + Vite
Express + better-sqlite3
├─ Multi-agent engine: summary / characters / timeline / graph
├─ BGE Small ZH semantic retrieval (Worker Thread encoding)
├─ d3-force character graph (mouse wheel + pinch-to-zoom)
├─ IndexedDB browser cache + SQLite server persistence
└─ Username system + Session Token auth + Server-side sync
```

## Security

- **Session Token authentication**: Server issues tokens on login, all API requests verified via `Authorization: Bearer <token>`
- **Single-session enforcement**: Logging in from a new device kicks the previous session
- **API key local isolation**: Stored per-user in IndexedDB, never uploaded or synced
- **CORS restriction**: Only localhost and LAN IPs (192.168.x.x / 10.x.x.x / 172.16-31.x.x) allowed
- **Rate limiting**: RAG build, encode, and other expensive endpoints are rate-limited per IP
- **Input validation**: Username length limits, request body size limits, text length limits

## Notes

- BGE index for very long novels (5000+ chapters) may take 5-30 min; normal reading is unaffected during build
- Server model loading peaks at ~2GB RAM
- Simultaneous builds are queued (max 10 tasks)
- For LAN/local use only — do not expose to the internet
- API keys stored in browser IndexedDB, never uploaded
- Debug panel defaults to off, hidden on mobile

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge 86+ | Full support |
| Firefox 120+ | Folder import requires manual file selection |
| Safari 15+ | Basic functionality |
| Mobile Chrome / Safari | Responsive layout |

## License

MIT License. Built-in BGE Small ZH v1.5 model from BAAI, MIT licensed.

## FAQ

### npm install fails with better-sqlite3 compilation error

**Cause**: `better-sqlite3` is a native module. Node.js 24+ has no prebuilt binaries, so it tries to compile from source, which requires Python and C++ build tools.

**Solutions (pick one)**:

1. **Install Node.js 22 LTS** (recommended, easiest)
   - Uninstall current Node.js
   - Download 22.x.x LTS from https://nodejs.org
   - Re-run `start.bat` or `./start.sh`

2. **Install build tools** (for advanced users who need Node.js 24+)
   - Install Python 3.x: https://www.python.org/downloads/ (check "Add Python to PATH")
   - Windows: Install Visual Studio Build Tools https://visualstudio.microsoft.com/visual-cpp-build-tools/ — select "Desktop development with C++"
   - macOS: Run `xcode-select --install` in terminal
   - Linux: `sudo apt install build-essential` (Ubuntu) or `sudo dnf groupinstall "Development Tools"` (Fedora)
   - Restart terminal and re-run `start.bat` or `./start.sh`
