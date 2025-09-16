# YouTube RAG Chatbot

A lightweight Retrieval-Augmented Generation (RAG) chatbot that builds a searchable index from a YouTube video's transcript and answers questions about the video.  
Frontend is a ChatGPT-style chat UI (YouTube-themed). Backend is a FastAPI app that handles transcript retrieval, embeddings, FAISS indexing and LLM-based responses.

---

## 🚀 Highlights

### Core
- Paste a YouTube URL → `POST /process_video` builds an index from transcript.
- Ask questions → `POST /chat` returns context-aware answers.
- Uses OpenAI embeddings & FAISS for retrieval, Cerebras (chat) for completion (configurable).

### Frontend
- Markdown rendering for bot replies (`marked.js`).
- Animated "🤔 Thinking..." indicator.
- Smooth message animations, auto-scroll, auto-resizable input.
- Dark/light mode persisted to `localStorage`.
- Real-time YouTube URL validation and paste detection.
- Keyboard shortcuts: **Enter** to send, **Shift+Enter** newline, **Escape** to clear.

---

## 📂 Project Structure

```
Youtube_Chatbot/
├─ .env
├─ .gitignore
├─ requirements.txt
├─ main.py               # FastAPI app (routes + static/template mount)
├─ rag_pipeline.py       # transcript fetch, chunking, embeddings, FAISS, chat
├─ templates/
│  └─ index.html         # frontend template
├─ static/
│  ├─ style.css
│  └─ script.js
└─ README.md
```

---

## 🛠️ Prerequisites

- Python 3.10+ recommended  
- pip or conda  
- (Optional) conda for easier `faiss` installation on Windows  
- API keys:
  - `CEREBRAS_API_KEY` (for chat completions)  
  - `OPENAI_API_KEY` (for embeddings)  

---

## ⚡ Installation & Quickstart

### 1. Create & activate a venv
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

If `faiss` fails to install via pip:
```bash
conda install -c conda-forge faiss-cpu
```

### 3. Create a `.env`
```env
CEREBRAS_API_KEY=sk-cerebras-xxxx
OPENAI_API_KEY=sk-openai-xxxx
```

### 4. Run the app
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Now visit: [http://localhost:8000](http://localhost:8000)

---

## 🌐 API Endpoints

### `GET /`
Renders the chat UI (`templates/index.html`).

### `POST /process_video`
- **Form field**: `url` (YouTube link or video id)  
- **Success**:
```json
{ "status": "ok", "video_id": "<id>", "chunks": 42 }
```
- **Error**:
```json
{ "status": "error", "message": "..." }
```

### `POST /chat`
- **Form field**: `query`  
- **Response**:
```json
{ "answer": "Assistant answer (Markdown allowed)" }
```

---

## 🖥️ Frontend Integration

- `/process_video` → triggered when user pastes a YouTube link  
- `/chat` → triggered when user sends a message  

Frontend features:
- URL validation and paste detection  
- Loading & error states  
- Markdown rendering via `marked.js`  
- Dark/light mode toggle (saved to localStorage)  
- Keyboard shortcuts  

---

## 🔍 How It Works

1. User pastes a YouTube URL → transcript is fetched.  
2. Transcript is **chunked** (overlapping windows).  
3. Chunks are **embedded** via OpenAI embeddings.  
4. FAISS index stores embeddings + chunks.  
5. User query is embedded → FAISS retrieves top-k chunks.  
6. A prompt containing only retrieved context is passed to Cerebras → final answer.  

If transcript lacks the answer, the model is instructed to say:  
*"The provided transcript does not contain the answer to that question."*

---
## 📧 Contact

Want to extend this project (multi-video sessions, persistent indices, better UI)?  
Open an issue or drop a message!  

Happy building 🎯
