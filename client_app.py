"""Client entry point."""

import time
import keyboard
from datetime import datetime
from client.voice_recorder import VoiceRecorder
from app.config import config


def main():
    """Run voice client."""
    recorder = VoiceRecorder(api_url=config.SERVER_URL)

    print("\n" + "=" * 60)
    print("🎙️  VOICE CLIENT")
    print("=" * 60)
    mode_indicator = "🌐 API" if config.SERVER_MODE.lower() == "api" else "🏠 LOCAL"
    print(f"Mode: {mode_indicator}")
    print(f"Server: {config.SERVER_URL}")
    print("=" * 60)
    print("Press 'R' to start recording")
    print("Press 'S' to stop and send")
    print("Press 'Q' to quit")
    print("=" * 60 + "\n")

    try:
        while True:
            if keyboard.is_pressed("r"):
                if not recorder.recording:
                    recorder.start_recording()

            if keyboard.is_pressed("s"):
                if recorder.recording:
                    recorder.stop_recording()
                    filename = (
                        f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
                    )
                    recorder.save_audio(filename)
                    recorder.send_to_api(filename)
                    print("\nReady for next recording. Press 'R' to record again.\n")

            if keyboard.is_pressed("q"):
                print("\n👋 Goodbye!")
                break

            time.sleep(0.01)

    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    finally:
        recorder.cleanup()


if __name__ == "__main__":
    main()
