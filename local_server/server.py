"""Server entry point."""
import os
import warnings
from threading import Thread
import uvicorn
from pyngrok import ngrok
import nest_asyncio
from app import create_app
from app.config import config

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
warnings.filterwarnings("ignore")
nest_asyncio.apply()

# Create FastAPI app
app = create_app()


def start_server():
    """Start the FastAPI server with Ngrok tunneling."""
    # Setup Ngrok
    ngrok.set_auth_token(config.NGROK_TOKEN)

    # Run server in thread
    config_obj = uvicorn.Config(
        app, host=config.API_HOST, port=config.API_PORT, log_level=config.LOG_LEVEL
    )
    server = uvicorn.Server(config_obj)
    thread = Thread(target=server.run, daemon=True)
    thread.start()

    print("🟢 Server running\n")

    # Connect Ngrok
    public_url = ngrok.connect(config.API_PORT)
    print(f"✅ API: {public_url}/support\n")

    # Keep running
    try:
        while True:
            pass
    except KeyboardInterrupt:
        print("\n👋 Server stopped")


if __name__ == "__main__":
    start_server()
