from config import (
    ULTRAVOX_API_KEY,
    ULTRAVOX_AGENT_ID,
    ULTRAVOX_API_BASE,
    HOST,
    PORT,
    SIP_DOMAIN,
    SIP_USERNAME,
    SIP_PASSWORD,
    SIP_FROM_NUMBER,
    get_webhook_url,
    validate_config,
)
from database import (
    init_db,
    create_call,
    update_call_status,
    log_webhook,
    log_tool_invocation,
    get_call,
    get_all_calls,
    get_call_webhooks,
    get_call_tool_invocations,
)
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from pathlib import Path
import requests
from datetime import datetime
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Ultravox Integration API",
    description="Backend API for Ultravox voice agent integration",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f">>> {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(
        f"<<< {request.method} {request.url.path} - Status: {response.status_code}"
    )
    return response


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

    call_id: Optional[str] = None  # Make optional - get from header
    escalation_reason: str
    priority_level: str  # low, medium, high, critical
    context_summary: str
    customer_sentiment: str  # angry, frustrated, neutral, satisfied, very_satisfied


class LogCallEngagementRequest(BaseModel):
    """Request model for log_call_engagement tool."""

    call_id: Optional[str] = None  # Make optional - get from header
    # initial_contact, understanding_issue, providing_solution, closing_conversation
    call_phase: str
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


class CreateSIPInboundRequest(BaseModel):
    """Request model for creating an inbound SIP call."""

    template_context: Optional[Dict[str, str]] = Field(default_factory=dict)


class CreateSIPOutboundRequest(BaseModel):
    """Request model for creating an outbound SIP call."""

    to_number: str = Field(
        ..., description="Phone number to call (e.g., +917904272100)"
    )
    template_context: Optional[Dict[str, str]] = Field(default_factory=dict)


class CreateSIPCallResponse(BaseModel):
    """Response model for SIP call creation."""

    call_id: str
    status: str
    message: str
    sip_uri: Optional[str] = None
    to_number: Optional[str] = None


class CreateChatRequest(BaseModel):
    """Request model for creating a text chat session."""

    metadata: Optional[Dict[str, str]] = Field(default_factory=dict)


class SendMessageRequest(BaseModel):
    """Request model for sending a message in chat."""

    message: str = Field(..., description="User message text")


class ChatMessageResponse(BaseModel):
    """Response model for chat messages."""

    role: str  # "user" or "agent"
    text: str
    timestamp: str


