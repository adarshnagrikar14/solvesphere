from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import requests
from datetime import datetime
import uvicorn

from database import (
    init_db,
    create_call,
    update_call_status,
    log_webhook,
    log_tool_invocation,
    get_call,
    get_all_calls,
    get_call_webhooks,
    get_call_tool_invocations
)
from config import (
    ULTRAVOX_API_KEY,
    ULTRAVOX_AGENT_ID,
    ULTRAVOX_API_BASE,
    HOST,
    PORT,
    get_webhook_url,
    validate_config
)

app = FastAPI(
    title="Ultravox Integration API",
    description="Backend API for Ultravox voice agent integration",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic Models
class CreateCallRequest(BaseModel):
    """Request model for creating a new call."""
    metadata: Optional[Dict[str, str]] = Field(default_factory=dict)
    recording_enabled: bool = Field(default=True)
    first_speaker_prompt: Optional[str] = Field(
        default="(New Call) Respond as if you are answering the phone."
    )


class CreateCallResponse(BaseModel):
    """Response model for call creation."""
    call_id: str
    join_url: str
    agent_id: str
    status: str
    message: str


class EscalateToHumanRequest(BaseModel):
    """Request model for escalate_to_human tool."""
    call_id: str
    escalation_reason: str
    priority_level: str  # low, medium, high, critical
    context_summary: str
    customer_sentiment: str  # angry, frustrated, neutral, satisfied, very_satisfied


class LogCallEngagementRequest(BaseModel):
    """Request model for log_call_engagement tool."""
    call_id: str
    call_phase: str  # initial_contact, understanding_issue, providing_solution, closing_conversation
    customer_sentiment: str  # angry, frustrated, neutral, satisfied, very_satisfied
    resolution_likelihood: int = Field(..., ge=0, le=100)
    issue_resolved: bool
    engagement_notes: Optional[str] = None


class ToolResponse(BaseModel):
    """Generic response for tool invocations."""
    success: bool
    message: str
    tool_name: str
    call_id: str
    invocation_id: int


class WebhookPayload(BaseModel):
    """Webhook payload from Ultravox."""
    event: str
    call: Dict[str, Any]


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database and validate configuration on startup."""
    try:
        await init_db()
        validate_config()
        print(f"Server starting on http://{HOST}:{PORT}")
    except Exception as e:
        print(f"Startup error: {e}")
        raise


# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "running",
        "service": "Ultravox Integration API",
        "version": "1.0.0"
    }


# Call Management Endpoints
@app.post("/api/calls", response_model=CreateCallResponse)
async def create_ultravox_call(request: CreateCallRequest):
    """
    Create a new Ultravox call.
    Returns the call_id and join_url (WebRTC URL) for client to connect.
    """
    try:
        # Prepare the payload for Ultravox API
        payload = {
            "medium": {"webRtc": {}},
            "recordingEnabled": request.recording_enabled,
            "metadata": request.metadata,
            "firstSpeakerSettings": {
                "agent": {
                    "prompt": request.first_speaker_prompt
                }
            },
            "callbacks": {
                "joined": {"url": get_webhook_url()},
                "ended": {"url": get_webhook_url()},
            }
        }

        # Make request to Ultravox API
        headers = {
            "X-API-Key": ULTRAVOX_API_KEY,
            "Content-Type": "application/json"
        }

        url = f"{ULTRAVOX_API_BASE}/agents/{ULTRAVOX_AGENT_ID}/calls"
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}"
            )

        response_data = response.json()
        call_id = response_data.get("callId")
        join_url = response_data.get("joinUrl")

        # Store in database
        await create_call(
            call_id=call_id,
            agent_id=ULTRAVOX_AGENT_ID,
            join_url=join_url,
            response_json=response_data
        )

        return CreateCallResponse(
            call_id=call_id,
            join_url=join_url,
            agent_id=ULTRAVOX_AGENT_ID,
            status="created",
            message="Call created successfully"
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get("/api/calls")
async def list_calls():
    """List all calls."""
    try:
        calls = await get_all_calls()
        return {"calls": calls, "count": len(calls)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calls/{call_id}")
async def get_call_details(call_id: str):
    """Get details of a specific call including webhooks and tool invocations."""
    try:
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        webhooks = await get_call_webhooks(call_id)
        tool_invocations = await get_call_tool_invocations(call_id)

        return {
            "call": call,
            "webhooks": webhooks,
            "tool_invocations": tool_invocations
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Webhook Endpoint
@app.post("/api/webhook")
async def receive_webhook(request: Request):
    """
    Receive webhook events from Ultravox.
    Events: call.started, call.joined, call.ended
    """
    try:
        payload = await request.json()
        event_type = payload.get("event")
        call_data = payload.get("call", {})
        call_id = call_data.get("callId")

        if not call_id:
            raise HTTPException(status_code=400, detail="Invalid webhook payload")

        # Log webhook to database
        await log_webhook(call_id=call_id, event_type=event_type, payload=payload)

        # Update call status based on event type
        if event_type == "call.started":
            await update_call_status(call_id, "started")
        elif event_type == "call.joined":
            joined_at = call_data.get("joined")
            await update_call_status(call_id, "joined", joined_at=joined_at)
        elif event_type == "call.ended":
            ended_at = call_data.get("ended")
            end_reason = call_data.get("endReason")
            short_summary = call_data.get("shortSummary")
            summary = call_data.get("summary")
            await update_call_status(
                call_id,
                "ended",
                ended_at=ended_at,
                end_reason=end_reason,
                short_summary=short_summary,
                summary=summary
            )

        print(f"Webhook received: {event_type} for call {call_id}")

        return {"status": "success", "event": event_type, "call_id": call_id}

    except Exception as e:
        print(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Tool Endpoints
@app.post("/api/tools/escalate_to_human", response_model=ToolResponse)
async def escalate_to_human(request: EscalateToHumanRequest):
    """
    Tool 1: Escalate to Human
    Called by Ultravox agent when customer needs human intervention.
    """
    try:
        parameters = request.dict()
        call_id = parameters.pop("call_id")

        # Verify call exists
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Log tool invocation
        await log_tool_invocation(
            call_id=call_id,
            tool_name="escalate_to_human",
            parameters=parameters
        )

        print(f"Escalation requested for call {call_id}: {parameters['escalation_reason']}")

        # Get the invocation ID (last inserted row)
        import sqlite3
        conn = sqlite3.connect("backend/ultravox.db")
        invocation_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        return ToolResponse(
            success=True,
            message="Escalation logged successfully",
            tool_name="escalate_to_human",
            call_id=call_id,
            invocation_id=invocation_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/log_call_engagement", response_model=ToolResponse)
async def log_call_engagement(request: LogCallEngagementRequest):
    """
    Tool 2: Log Call Engagement
    Called by Ultravox agent at the end of every call to log engagement metrics.
    """
    try:
        parameters = request.dict()
        call_id = parameters.pop("call_id")

        # Verify call exists
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Log tool invocation
        await log_tool_invocation(
            call_id=call_id,
            tool_name="log_call_engagement",
            parameters=parameters
        )

        print(f"Engagement logged for call {call_id}: {parameters['call_phase']}")

        # Get the invocation ID
        import sqlite3
        conn = sqlite3.connect("backend/ultravox.db")
        invocation_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        return ToolResponse(
            success=True,
            message="Engagement metrics logged successfully",
            tool_name="log_call_engagement",
            call_id=call_id,
            invocation_id=invocation_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
