from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import os
from rag_pipeline import build_index_from_youtube, query_chat

load_dotenv()
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY")

app = FastAPI()

# Static + Templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Global chatbot state (one video at a time for demo)
CHATBOT_STATE = {"ready": False}

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/process_video")
async def process_video(url: str = Form(...)):
    try:
        res = build_index_from_youtube(url)
        CHATBOT_STATE["ready"] = True
        return {"status": "ok", "video_id": res["video_id"], "chunks": res["num_chunks"]}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/chat")
async def chat(query: str = Form(...)):
    if not CHATBOT_STATE["ready"]:
        return JSONResponse({"answer": "Please first process a video."})
    try:
        answer = query_chat(query)
        return {"answer": answer}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}
