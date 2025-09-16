import os
import time
import numpy as np
import faiss
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
from cerebras.cloud.sdk import Cerebras
from openai import OpenAI
from typing import List
from deep_translator import GoogleTranslator
from dotenv import load_dotenv

load_dotenv()

# --- Clients and Models ---
cerebras_client = Cerebras(api_key=os.getenv("CEREBRAS_API_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBED_MODEL = "text-embedding-3-small"
CHAT_MODEL = "llama3.3-70b"


# --- Vector Store Class ---
class Retriever:
    """A wrapper for a FAISS vector store."""

    def __init__(self, dim: int):
        self.index = faiss.IndexFlatIP(dim)
        self.texts = []

    def add(self, embeddings: np.ndarray, chunks: List[str]):
        """Adds embeddings and corresponding text chunks to the index."""
        normalized_embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        self.index.add(normalized_embeddings)
        self.texts.extend(chunks)

    def search(self, q_emb: np.ndarray, k: int = 5) -> List[str]:
        """Searches the index for the top k most similar chunks."""
        normalized_q_emb = q_emb / np.linalg.norm(q_emb)
        _, I = self.index.search(np.array([normalized_q_emb]), k)
        return [self.texts[idx] for idx in I[0] if idx != -1]


# --- Global State ---
STATE = {"retriever": None}


# --- Core Functions ---
def extract_video_id(url: str) -> str:
    """Extracts the YouTube video ID from various URL formats."""
    if "v=" in url:
        return url.split("v=")[-1].split("&")[0]
    if "youtu.be/" in url:
        return url.split("youtu.be/")[-1].split("?")[0]
    return url


def get_transcript(video_id: str) -> str:
    """
    Fetches a transcript and returns it in its original language.
    """
    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.list(video_id)

        # Find the first available transcript, regardless of language
        transcript = next(iter(transcript_list), None)

        if transcript:
            print(f"✅ Transcript found in its original language: '{transcript.language_code}'")
            pieces = transcript.fetch()
            return " ".join(seg.text for seg in pieces)
        else:
            print("❌ No transcripts were found for this video.")
            return ""

    except TranscriptsDisabled:
        print(f"❌ Transcripts are disabled for video '{video_id}'.")
        return ""
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        return ""


def chunk_text(text: str, size: int = 800, overlap: int = 150) -> List[str]:
    """Splits text into overlapping chunks of words."""
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i:i + size]))
        i += size - overlap
    return chunks


def embed_texts(texts: List[str]) -> np.ndarray:
    """Generates embeddings for a list of text chunks."""
    resp = openai_client.embeddings.create(input=texts, model=EMBED_MODEL)
    return np.array([item.embedding for item in resp.data], dtype=np.float32)


# --- Main Logic Functions ---
def build_index_from_youtube(url: str) -> dict:
    """Orchestrates the process of creating a RAG index from a YouTube URL."""
    print(f"Processing video: {url}")
    video_id = extract_video_id(url)

    transcript = get_transcript(video_id)
    if not transcript:
        raise ValueError("Failed to retrieve or process transcript for the video.")

    print("Chunking transcript...")
    chunks = chunk_text(transcript)

    print(f"Generating embeddings for {len(chunks)} chunks...")
    all_embeddings = []
    batch_size = 32
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        all_embeddings.append(embed_texts(batch))
        time.sleep(0.1)  # A small delay to respect API rate limits

    embeddings_matrix = np.vstack(all_embeddings)

    print("Building FAISS index...")
    STATE["retriever"] = Retriever(dim=embeddings_matrix.shape[1])
    STATE["retriever"].add(embeddings_matrix, chunks)

    print("✅ Index built successfully!")
    return {"video_id": video_id, "num_chunks": len(chunks)}


def query_chat(user_query: str, k: int = 4) -> str:
    """Queries the RAG system with a user's question."""
    retriever = STATE.get("retriever")
    if not retriever:
        return "Error: The chatbot has not been trained on a video yet."

    print(f"Embedding user query: '{user_query}'")
    query_embedding = embed_texts([user_query])[0]

    print("Retrieving relevant context...")
    context = "\n\n".join(retriever.search(query_embedding, k))

    prompt = f"""You are a specialized AI assistant. Your ONLY function is to answer questions about the content of a specific YouTube video using its provided transcript.

    **Core Instructions:**
    1.  **Strictly Adhere to Context:** You MUST answer based **exclusively** on the information within the `Context` below. Do not add outside information or use your general knowledge to answer questions about the video's topic.
    2.  **Interpret "This Project":** If the user asks about "this project," "the system," or similar terms, assume they are referring to the concepts and systems described in the video transcript, NOT yourself.
    3.  **Handle Missing Information:** If the information to answer the question is not in the `Context`, you must state clearly: "The provided transcript does not contain the answer to that question."

    **Context:**
    ---
    {context}
    ---
    **Question:** {user_query}

    **Answer (in English):**
    """
    print("Generating answer with Cerebras...")
    resp = cerebras_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
        temperature=0.3
    )
    return resp.choices[0].message.content