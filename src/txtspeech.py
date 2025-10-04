from elevenlabs.client import ElevenLabs
from elevenlabs import stream
import os
from dotenv import load_dotenv


def txttospeech(label, distance):
    load_dotenv()

    elevenlabs_api = os.environ.get("xi-api-key")

    elevenlabs = ElevenLabs(api_key=elevenlabs_api)

    if distance:
        s = label + " " + str(distance) + "m away"
        audio_stream = elevenlabs.text_to_speech.stream(
            text=s,
            voice_id="TVtDNgumMv4lb9zzFzA2", # normal voice!!!
            model_id="eleven_multilingual_v2"
        )
    else:
        audio_stream = elevenlabs.text_to_speech.stream(
            text=label,
            voice_id="TVtDNgumMv4lb9zzFzA2", # normal voice!!!
            model_id="eleven_multilingual_v2"
        )

    # option 1: play the streamed audio locally
    stream(audio_stream)

    # option 2: process the audio bytes manually
    for chunk in audio_stream:
        if isinstance(chunk, bytes):
            print(chunk)
