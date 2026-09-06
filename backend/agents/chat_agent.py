import os
from typing import TypedDict, Annotated
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field

load_dotenv()

MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"]

def _get_llm(model_name: str) -> ChatGroq:
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Check backend/.env")
    return ChatGroq(temperature=0, model_name=model_name, groq_api_key=key)

SYSTEM_PROMPT = """You are an expert customer intelligence analyst. You have access to
customer feedback data from the VoiceIQ platform. Answer the user's questions clearly,
citing sentiment patterns, recurring themes, and actionable insights where relevant.
Be concise, data-driven, and strategic in your responses."""

class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    context: str  # Injected feedback context from the database

def chat_node(state: ChatState) -> ChatState:
    """Main LLM node that answers user questions using the feedback context.
    Tries each model in MODELS in order, falling back if one is unavailable/overloaded.
    """
    system_with_context = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Here is a sample of recent customer feedback from the organisation:\n\n"
        f"{state['context']}\n\n"
        f"Use this data to ground your answers."
    )
    messages_to_send = [
        HumanMessage(content=system_with_context),
        *state["messages"],
    ]

    last_error = None
    for model in MODELS:
        try:
            print(f"[chat_agent] Trying model: {model}")
            llm = _get_llm(model)
            response = llm.invoke(messages_to_send)
            print(f"[chat_agent] Success with model: {model}")
            return {"messages": [response]}
        except Exception as e:
            print(f"[chat_agent] Model {model} failed: {e}")
            last_error = e

    # All models failed
    print(f"[chat_agent] All models failed. Last error: {last_error}")
    response = AIMessage(content="Sorry, the AI service is temporarily unavailable. Please try again in a moment.")
    return {"messages": [response]}

# Build the RAG chat graph
_builder = StateGraph(ChatState)
_builder.add_node("chat", chat_node)
_builder.set_entry_point("chat")
_builder.add_edge("chat", END)
chat_graph = _builder.compile()

def run_chat(user_message: str, context: str, history: list[dict] | None = None) -> str:
    """
    Run the chat agent.

    Args:
        user_message: The user's latest question.
        context: Feedback snippets to ground the LLM's answer.
        history: Optional list of {"role": "user"|"assistant", "content": "..."} dicts.

    Returns:
        The AI response as a string.
    """
    past: list[BaseMessage] = []
    for turn in (history or []):
        if turn["role"] == "user":
            past.append(HumanMessage(content=turn["content"]))
        else:
            past.append(AIMessage(content=turn["content"]))

    initial_state = ChatState(
        messages=[*past, HumanMessage(content=user_message)],
        context=context,
    )
    result = chat_graph.invoke(initial_state)
    last_msg = result["messages"][-1]
    return last_msg.content if hasattr(last_msg, "content") else str(last_msg)
