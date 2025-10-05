from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from google import genai
from google.genai import types
from PIL import Image
from elevenlabs.client import ElevenLabs
from elevenlabs import stream
import json
import base64
import io
import os
from dotenv import load_dotenv
import logging
import time

# Load environment variables
load_dotenv()

# Configure logging with more detail
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('GENAI_API_KEY', 'dev-secret-key-change-in-production')

# Enable CORS for all origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize Socket.IO with verbose logging
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    async_mode='threading'
)

# Initialize Gemini client
api_key = os.environ.get("GENAI_API_KEY")
if not api_key:
    raise ValueError("GENAI_API_KEY not set in environment variables")

client = genai.Client(api_key=api_key)

elevenlabs_api = os.environ.get("xi-api-key")
if not elevenlabs_api:
    raise ValueError("xi-api-key not set in environment variables")

elevenlabs = ElevenLabs(api_key=elevenlabs_api)

# Track objects that have been announced
objects_said = set()

# Try to find a working model
MODELS_TO_TRY = ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-pro"]
ACTIVE_MODEL = None

logger.info("Testing available models...")
for model in MODELS_TO_TRY:
    try:
        test_response = client.models.generate_content(
            model=model,
            contents="test"
        )
        ACTIVE_MODEL = model
        logger.info(f"✓ Using model: {ACTIVE_MODEL}")
        break
    except Exception as e:
        logger.warning(f"✗ {model} not available: {e}")

if not ACTIVE_MODEL:
    raise ValueError("No working Gemini model found. Check your API key.")

# Gemini API configuration
config = types.GenerateContentConfig(
    response_mime_type="application/json"
)

# Detection prompt
prompt = "Detect all of the prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."

def txttospeech(objects_to_be_said):
    chunk_lst = []    
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
                    voice_id="Myn1LuZgd2qPMOg9BNtC", # normal voice!!!
                    model_id="eleven_multilingual_v2"
                )
                for chunk in audio_stream:
                    if isinstance(chunk, bytes):
                        chunk_lst.append(chunk)
            else:
                audio_stream = elevenlabs.text_to_speech.stream(
                    text=o[0],
                    voice_id="Myn1LuZgd2qPMOg9BNtC", # normal voice!!!
                    model_id="eleven_multilingual_v2"
                )
                for chunk in audio_stream:
                    if isinstance(chunk, bytes):
                        chunk_lst.append(chunk)

    objects_said.clear()
    for o in objects_to_be_said:
        objects_said.add(o[0])

    if chunk_lst:
        audio_data = b''.join(chunk_lst)
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        return audio_base64
    
    return None

# @app.route('/')
# def index():
#     """Serve the frontend HTML page"""
#     return render_template('index.html')
# Known object dimensions
KNOWN_OBJECTS = {
    "person": {"width_cm": 50, "height_cm": 170},
    "laptop": {"width_cm": 35, "height_cm": 25},
    "phone": {"width_cm": 7, "height_cm": 15},
    "bottle": {"width_cm": 7, "height_cm": 20},
    "cup": {"width_cm": 8, "height_cm": 10},
    "book": {"width_cm": 15, "height_cm": 20},
    "chair": {"width_cm": 45, "height_cm": 90},
    "monitor": {"width_cm": 50, "height_cm": 30},
    "keyboard": {"width_cm": 45, "height_cm": 15},
    "mouse": {"width_cm": 6, "height_cm": 10},
}

FOCAL_LENGTH = 800


def distance_to_camera(known_height, focal_length, pixel_height):
    if pixel_height == 0:
        return None
    return (known_height * focal_length) / pixel_height


def estimate_object_distance(norm_box, label, image_height):
    object_info = None
    label_lower = label.lower()
    
    if label_lower in KNOWN_OBJECTS:
        object_info = KNOWN_OBJECTS[label_lower]
    else:
        for known_obj, dimensions in KNOWN_OBJECTS.items():
            if known_obj in label_lower or label_lower in known_obj:
                object_info = dimensions
                break
    
    if not object_info:
        return None
    
    box_height_normalized = norm_box['height']
    pixel_height = box_height_normalized * image_height
    
    if pixel_height <= 0:
        return None
    
    known_height_cm = object_info['height_cm']
    distance_cm = distance_to_camera(known_height_cm, FOCAL_LENGTH, pixel_height)
    
    if distance_cm is None:
        return None
    
    distance_m = round(distance_cm / 100, 2)
    
    if distance_m < 0.1 or distance_m > 100:
        return None
    
    return distance_m


# Add a simple HTTP endpoint for testing
@app.route('/')
def index():
    return jsonify({
        'status': 'running',
        'model': ACTIVE_MODEL,
        'message': 'Object detection server is running',
        'endpoints': {
            'http': '/',
            'websocket': '/socket.io/'
        }
    })


@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'model': ACTIVE_MODEL
    })


@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    logger.info(f'='*60)
    logger.info(f'✓ NEW CLIENT CONNECTED')
    logger.info(f'  Client ID: {client_id}')
    logger.info(f'  Remote Address: {request.remote_addr}')
    logger.info(f'  User Agent: {request.headers.get("User-Agent", "Unknown")}')
    logger.info(f'='*60)
    
    emit('connection_status', {
        'status': 'connected',
        'model': ACTIVE_MODEL,
        'message': 'Successfully connected to object detection server with distance estimation',
        'server_time': time.time()
    })


@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid
    logger.info(f'✗ Client disconnected: {client_id}')


