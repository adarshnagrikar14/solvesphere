import librosa


def load_audio(file_path: str, sr: int = 16000):
    """Load audio file and return array with sample rate."""
    audio_array, sample_rate = librosa.load(file_path, sr=sr)
    return audio_array, sample_rate
