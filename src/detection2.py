

from google import genai
from google.genai import types
from PIL import Image
import json
import cv2
import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import base64
import io
from txtspeech import txttospeech

# Load environment variables from .env file
load_dotenv()

# Initialize client with API key
api_key = os.environ.get("GENAI_API_KEY")
if not api_key:
    raise ValueError("Please set GENAI_API_KEY in your .env file")

client = genai.Client(api_key=api_key)

prompt = "Detect all of the prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."

# Try to find a working model
MODELS_TO_TRY = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"]
ACTIVE_MODEL = None

print("Testing available models...")
for model in MODELS_TO_TRY:
    try:
        test_response = client.models.generate_content(
            model=model,
            contents="test"
        )
        ACTIVE_MODEL = model
        print(f"Using model: {ACTIVE_MODEL}")
        break
    except Exception as e:
        print(f"{model} not available")

if not ACTIVE_MODEL:
    raise ValueError("No working Gemini model found. Check your API key.")

#Distance configuration

# Known object dimensions (real-world measurements in cm)
# Add more objects as needed
KNOWN_OBJECTS = {
    "person": {"width_cm": 50, "height_cm": 170},
    "laptop": {"width_cm": 35, "height_cm": 25},
    "phone": {"width_cm": 7, "height_cm": 15},
    "bottle": {"width_cm": 7, "height_cm": 20},
    "cup": {"width_cm": 8, "height_cm": 10},
    "book": {"width_cm": 15, "height_cm": 20},
    "chair": {"width_cm": 45, "height_cm": 90},
    "monitor": {"width_cm": 50, "height_cm": 30},
    # Add more objects and their dimensions here
}

# Focal length - CALIBRATE THIS FOR YOUR CAMERA!
# Run calibrate_focal_length.py to get the correct value
FOCAL_LENGTH = 350  # Default value, needs calibration


#Distance Estimation Functions

def find_marker(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(gray, 35, 125)
    cnts = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cnts = cnts[0] if len(cnts) == 2 else cnts[1]

    if len(cnts) == 0:
        return None

    c = max(cnts, key=cv2.contourArea)
    return cv2.minAreaRect(c)


def distance_to_camera(knownWidth, focalLength, perWidth):
    if perWidth == 0:
        return None
    return (knownWidth * focalLength) / perWidth


def estimate_object_distance(box, label):
    # Get object info
    object_info = KNOWN_OBJECTS.get(label.lower())

    if not object_info:
        # Unknown object, can't estimate distance
        return None

    # Calculate bounding box dimensions
    box_width = box['x2'] - box['x1']
    box_height = box['y2'] - box['y1']

    # Use height for distance estimation (usually more reliable)
    known_height = object_info['height_cm']

    # Calculate distance
    distance = distance_to_camera(known_height, FOCAL_LENGTH, box_height)

    return distance

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO with CORS support
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

@socketio.on('connect')
def handle_connect():
    print('Client connected:', request.sid)
    emit('connection_response', {'status': 'connected', 'message': 'Successfully connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected:', request.sid)

@socketio.on('detect_frame')
def handle_detect_frame(data):
    try:
        base64_image = data['image']
        custom_prompt = data.get('prompt', prompt)

        # Remove the data URL prefix if present
        if ',' in base64_image:
            base64_image = base64_image.split(',')[1]

        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_image)

        # Open image with PIL
        pil_image = Image.open(io.BytesIO(image_bytes))
        width, height = pil_image.size

        # Configure generation
        config = types.GenerateContentConfig(
            temperature=0.4,
            response_mime_type="application/json"
        )

        # Call Gemini API using client
        response = client.models.generate_content(
            model=ACTIVE_MODEL,
            contents=[pil_image, custom_prompt],
            config=config
        )
        t2s_list=[]
        # Parse bounding boxes
        bounding_boxes = json.loads(response.text)
        last_detections = []
        for bbox in bounding_boxes:
            abs_y1 = int(bbox["box_2d"][0] / 1000 * height)
            abs_x1 = int(bbox["box_2d"][1] / 1000 * width)
            abs_y2 = int(bbox["box_2d"][2] / 1000 * height)
            abs_x2 = int(bbox["box_2d"][3] / 1000 * width)
            label = bbox.get("label", "object")
            box = {
                        "x1": abs_x1,
                        "y1": abs_y1,
                        "x2": abs_x2,
                        "y2": abs_y2
                    }
            distance_cm = estimate_object_distance(box, label)

            detection = {
                "coords": [abs_x1, abs_y1, abs_x2, abs_y2],
                "label": label,
                "distance_cm": distance_cm,
                "distance_m": round(distance_cm / 100, 2) if distance_cm else None
            }
            t2s_list.append([label, round(distance_cm / 100, 2) if distance_cm else None])
            last_detections.append(detection)
        audio_byte = txttospeech(t2s_list)

        emit('detection_result', {
            'objects': last_detections,
            'count': len(last_detections),
            'image_size': {'width': width, 'height': height},
            'audio': audio_byte,
            'success': True
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
