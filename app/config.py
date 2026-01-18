import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration."""

    # API Settings
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8001"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "error")

    # Model Settings
    MODEL_ID: str = os.getenv("MODEL_ID", "fixie-ai/ultravox-v0_5-llama-3_2-1b")
    DEVICE: str = os.getenv("DEVICE", "auto")

    # API Tokens
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    NGROK_TOKEN: str = os.getenv("NGROK_TOKEN", "")

    # Client Settings
    SERVER_URL: str = os.getenv("SERVER_URL", "http://localhost:8001/support")


config = Config()
