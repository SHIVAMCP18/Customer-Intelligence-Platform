from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.feedback_agent import process_feedback

router = APIRouter(prefix="/feedback", tags=["feedback"])

class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    sentiment: str
    pain_points: list[str]
    is_urgent: bool
    summary: str

@router.post("/", response_model=AnalyzeResponse)
async def analyze_feedback_endpoint(body: AnalyzeRequest):
    """
    Analyze a single piece of customer feedback using the LangGraph agent.
    Returns sentiment, pain points, urgency flag, and a summary.
    """
    if not body.text or len(body.text.strip()) < 5:
        raise HTTPException(status_code=422, detail="Feedback text is too short.")
    result = process_feedback(body.text)
    return AnalyzeResponse(
        sentiment=result["sentiment"],
        pain_points=result["pain_points"],
        is_urgent=result["is_urgent"],
        summary=result["summary"],
    )
