import pyaudio
import wave
import requests
import keyboard
import time
import threading
from datetime import datetime


class VoiceRecorder:
    """Handles voice recording and API communication."""

    def __init__(self, api_url: str):
        self.api_url = api_url
        self.CHUNK = 1024
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1
        self.RATE = 16000
        self.frames = []
        self.recording = False
        self.p = pyaudio.PyAudio()
        self.record_thread = None

    def _recording_loop(self):
        """Internal recording loop."""
        self.stream = self.p.open(
            format=self.FORMAT,
            channels=self.CHANNELS,
            rate=self.RATE,
            input=True,
            frames_per_buffer=self.CHUNK,
        )

        while self.recording:
            data = self.stream.read(self.CHUNK)
            self.frames.append(data)

        self.stream.stop_stream()
        self.stream.close()

    def start_recording(self):
        """Start recording audio."""
        if self.recording:
            return
        self.frames = []
        self.recording = True
        self.record_thread = threading.Thread(target=self._recording_loop, daemon=True)
        self.record_thread.start()
        print("🎤 Recording... Press 'S' to stop")

    def stop_recording(self):
        """Stop recording audio."""
        if self.recording:
            self.recording = False
            print("⏹️  Recording stopped")

    def save_audio(self, filename: str):
        """Save recorded audio to file."""
        wf = wave.open(filename, "wb")
        wf.setnchannels(self.CHANNELS)
        wf.setsampwidth(self.p.get_sample_size(self.FORMAT))
        wf.setframerate(self.RATE)
        wf.writeframes(b"".join(self.frames))
        wf.close()
        print(f"💾 Saved: {filename}")

    def send_to_api(self, filename: str):
        """Send audio file to API."""
        print("📤 Sending to API...")
        try:
            with open(filename, "rb") as f:
                response = requests.post(self.api_url, files={"audio": f})

            if response.status_code == 200:
                result = response.json()
                print("\n" + "=" * 60)
                print("🤖 AI RESPONSE:")
                print("=" * 60)
                print(result["response"])
                print("=" * 60 + "\n")
            else:
                print(f"❌ Error: {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")

    def cleanup(self):
        """Clean up resources."""
        self.p.terminate()
