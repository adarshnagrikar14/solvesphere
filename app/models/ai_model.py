import torch
import warnings
from transformers import AutoProcessor, AutoModel
from huggingface_hub import login
from app.config import config

warnings.filterwarnings("ignore")


class AIModelManager:
    """Manages AI model loading and inference with lazy loading."""

    def __init__(self):
        self.processor = None
        self.model = None
        self.device = self._get_device()
        self._initialized = False

    def _get_device(self) -> str:
        """Get device (cuda or cpu)."""
        if config.DEVICE == "auto":
            return "cuda" if torch.cuda.is_available() else "cpu"
        return config.DEVICE

    def _initialize(self):
        """Initialize model and processor (called on first use)."""
        if self._initialized:
            return

        print("⏳ Loading model... (first request)")
        login(token=config.HF_TOKEN)

        self.processor = AutoProcessor.from_pretrained(
            config.MODEL_ID, trust_remote_code=True, token=config.HF_TOKEN
        )

        self.model = AutoModel.from_pretrained(
            config.MODEL_ID,
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True,
            trust_remote_code=True,
            token=config.HF_TOKEN,
        ).to(self.device)

        print(f"✓ Model loaded on {self.device}")
        self._initialized = True

    def generate(self, prompt: str, audio_array, sr: int) -> str:
        """Generate response from audio and prompt."""
        self._initialize()  # Lazy load on first call
        inputs = self.processor(
            text=prompt, audio=audio_array, sampling_rate=sr, return_tensors="pt"
        ).to(self.device)

        with torch.cuda.amp.autocast():
            output = self.model.generate(
                **inputs, max_new_tokens=512, do_sample=True, temperature=0.2
            )

        full_response = self.processor.batch_decode(output, skip_special_tokens=True)[0]
        clean_response = (
            full_response.split("<|audio|>")[-1].strip()
            if "<|audio|>" in full_response
            else full_response
        )

        return clean_response


# Global model instance
_model_manager: AIModelManager = None


def get_model_manager() -> AIModelManager:
    """Get or create model manager instance."""
    global _model_manager
    if _model_manager is None:
        _model_manager = AIModelManager()
    return _model_manager