class CreateChatResponse(BaseModel):
    """Response model for chat creation."""

    chat_id: str
    status: str
    message: str


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database and validate configuration on startup."""
    try:
        await init_db()
        validate_config()

        # Mount static files AFTER routes are set up
        frontend_path = Path(__file__).parent.parent / "frontend"
        if frontend_path.exists():
            app.mount(
                "/static", StaticFiles(directory=str(frontend_path)), name="static"
            )
            logger.info(f"✓ Static files mounted from: {frontend_path}")

        logger.info("=" * 60)
        logger.info(f"Server starting on http://{HOST}:{PORT}")
        logger.info(f"Dashboard: http://{HOST}:{PORT}/")
        logger.info(f"API Docs: http://{HOST}:{PORT}/docs")
        logger.info("=" * 60)

        # Log registered routes
        logger.info("Registered routes:")
        for route in app.routes:
            if hasattr(route, "path"):
                logger.info(f"  {route.path}")
    except Exception as e:
        logger.error(f"Startup error: {e}")
        raise


# Serve frontend at root
@app.get("/", response_class=HTMLResponse)
async def serve_frontend(request: Request):
    """Serve the frontend dashboard."""
    logger.info("=== ROOT ROUTE HIT ===")

    frontend_path = Path(__file__).parent.parent / "frontend"
    frontend_file = frontend_path / "index.html"

    logger.info(f"Frontend path: {frontend_path}")
    logger.info(f"Frontend file: {frontend_file}")
    logger.info(f"File exists: {frontend_file.exists()}")

    if frontend_file.exists():
        logger.info("Serving index.html")
        with open(frontend_file, "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(
            content=html_content,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    logger.error("Frontend file not found!")
    return HTMLResponse(content="""
    <html>
        <body>
            <h1>Frontend not found</h1>
            <p>Path: {}</p>
            <p>API is running at /api/</p>
        </body>
    </html>
    """.format(frontend_file))


# Test endpoint


@app.get("/test")
async def test_route():
    """Test that routes are working."""
    logger.info("TEST ROUTE HIT!")
    return {"message": "Routes are working!", "path": "/test"}


# Health check endpoint


@app.get("/health")
async def health():
    """Health check endpoint."""
    logger.info("HEALTH ROUTE HIT!")
    return {
        "status": "running",
        "service": "Ultravox Integration API",
        "version": "1.0.0",
    }


# Call Management Endpoints
@app.post("/api/calls", response_model=CreateCallResponse)
async def create_ultravox_call(request: CreateCallRequest):
    """
    Create a new Ultravox call.
    Returns the call_id and join_url (WebRTC URL) for client to connect.
    """
    logger.info(f"Creating call with metadata: {request.metadata}")
    try:
        # Prepare the payload for Ultravox API
        payload = {
            "medium": {"webRtc": {}},
            "recordingEnabled": request.recording_enabled,
            "metadata": request.metadata,
            "firstSpeakerSettings": {"agent": {"prompt": request.first_speaker_prompt}},
            "callbacks": {
                "joined": {"url": get_webhook_url()},
                "ended": {"url": get_webhook_url()},
            },
        }

        # Make request to Ultravox API
        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/agents/{ULTRAVOX_AGENT_ID}/calls"
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}",
            )

        response_data = response.json()
        call_id = response_data.get("callId")
        join_url = response_data.get("joinUrl")

        # Store in database
        await create_call(
            call_id=call_id,
            agent_id=ULTRAVOX_AGENT_ID,
            join_url=join_url,
            response_json=response_data,
        )

        return CreateCallResponse(
            call_id=call_id,
            join_url=join_url,
            agent_id=ULTRAVOX_AGENT_ID,
            status="created",
            message="Call created successfully",
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
            "tool_invocations": tool_invocations,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calls/{call_id}/messages")
async def get_call_messages(call_id: str):
    """Get all messages from a call."""
    try:
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Try to fetch from Ultravox API
        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/calls/{call_id}/messages"
        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            data = response.json()
            return {"messages": data.get("results", [])}
        else:
            return {"messages": []}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        return {"messages": []}


@app.get("/api/calls/{call_id}/recording")
async def get_call_recording(call_id: str):
    """Get call recording audio file."""
    try:
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Fetch from Ultravox API
        headers = {"X-API-Key": ULTRAVOX_API_KEY}

        url = f"{ULTRAVOX_API_BASE}/calls/{call_id}/recording"
        response = requests.get(url, headers=headers, stream=True)

        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Recording not found")

        # Stream the audio file
        from fastapi.responses import StreamingResponse

        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"inline; filename=recording-{call_id}.wav"
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching recording: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# SIP Call Endpoints
@app.post("/api/calls/sip/inbound", response_model=CreateSIPCallResponse)
async def create_sip_inbound_call(request: CreateSIPInboundRequest):
    """
    Create an inbound SIP call where users dial in to talk to the agent.
    Returns SIP URI that users can call.
    """
    logger.info("Creating inbound SIP call")
    try:
        payload = {
            "medium": {
                "sip": {
                    "incoming": {"username": SIP_USERNAME, "password": SIP_PASSWORD}
                }
            }
        }

        if request.template_context:
            payload["templateContext"] = request.template_context

        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/agents/{ULTRAVOX_AGENT_ID}/calls"
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}",
            )

        response_data = response.json()
        call_id = response_data.get("callId")

        # Extract SIP URI from response
        sip_uri = response_data.get("medium", {}).get("sip", {}).get("uri", "")

        # Store in database
        await create_call(
            call_id=call_id,
            agent_id=ULTRAVOX_AGENT_ID,
            join_url="",
            response_json=response_data,
        )

        logger.info(f"Inbound SIP call created: {call_id}, URI: {sip_uri}")

        return CreateSIPCallResponse(
            call_id=call_id,
            status="created",
            message="Inbound SIP call created successfully. Users can dial the SIP URI.",
            sip_uri=sip_uri,
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.post("/api/calls/sip/outbound", response_model=CreateSIPCallResponse)
async def create_sip_outbound_call(request: CreateSIPOutboundRequest):
    """
    Create an outbound SIP call to a phone number.
    Agent calls the user at the provided number.
    """
    logger.info(f"Creating outbound SIP call to {request.to_number}")
    try:
        payload = {
            "medium": {
                "sip": {
                    "outgoing": {
                        "to": f"sip:{request.to_number}@{SIP_DOMAIN}",
                        "from": SIP_FROM_NUMBER,
                        "username": SIP_USERNAME,
                        "password": SIP_PASSWORD,
                    }
                }
            }
        }

        if request.template_context:
            payload["templateContext"] = request.template_context

        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/agents/{ULTRAVOX_AGENT_ID}/calls"
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}",
            )

        response_data = response.json()
        call_id = response_data.get("callId")

        # Store in database
        await create_call(
            call_id=call_id,
            agent_id=ULTRAVOX_AGENT_ID,
            join_url="",
            response_json=response_data,
        )

        logger.info(f"Outbound SIP call created: {call_id} to {request.to_number}")

        return CreateSIPCallResponse(
            call_id=call_id,
            status="created",
            message=f"Outbound call initiated to {request.to_number}",
            to_number=request.to_number,
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


# Text Chat Endpoints
@app.post("/api/chats", response_model=CreateChatResponse)
async def create_chat_session(request: CreateChatRequest):
    """
    Create a new text-based chat session with the agent.
    Uses Ultravox MESSAGE_MEDIUM_TEXT.
    """
    logger.info("Creating text chat session")
    try:
        payload = {
            "initialOutputMedium": "MESSAGE_MEDIUM_TEXT",
            "medium": {"webRtc": {"dataMessages": {"transcript": True}}},
            "metadata": request.metadata,
            "callbacks": {
                "joined": {"url": get_webhook_url()},
                "ended": {"url": get_webhook_url()},
            },
        }

        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/agents/{ULTRAVOX_AGENT_ID}/calls"
        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}",
            )

        response_data = response.json()
        chat_id = response_data.get("callId")

        # Store in database
        await create_call(
            call_id=chat_id,
            agent_id=ULTRAVOX_AGENT_ID,
            join_url="",
            response_json=response_data,
        )

        logger.info(f"Text chat session created: {chat_id}")

        return CreateChatResponse(
            chat_id=chat_id,
            status="created",
            message="Chat session created successfully",
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.post("/api/chats/{chat_id}/messages")
async def send_chat_message(chat_id: str, request: SendMessageRequest):
    """
    Send a message in a text chat session.
    The agent will respond via the Ultravox text medium.
    """
    logger.info(f"Sending message to chat {chat_id}: {request.message}")
    try:
        # Verify chat exists
        call = await get_call(chat_id)
        if not call:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Send message to Ultravox
        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/calls/{chat_id}/data-message"
        payload = {
            "type": "user_text_message",
            "text": request.message,
            "urgency": "soon",
        }

        response = requests.post(url, json=payload, headers=headers)

        if response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}",
            )

        response_data = response.json()

        logger.info(f"Message sent successfully to chat {chat_id}")

        return {
            "success": True,
            "message": "Message sent successfully",
            "response": response_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get("/api/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str):
    """
    Get message history for a chat session.
    Returns all messages exchanged in the conversation.
    """
    logger.info(f"Fetching messages for chat {chat_id}")
    try:
        # Verify chat exists
        call = await get_call(chat_id)
        if not call:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Get messages from Ultravox
        headers = {"X-API-Key": ULTRAVOX_API_KEY, "Content-Type": "application/json"}

        url = f"{ULTRAVOX_API_BASE}/calls/{chat_id}/messages"
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ultravox API error: {response.text}",
            )

        messages = response.json()

        return {"chat_id": chat_id, "messages": messages}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get("/api/chats")
async def list_chat_sessions():
    """
    List all text chat sessions.
    """
    try:
        calls = await get_all_calls()
        return {"chats": calls, "count": len(calls)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Webhook Endpoint
@app.post("/api/webhook")
async def receive_webhook(request: Request):
    """
    Receive webhook events from Ultravox.
    Events: call.started, call.joined, call.ended
    """
    logger.info("=== WEBHOOK RECEIVED ===")
    try:
        payload = await request.json()
        event_type = payload.get("event")
        call_data = payload.get("call", {})
        call_id = call_data.get("callId")

        if not call_id:
            raise HTTPException(status_code=400, detail="Invalid webhook payload")

        # Log webhook to database
        await log_webhook(call_id=call_id, event_type=event_type, payload=payload)

        # Check if call exists, if not create it
        existing_call = await get_call(call_id)
        if not existing_call and event_type == "call.started":
            # Create call from webhook data
            agent_id = call_data.get("agentId", "")
            join_url = call_data.get("joinUrl", "")
            await create_call(
                call_id=call_id,
                agent_id=agent_id,
                join_url=join_url,
                response_json=call_data,
            )
            logger.info(f"Created call {call_id} from webhook")

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
                summary=summary,
            )

        logger.info(f"Webhook received: {event_type} for call {call_id}")

        return {"status": "success", "event": event_type, "call_id": call_id}

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Tool Endpoints
@app.post("/api/tools/escalate_to_human", response_model=ToolResponse)
async def escalate_to_human(request: EscalateToHumanRequest, req: Request):
    """
    Tool 1: Escalate to Human
    Called by Ultravox agent when customer needs human intervention.
    """
    try:
        parameters = request.dict()
        call_id = parameters.pop("call_id") or req.headers.get("X-Call-ID", "unknown")

        # Verify call exists
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Log tool invocation and get the inserted ID
        invocation_id = await log_tool_invocation(
            call_id=call_id, tool_name="escalate_to_human", parameters=parameters
        )

        logger.info(
            f"Escalation requested for call {call_id}: {parameters['escalation_reason']}"
        )

        return ToolResponse(
            success=True,
            message="Escalation logged successfully",
            tool_name="escalate_to_human",
            call_id=call_id,
            invocation_id=invocation_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tools/log_call_engagement", response_model=ToolResponse)
async def log_call_engagement(request: LogCallEngagementRequest, req: Request):
    """
    Tool 2: Log Call Engagement
    Called by Ultravox agent at the end of every call to log engagement metrics.
    """
    try:
        parameters = request.dict()
        call_id = parameters.pop("call_id") or req.headers.get("X-Call-ID", "unknown")

        # Verify call exists
        call = await get_call(call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Log tool invocation and get the inserted ID
        invocation_id = await log_tool_invocation(
            call_id=call_id, tool_name="log_call_engagement", parameters=parameters
        )

        logger.info(f"Engagement logged for call {call_id}: {parameters['call_phase']}")

        return ToolResponse(
            success=True,
            message="Engagement metrics logged successfully",
            tool_name="log_call_engagement",
            call_id=call_id,
            invocation_id=invocation_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DO NOT mount static files here - it will be done in startup
# This was causing route conflicts


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
