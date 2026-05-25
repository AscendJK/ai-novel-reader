# AI Novel Reader

A browser-based AI-powered novel reading tool. Upload TXT/EPUB files, configure any LLM API, and get chapter summaries, character relationship graphs, plot timelines, AI Q&A, and more. Built-in user system with cross-device sync.

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org) v18+

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

Stop: `./stop.sh` or `stop.bat`

## Usage

### 1. Login

- **Create New**: Pick a username for a fresh reading space
- **Join Existing**: Enter an existing username to restore all data

> One active session per username. Logout only clears browser data — server data persists.

### 2. Configure AI

Settings → choose provider (OpenAI, Anthropic, DeepSeek, or up to 5 custom OpenAI-compatible APIs) → enter API key and model name.

API keys are stored only in your browser.

### 3. Upload Novels

Drag TXT/EPUB files onto the bookshelf. Supports GBK/Big5/UTF-8 encoding detection and smart chapter recognition. Uploaded novels appear in the shared library.

### 4. Read & Analyze

Click a novel to enter reading view. Left sidebar navigates chapters; bottom bar provides prev/next; `←` `→` keys switch chapters. Aa button adjusts font size and weight. Dark mode supported.

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

### 6. Multi-Device Sync

Same username syncs: reading progress, AI summaries, notes, API config. Theme and font settings are per-device.

### 7. Library

The Library browses all novels on the server. Click "Add to Shelf" to start reading. Removing from shelf only clears your data — the novel stays in the library.

### 8. Admin Panel

```bash
./admin.sh       # Linux / macOS
admin.bat        # Windows double-click
```

Auto-starts server and opens admin page for viewing/deleting users and novels.

## Notes

- BGE index for very long novels (5000+ chapters) may take 5-30 min; normal reading is unaffected during build
- Server model loading peaks at ~2GB RAM
- Simultaneous builds are queued (max 10 tasks)
- For LAN/local use only — do not expose to the internet
- API keys stored in browser IndexedDB, never uploaded

## License

MIT License. Built-in BGE Small ZH v1.5 model from BAAI, MIT licensed.