from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..agents.chat_agent import run_chat

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    context: str  # Feedback snippets passed in from the frontend (fetched via Supabase)
    history: list[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str

@router.post("/", response_model=ChatResponse)
async def chat_with_feedback(body: ChatRequest):
    """
    Chat with your customer feedback using RAG.
    The frontend fetches recent feedback from Supabase and passes it as `context`.
    The LangGraph agent grounds its answer in that context.
    """
    if not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    history = [{"role": m.role, "content": m.content} for m in body.history]

    reply = run_chat(
        user_message=body.message,
        context=body.context,
        history=history,
    )
    return ChatResponse(reply=reply)
