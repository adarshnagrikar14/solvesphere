import os
import tempfile
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from app.models.ai_model import get_model_manager
from app.utils.audio_processor import load_audio
from app.core.prompts import get_system_prompt

router = APIRouter()


@router.post("/support")
async def customer_support(audio: UploadFile = File(...)):
    """Process customer support request with audio."""
    try:
        # Read audio file
        audio_bytes = await audio.read()

        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(audio_bytes)
            temp_path = tmp.name

        try:
            # Load system prompt
            system_prompt = get_system_prompt()

            # Load audio
            audio_array, sr = load_audio(temp_path)

            # Generate response
            model_manager = get_model_manager()
            response = model_manager.generate(system_prompt, audio_array, sr)

            return JSONResponse({"response": response})

        finally:
            # Cleanup temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
