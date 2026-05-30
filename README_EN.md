# AI Novel Reader

A browser-based AI-powered novel reading tool. Upload TXT/EPUB files, configure any LLM API, and get chapter summaries, character relationship graphs, plot timelines, AI Q&A, and more. Built-in user system with cross-device sync.

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org) v18~22 LTS

> **Node.js 24+ users**: `better-sqlite3` lacks prebuilt binaries for Node 24, so `npm install` will attempt to compile from source (requires Python 3.x and C++ build tools). We recommend **Node.js 22 LTS** to avoid compilation issues. To manage multiple Node versions, use [nvm](https://github.com/nvm-sh/nvm) (macOS/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) (Windows). See FAQ below.

```bash
git clone https://github.com/AscendJK/ai-novel-reader.git
cd ai-novel-reader
```

### Launch

| OS | Command |
|----|---------|
| Linux / macOS | `./start.sh` → choose 1 (Dev) or 2 (Prod) |
| Windows | Double-click `start.bat` → choose 1 or 2 |

Open `http://localhost:5173`.

- **Mode 1 (Dev)**: Hot reload, may refresh on mobile background switch, installs all dependencies (including test tools)
- **Mode 2 (Prod)**: Build then serve, stable for mobile access, installs only production dependencies (no test tools), server runs in background

Stop: `./stop.sh` or double-click `stop.bat`

> **First use**: The script will automatically detect and install dependencies. No need to run `npm install` manually.

## Usage

### 1. Login

Login is a **local operation** — username validation happens in the browser:

- **Create New**: Enter a username (2-30 chars) to create a local reading space. If the server is online, also registers on the server
- **Join Existing**: Enter an existing username. If local data exists, enters directly. If no local data, fetches from the server

> Data is **browser-first** — the server is only for backup and cross-device sync. When the server is unreachable, "Create New" works normally as a local account. "Join Existing" requires the server to be online to fetch data.
>
> The same username on different devices operates independently. On first sync, if the server already has the same username, a conflict prompt appears — the user can rename or merge data.
>
> When switching users, if local data exists, the user is asked whether to keep or discard it.

### 2. Configure AI

Settings → choose provider (OpenAI, Anthropic, DeepSeek, or up to 5 custom OpenAI-compatible APIs) → enter API key and model name.

- API keys are stored only in your browser's IndexedDB
- API settings are isolated per user — different users on the same browser don't interfere
- Settings survive logout, user switching, and browser restarts
- API requests go directly from the browser to the provider. Some providers (e.g., Anthropic) may require the server proxy due to CORS restrictions
- Supports automatic token limit matching for 40+ common models

### 3. Upload Novels

Drag TXT/EPUB files onto the bookshelf, or use "Import from Folder" for batch upload. Supports GBK/Big5/UTF-8 encoding detection and smart chapter recognition.

- Novels are saved to local IndexedDB first, then synced to the server when available
- Novels work locally even when the server is unreachable; auto-uploaded when the server recovers
- Uploaded novels are automatically stored in the server library and visible to all users

### 4. Read

Click any novel on the bookshelf to enter reading view:
- Left sidebar navigates chapters, bottom bar for prev/next, keyboard `←` `→` for chapter switching
- Aa button adjusts font size, weight, line height, paragraph spacing, and font family (system default / serif / monospace)
- Dark / light mode toggle
- Mobile-responsive with immersive reading mode (tap text area to hide UI)
- Keyboard shortcut: `Shift + ?` to view all shortcuts

### 5. AI Analysis

Open the AI analysis panel (top-right) in reading view:

| Feature | Description |
|---------|-------------|
| Chapter Summary | Core plot, key characters, foreshadowing for current chapter |
| Batch Summary | Batch generate all chapter summaries, supports skip existing and stop |
| Book Overview | Main storyline, themes, structure, reading advice |
| Characters | Role identification + family/faction/relationship graph (draggable, zoomable, fullscreen) |
| Timeline | 15-25 key events with type annotations and causality |
| Q&A | Multi-turn conversation with semantic text retrieval (newest first) |
| Range Summary | Custom chapter range analysis (e.g. chapters 5-15) |
| Notes | Per-chapter and global notes, one-click bookmark AI responses |
| Semantic Search | RAG-powered full-text semantic search with natural language queries |

**AI Features**:
- **Concurrency Control**: Only one AI function runs at a time, other buttons are automatically disabled
- **Batch Summary**: Confirmation dialog, stop function, skip existing summaries
- **Real-time Status**: Status bar shows current stage and progress
- **Smart Sampling**: Automatically identifies key paragraphs in long texts, prioritizing important content
- **Segmented Analysis**: Long texts are automatically split, analyzed separately, then merged
- **User Notification**: Analysis results indicate if simplified mode was used

AI analysis shows real-time status (loading data → semantic retrieval → organizing prompts → waiting for AI response → saving results).

### 6. RAG Engine

Supports **any Transformers.js-compatible ONNX embedding model** for semantic retrieval, with TF-IDF as a zero-config fallback.

| Engine | Size | Description |
|--------|------|-------------|
| TF-IDF | 0 MB | Character-level search, instant, no build required |
| BGE Small ZH (built-in) | ~26 MB | Chinese semantic search, recommended for Chinese novels |
| GTE Small (built-in) | ~34 MB | Balanced Chinese + English, from Alibaba |
| Multilingual E5 Small | ~120 MB | Chinese + English, multilingual use |
| All-MiniLM-L6-v2 | ~23 MB | English lightweight, smallest footprint |
| Multilingual MiniLM L12 | ~120 MB | Deep multilingual understanding |

- Build index per novel via the "Build" button on the bookshelf card (unavailable offline)
- **Independent build windows**: Each novel has its own build status window showing queue position, build progress, and completion status
- **Clickable badges**: Build status badges on bookshelf cards are clickable to view build details
- Built index downloads to browser IndexedDB cache
- Automatically falls back to TF-IDF if embedding engine is not ready
- Settings page allows switching engines and adjusting cache limits
- Settings page allows adjusting RAG retrieval count

#### Cache Management

Index cache is split into two layers, managed independently:

| Layer | Storage | Capacity | Description |
|-------|---------|----------|-------------|
| Memory LRU | JavaScript memory | Fixed 100 MB | Recently used indexes, evicted entries can be reloaded from IndexedDB |
| IndexedDB | Browser database | 100-500 MB (user-adjustable) | Persistent cache, survives browser restarts |

- Memory LRU eviction only frees memory, IndexedDB data is preserved
- IndexedDB automatically evicts oldest entries when quota exceeded (protects currently reading novel)
- Settings page shows current IndexedDB usage and progress bar
- Bookshelf card colors: green = index loaded in memory, yellow = index in local cache, blue = server built but not downloaded

#### Custom Model Installation

Supports all Transformers.js-compatible ONNX embedding models (BGE, E5, MiniLM, GTE series):

1. Download 4 files from [Hugging Face](https://huggingface.co) **Xenova conversion** page: `config.json`, `tokenizer.json`, `tokenizer_config.json`, `onnx/model_quantized.onnx`
2. Place in `public/models/custom/Xenova/your-model-name/` directory:
   ```
   public/models/custom/Xenova/your-model-name/
   ├── config.json
   ├── tokenizer.json
   ├── tokenizer_config.json
   └── onnx/
       └── model_quantized.onnx
   ```
3. Restart dev server → Settings page click "Scan" → Click to select

### 7. Multi-device Sync

Same username automatically syncs: reading progress, AI summaries, notes.

- **Browser-first data** — server is only for backup and cross-device sync
- Server restart triggers automatic re-registration, no manual re-login needed
- Automatic pull of latest server data on reconnection
- Offline-created novels auto-upload to server library when server recovers
- Deleted novels and notes sync via soft delete, ensuring multi-device consistency
- Large data sets automatically batch sync to avoid timeouts

> Theme, font, and API config are not synced — each device / each user stores independently.

### 8. Offline Mode

**Auto-detect**: Heartbeat checks server status every 15 seconds. 3 consecutive failures (~45 seconds) auto-enables offline mode, auto-disables when server recovers. Header shows offline indicator with distinction between manual and auto offline.

**Manual toggle**: Click the offline indicator in Header to view status and toggle.

Feature availability in offline mode:

| Feature | Offline Available | Notes |
|---------|------------------|-------|
| Read novels | Yes | Load from local IndexedDB |
| AI summary/Q&A | Yes | Browser direct to LLM API (some providers may have CORS limits) |
| TF-IDF search | Yes | Pure local build |
| Embedding search | Cached only | Falls back to TF-IDF if not cached |
| Notes | Yes | Local CRUD |
| Upload novels | Yes | Save locally, auto-sync when server recovers |
| Build index | No | Button auto-disabled, shows "Offline unavailable" |
| Library browse | No | Button auto-disabled, requires server online |

### 9. Export / Backup

Settings page provides data export:
- **Export all data**: All novels, summaries, notes (excluding API Key) → JSON file
- **Single novel export**: Select novel → JSON or TXT format
- **Import backup**: Restore data from JSON file
- **Storage usage**: Shows browser used/available space, warns when near limit

### 10. Global Notes

Header "Notes" button shows all novels' notes, supports filtering by novel and source (user / AI).

### 11. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `←` / `→` | Previous / next chapter |
| `+` / `-` | Increase / decrease font size |
| `i` | Toggle immersive mode |
| `t` | Toggle theme |
| `Esc` | Close dialogs |
| `Shift + ?` | Show shortcut help |

Settings page also provides shortcut reference card.

### 12. Library

The Library at the bottom of the bookshelf browses all novels on the server. Click "Add to Shelf" to start reading. Removing from shelf only clears your data — the novel stays in the library. Library features require the server to be online.

### 13. Admin Panel

```bash
./admin.sh       # Linux / macOS
admin.bat        # Windows double-click
```

Auto-starts server and opens admin page for viewing/deleting users and novels, and adjusting RAG build timeout (up to 120 minutes).

> **Note**: In production mode, the admin page is served directly by Express (not Vite). After first launch or upgrades, use `Ctrl + Shift + R` to hard-refresh, or open in incognito mode, to avoid the Service Worker showing the novel reader page instead of the admin panel.

## Architecture

```
React 19 + TypeScript (strict) + Vite + Vitest
Express + better-sqlite3
├─ Multi-agent engine: summary / characters / timeline / graph
├─ Multi-engine semantic retrieval: BGE / E5 / MiniLM / GTE ONNX models (Worker Thread encoding)
├─ d3-force character graph (mouse wheel + pinch-to-zoom on mobile)
├─ IndexedDB browser cache + SQLite server persistence
├─ PWA Service Worker offline caching
├─ Username system + Session Token auth + Server-side centralized sync
├─ Three-tier RAG cache: Memory LRU (100MB) → IndexedDB (100-500MB) → Server SQLite
├─ Periodic WAL checkpoint + automatic database backup (24h)
└─ Unit test coverage: 117 test cases (Vitest + Testing Library)
```

## Design Principles

- **Browser-first data**: Reading, notes, summaries, settings, and API keys all live in local IndexedDB
- **Server for RAG building and backup only**: Most features work when the server is unreachable
- **Login is local**: Username validation happens in the browser; the server only participates in sync
- **Offline-first**: Auto-detects server status, clearly indicates unavailable features, never blocks the user

## Security

- **Session Token authentication**: Server issues tokens on login, sync endpoints (push/heartbeat) also verify tokens
- **Single-session enforcement**: Logging in from a new device kicks the previous session; automatic re-registration after server restart
- **API key local isolation**: Stored per-user in IndexedDB, never uploaded, never synced, preserved on kick
- **CORS restriction**: Only localhost and LAN IPs (192.168.x.x / 10.x.x.x / 172.16-31.x.x) allowed
- **CSP security policy**: `connect-src` restricted to same-origin only, preventing external data leaks
- **Rate limiting**: RAG build, encode, and other expensive endpoints are rate-limited per IP
- **Input validation**: Username length limits, request body size limits, text length limits
- **Timestamp-based merge**: Sync uses timestamps to determine newer data, preventing overwrite of fresher content
- **Sync mutex lock**: Prevents concurrent sync operations from causing data loss
- **Orphan record cleanup**: Sync automatically skips novel-associated data for deleted novels; deleting a novel cascades to RAG cache cleanup

## Notes

- **LAN/local use only — do not expose to the public internet**. No HTTPS, no password auth, SQLite not suitable for public concurrency. Exposing this server risks API key theft, session hijacking, and data corruption
- BGE index for very long novels (5000+ chapters) may take 5-30 min; normal reading is unaffected during build
- Server model loading peaks at ~2GB RAM
- Simultaneous builds are queued (max 10 tasks)
- API keys stored only in browser IndexedDB, never uploaded to server
- Debug panel defaults to off, hidden on mobile

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge 86+ | Full support |
| Firefox 120+ | Folder import requires manual file selection |
| Safari 15+ | Basic functionality |
| Mobile Chrome / Safari | Responsive layout |

## License

MIT License. Built-in models:
- **BGE Small ZH v1.5** — from BAAI (Beijing Academy of Artificial Intelligence), MIT licensed
- **GTE Small** — from Alibaba DAMO Academy, Apache 2.0 licensed

## FAQ

### npm install fails with better-sqlite3 compilation error

**Cause**: `better-sqlite3` is a native module. Node.js 24+ has no prebuilt binaries. This project requires Node.js 18-22 LTS.

**Solutions (pick one)**:

1. **Use nvm to install Node.js 22 LTS** (recommended)
   - Windows: Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
   - macOS/Linux: Run `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`
   - After installing, restart terminal and run:
     ```bash
     nvm install 22       # Install Node 22 LTS
     nvm use 22           # Switch to Node 22
     ```
   - Re-run `start.bat` or `./start.sh`
   - To switch back for other projects: `nvm use 24`

2. **Install Node.js 22 LTS directly** (without nvm)
   - Uninstall current Node.js
   - Download 22.x.x LTS from https://nodejs.org
   - Re-run `start.bat` or `./start.sh`

### How to reinstall dependencies

If dependencies are corrupted or after switching Node versions:

```bash
# Windows CMD
rmdir /s /q node_modules
del package-lock.json
start.bat

# macOS / Linux
rm -rf node_modules package-lock.json
./start.sh
```

`start.bat` / `./start.sh` will auto-detect and reinstall dependencies.
