from elevenlabs.client import ElevenLabs
from elevenlabs import stream
import os
from dotenv import load_dotenv

objects_said = set()

def txttospeech(objects_to_be_said):
    load_dotenv()
    chunk_lst = []
    elevenlabs_api = os.environ.get("xi-api-key")

    elevenlabs = ElevenLabs(api_key=elevenlabs_api)
    
    diff_check = False

    for o in objects_to_be_said:
        if o[0] not in objects_said:
            diff_check = True
            break

    if diff_check:
        for o in objects_to_be_said:
            if o[1]:
                s = o[0] + " " + str(o[1]) + " meters away"
                audio_stream = elevenlabs.text_to_speech.stream(
                    text=s,
                    voice_id="TVtDNgumMv4lb9zzFzA2", # normal voice!!!
                    model_id="eleven_multilingual_v2"
                )
                for chunk in audio_stream:
                    if isinstance(chunk, bytes):
                        chunk_lst.append(chunk)
            else:
                audio_stream = elevenlabs.text_to_speech.stream(
                    text=o[0],
                    voice_id="TVtDNgumMv4lb9zzFzA2", # normal voice!!!
                    model_id="eleven_multilingual_v2"
                )
                for chunk in audio_stream:
                    if isinstance(chunk, bytes):
                        chunk_lst.append(chunk)

    objects_said.clear()
    for o in objects_to_be_said:
        objects_said.add(o[0])

    return chunk_lst

        
    # option 1: plays the streamed audio locally
