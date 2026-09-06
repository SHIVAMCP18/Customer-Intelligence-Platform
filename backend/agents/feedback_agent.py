import os
from typing import TypedDict
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

load_dotenv()

def _get_llm() -> ChatGroq:
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Check backend/.env")
    return ChatGroq(temperature=0, model_name="openai/gpt-oss-20b", groq_api_key=key)

class AgentState(TypedDict):
    feedback_text: str
    sentiment: str
    pain_points: list[str]
    is_urgent: bool
    summary: str

class FeedbackAnalysis(BaseModel):
    sentiment: str = Field(description="The sentiment of the feedback: positive, negative, or neutral")
    pain_points: list[str] = Field(description="List of specific problems or pain points mentioned")
    is_urgent: bool = Field(description="True if the feedback requires immediate attention (e.g. data loss, critical bug, churn risk)")
    summary: str = Field(description="A concise 1-sentence summary of the feedback")

def analyze_feedback(state: AgentState) -> AgentState:
    """Analyze the feedback text using structured output."""
    llm = _get_llm()
    prompt = f"Analyze the following customer feedback:\n\n{state['feedback_text']}"
    try:
        structured_llm = llm.with_structured_output(FeedbackAnalysis)
        result = structured_llm.invoke([HumanMessage(content=prompt)])
    except Exception as e:
        print(f"[feedback_agent] LLM error: {e}")
        # Return placeholder values indicating overload
        result = FeedbackAnalysis(
            sentiment="unknown",
            pain_points=[],
            is_urgent=False,
            summary="AI service unavailable"
        )
    return {
        "sentiment": result.sentiment,
        "pain_points": result.pain_points,
        "is_urgent": result.is_urgent,
        "summary": result.summary,
    }

# Build the LangGraph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("analyze", analyze_feedback)

# Set entry point
workflow.set_entry_point("analyze")

# Set finish point
workflow.add_edge("analyze", END)

# Compile the graph
feedback_graph = workflow.compile()

def process_feedback(text: str) -> dict:
    """Helper function to invoke the graph."""
    initial_state = AgentState(
        feedback_text=text,
        sentiment="",
        pain_points=[],
        is_urgent=False,
        summary=""
    )
    result = feedback_graph.invoke(initial_state)
    return result
