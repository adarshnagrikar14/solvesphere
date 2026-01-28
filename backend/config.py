import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Ultravox API Configuration
ULTRAVOX_API_KEY = os.getenv("ULTRAVOX_API_KEY", "")
ULTRAVOX_AGENT_ID = os.getenv("ULTRAVOX_AGENT_ID", "")
ULTRAVOX_API_BASE = os.getenv("ULTRAVOX_API_BASE", "https://api.ultravox.ai/api")

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Webhook Configuration
WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL", "http://localhost:8000")

# SIP Configuration
SIP_DOMAIN = os.getenv("SIP_DOMAIN", "")
SIP_USERNAME = os.getenv("SIP_USERNAME", "")
SIP_PASSWORD = os.getenv("SIP_PASSWORD", "")
SIP_FROM_NUMBER = os.getenv("SIP_FROM_NUMBER", "")


def get_webhook_url() -> str:
    """Get the webhook URL for Ultravox callbacks."""
    return f"{WEBHOOK_BASE_URL}/api/webhook"


def validate_config():
    """Validate required configuration."""
    if not ULTRAVOX_API_KEY:
        raise ValueError("ULTRAVOX_API_KEY is required. Please set it in .env file")
    if not ULTRAVOX_AGENT_ID:
        raise ValueError("ULTRAVOX_AGENT_ID is required. Please set it in .env file")

    print("Configuration loaded successfully!")
    print(f"  API Base: {ULTRAVOX_API_BASE}")
    print(f"  Agent ID: {ULTRAVOX_AGENT_ID}")
    print(f"  Webhook URL: {get_webhook_url()}")
    if SIP_DOMAIN:
        print(f"  SIP Domain: {SIP_DOMAIN}")
        print(f"  SIP Username: {SIP_USERNAME}")
