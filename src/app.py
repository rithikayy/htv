from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from google import genai
from google.genai import types
from PIL import Image
import json
import base64
import io
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize Gemini client
api_key = os.environ.get("GENAI_API_KEY")
if not api_key:
    raise ValueError("GENAI_API_KEY not set in environment variables")

client = genai.Client(api_key=api_key)

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

# API configuration
config = types.GenerateContentConfig(
    response_mime_type="application/json"
)

prompt = "Detect all of the prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."


@app.route('/')
def index():
    """Serve the frontend HTML page"""
    return render_template('index.html')


@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    emit('connection_response', {'status': 'connected', 'model': ACTIVE_MODEL})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')


@socketio.on('process_frame')
def handle_frame(data):
    """
    Receive frame from frontend, process with Gemini, send results back
    
    Expected data format:
    {
        'image': 'base64_encoded_image_string'
    }
    """
    try:
        # Get base64 image from frontend
        base64_image = data.get('image')
        
        if not base64_image:
            emit('error', {'message': 'No image provided'})
            return
        
        # Remove data URI prefix if present
        if ',' in base64_image:
            base64_image = base64_image.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_image)
        
        # Load into PIL Image using BytesIO buffer
        image_buffer = io.BytesIO(image_bytes)
        pil_image = Image.open(image_buffer)
        
        # Get image dimensions
        width, height = pil_image.size
        
        print(f"Processing image: {width}x{height}")
        
        # Call Gemini API
        response = client.models.generate_content(
            model=ACTIVE_MODEL,
            contents=[pil_image, prompt],
            config=config
        )
        
        # Parse bounding boxes
        bounding_boxes = json.loads(response.text)
        
        # Convert normalized coordinates to absolute
        detections = []
        for bbox in bounding_boxes:
            abs_y1 = int(bbox["box_2d"][0]/1000 * height)
            abs_x1 = int(bbox["box_2d"][1]/1000 * width)
            abs_y2 = int(bbox["box_2d"][2]/1000 * height)
            abs_x2 = int(bbox["box_2d"][3]/1000 * width)
            
            detections.append({
                "label": bbox.get("label", "object"),
                "confidence": bbox.get("confidence", 1.0),
                "box": {
                    "x1": abs_x1,
                    "y1": abs_y1,
                    "x2": abs_x2,
                    "y2": abs_y2
                },
                "normalized": bbox["box_2d"]
            })
        
        print(f"Detected {len(detections)} objects")
        
        # Send results back to frontend
        emit('detection_result', {
            'success': True,
            'image_size': {'width': width, 'height': height},
            'detections': detections,
            'count': len(detections)
        })
        
    except Exception as e:
        print(f"Error processing frame: {e}")
        emit('error', {'message': str(e)})


if __name__ == '__main__':
    print("Starting WebSocket server on http://localhost:5000")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)