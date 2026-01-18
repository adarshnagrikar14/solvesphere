# Voice-Based Customer Support AI

## 📁 Project Structure

```
Hackathon-Tcs/
├── app/                           # Main application module
│   ├── __init__.py               # App factory
│   ├── config.py                 # Environment configuration
│   ├── core/                     # Core business logic
│   │   ├── __init__.py
│   │   └── prompts.py            # System prompts
│   ├── models/                   # AI model management
│   │   ├── __init__.py
│   │   └── ai_model.py           # Model loading & inference
│   ├── routes/                   # API endpoints
│   │   ├── __init__.py
│   │   └── support.py            # Support endpoint
│   └── utils/                    # Utilities
│       ├── __init__.py
│       └── audio_processor.py    # Audio processing
│
├── client/                        # Client module
│   ├── __init__.py
│   └── voice_recorder.py         # Voice recording & API calls
│
├── prompts/                       # System prompts
│   └── system_prompt.txt
│
├── server.py                      # Server entry point
├── client_app.py                  # Client entry point
├── requirements.txt               # Dependencies
├── .env                          # Environment variables (local)
├── .env.example                  # Environment template
└── README.md                     # This file
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your tokens
# - HF_TOKEN: Your Hugging Face API token
# - NGROK_TOKEN: Your Ngrok authentication token
# - SERVER_URL: Updated with your Ngrok URL (after starting server)
```

### 2. Start Server

```bash
python server.py
```

The server will:
- Load the AI model
- Start on `http://localhost:8001`
- Create a public Ngrok tunnel
- Display the public URL (e.g., `https://xxx.ngrok.io/support`)

### 3. Start Client

In another terminal, update `SERVER_URL` in `.env` with your public URL, then:

```bash
python client_app.py
```

Controls:
- **R** - Start recording
- **S** - Stop & send to API
- **Q** - Quit

## 🔧 Configuration

All settings are in `.env`:

| Variable | Purpose |
|----------|---------|
| `API_HOST` | Server host (default: 0.0.0.0) |
| `API_PORT` | Server port (default: 8001) |
| `LOG_LEVEL` | Logging level (default: error) |
| `MODEL_ID` | Hugging Face model ID |
| `DEVICE` | auto/cuda/cpu (default: auto) |
| `HF_TOKEN` | Hugging Face API token |
| `NGROK_TOKEN` | Ngrok auth token |
| `SERVER_URL` | Client API endpoint |

## 📦 Key Modules

### `app/config.py`
Centralized configuration management with `.env` support. Access via:
```python
from app.config import config
print(config.API_PORT)
```

### `app/models/ai_model.py`
Model loading and inference:
```python
from app.models.ai_model import get_model_manager
manager = get_model_manager()
response = manager.generate(prompt, audio_array, sample_rate)
```

### `app/routes/support.py`
FastAPI endpoint:
- POST `/support` - Process audio and return AI response

### `client/voice_recorder.py`
Voice recording and API communication:
```python
from client.voice_recorder import VoiceRecorder
recorder = VoiceRecorder(api_url="http://localhost:8001/support")
```

## 🎯 Adding New Features

### Add a new route:
1. Create file in `app/routes/`
2. Define router with FastAPI
3. Import in `app/__init__.py`

### Add utilities:
1. Create file in `app/utils/`
2. Import in `app/utils/__init__.py`

### Add configuration:
1. Add to `app/config.py`
2. Add to `.env` and `.env.example`

## ⚙️ Clean Import System

All modules export via `__init__.py`:

```python
# Instead of:
from app.models.ai_model import AIModelManager

# Use:
from app.models import AIModelManager
```

This keeps imports clean and organized!

## 🔒 Security Notes

- Never commit `.env` with real tokens
- Use `.env.example` as template
- Rotate tokens regularly
- Keep `requirements.txt` updated

## 📝 System Prompt

Customizable in `prompts/system_prompt.txt`. Defines AI behavior for:
- Product questions
- Order issues
- Complaints
- General inquiries
- Complex issue escalation