@socketio.on('process_frame')
def handle_frame(data):
    start_time = time.time()
    client_id = request.sid
    
    try:
        base64_image = data.get('image')
        original_width = data.get('width')
        original_height = data.get('height')
        timestamp = data.get('timestamp')
        camera_facing = data.get('cameraFacing', 'unknown')
        
        if not base64_image:
            logger.error(f'[{client_id}] No image provided in payload')
            emit('detection_error', {'error': 'No image provided'})
            return
        
        logger.info(f'[{client_id}] Processing frame - Camera: {camera_facing}, Size: {original_width}x{original_height}')
        
        # Decode base64
        try:
            if ',' in base64_image:
                base64_image = base64_image.split(',')[1]
            
            image_bytes = base64.b64decode(base64_image)
            logger.debug(f'[{client_id}] Decoded {len(image_bytes)} bytes')
        except Exception as e:
            logger.error(f'[{client_id}] Failed to decode base64: {e}')
            emit('detection_error', {'error': 'Invalid base64 image'})
            return
        
        # Load image
        try:
            image_buffer = io.BytesIO(image_bytes)
            pil_image = Image.open(image_buffer)
            width, height = pil_image.size
            logger.debug(f'[{client_id}] Image size: {width}x{height}')
        except Exception as e:
            logger.error(f'[{client_id}] Failed to load image: {e}')
            emit('detection_error', {'error': 'Failed to process image'})
            return
        
        # Call Gemini API
        try:
            logger.debug(f'[{client_id}] Calling Gemini API...')
            api_start = time.time()
            
            response = client.models.generate_content(
                model=ACTIVE_MODEL,
                contents=[pil_image, prompt],
                config=config
            )
            
            api_time = time.time() - api_start
            bounding_boxes = json.loads(response.text)
            logger.info(f'[{client_id}] Gemini detected {len(bounding_boxes)} objects in {api_time:.2f}s')
            
        except Exception as e:
            logger.error(f'[{client_id}] Gemini API error: {e}')
            emit('detection_error', {'error': f'AI model error: {str(e)}'})
            return
        
        # Process detections
        detections = []
        for bbox in bounding_boxes:
            try:
                norm_y1 = bbox["box_2d"][0] / 1000.0
                norm_x1 = bbox["box_2d"][1] / 1000.0
                norm_y2 = bbox["box_2d"][2] / 1000.0
                norm_x2 = bbox["box_2d"][3] / 1000.0
                
                norm_width = norm_x2 - norm_x1
                norm_height = norm_y2 - norm_y1
                
                norm_box = {
                    'x': norm_x1,
                    'y': norm_y1,
                    'width': norm_width,
                    'height': norm_height
                }
                
                label = bbox.get('label', 'object')
                distance_m = estimate_object_distance(norm_box, label, height)
                
                detection = {
                    'x': norm_x1,
                    'y': norm_y1,
                    'width': norm_width,
                    'height': norm_height,
                    'label': label,
                    'confidence': bbox.get('confidence', 0.9),
                    'distance_m': distance_m
                }
                
                detections.append(detection)
                
            except (KeyError, IndexError) as e:
                logger.warning(f'[{client_id}] Skipping malformed bbox: {e}')
                continue
        
        print(f"Detected {len(detections)} objects")
        # GENERATE AUDIO FOR DETECTIONS
        audio_base64 = None
        if detections:
            # Prepare objects for TTS: [(label, None), ...]
            objects_for_tts = [(det['label'], None) for det in detections]
            audio_base64 = txttospeech(objects_for_tts)
        # Send results back to frontend WITH AUDIO
        processing_time = time.time() - start_time
        
        result = {
            'success': True,
            'detections': detections,
            'count': len(detections),
            'audio': audio_base64,  # ADD THIS LINE
            'timestamp': timestamp,
            'processingTime': round(processing_time, 3),
            'distanceEnabled': True
        }
        
        logger.info(f'[{client_id}] ✓ Sending {len(detections)} detections (processed in {processing_time:.3f}s)')
        emit('detection_result', result)
        
    except Exception as e:
        logger.error(f'[{client_id}] Unexpected error: {e}', exc_info=True)
        emit('detection_error', {'error': 'Server error occurred'})


@socketio.on('ping')
def handle_ping():
    client_id = request.sid
    logger.debug(f'[{client_id}] Received ping')
    emit('pong', {'timestamp': time.time()})


# Error handlers
@socketio.on_error_default
def default_error_handler(e):
    logger.error(f'Socket.IO error: {e}', exc_info=True)


if __name__ == '__main__':
    print("Starting WebSocket server on http://localhost:5001")
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)
    # Get network info
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        network_ip = s.getsockname()[0]
        s.close()
        
        logger.info("="*60)
        logger.info("🚀 OBJECT DETECTION SERVER")
        logger.info("="*60)
        logger.info(f"📡 Listening on: http://0.0.0.0:5000")
        logger.info(f"📱 Mobile app should use:")
        logger.info(f"   http://{network_ip}:5000")
        logger.info(f"📏 Distance Estimation: ENABLED")
        logger.info(f"🤖 AI Model: {ACTIVE_MODEL}")
        logger.info("="*60)
        logger.info("\n🔍 Troubleshooting:")
        logger.info(f"  1. Test HTTP: curl http://{network_ip}:5000")
        logger.info(f"  2. Test from browser: http://{network_ip}:5000")
        logger.info(f"  3. Check firewall allows port 5000")
        logger.info(f"  4. Both devices on same WiFi")
        logger.info("="*60 + "\n")
        
    except Exception as e:
        logger.warning(f"Could not determine IP: {e}")
        logger.info("Server starting on http://0.0.0.0:5000")
    
    # Run the server
    socketio.run(
        app,
        debug=False,  # Set to False in production
        host='0.0.0.0',
        port=5000,
        allow_unsafe_werkzeug=True  # For development only
    )
