import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load .env file (used in local dev; in Docker the vars are injected directly)
load_dotenv()

from .routers import feedback as feedback_router
from .routers import chat as chat_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    print("🚀 VoiceIQ AI Backend starting up…")
    yield
    print("🛑 VoiceIQ AI Backend shutting down…")

app = FastAPI(
    title="Customer Voice Intelligence API",
    description=(
        "Agentic AI backend for the VoiceIQ Enterprise platform. "
        "Provides LangGraph-powered feedback analysis and RAG chat over customer data."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Next.js frontend (and local dev) to call this API
origins = [
    "http://localhost:3000",
    os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(feedback_router.router)
app.include_router(chat_router.router)

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "voiceiq-ai-backend", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
