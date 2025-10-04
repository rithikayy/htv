from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from google import genai
from google.genai import types
from PIL import Image
import json
import base64
import io
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Enable CORS for all origins (adjust in production)
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# Initialize Gemini client
api_key = os.environ.get("GENAI_API_KEY")
if not api_key:
    raise ValueError("GENAI_API_KEY not set in environment variables")

client = genai.Client(api_key=api_key)

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


@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    client_id = request.sid if 'request' in globals() else 'unknown'
    logger.info(f'✓ Client connected: {client_id}')
    emit('connection_status', {
        'status': 'connected',
        'model': ACTIVE_MODEL,
        'message': 'Successfully connected to object detection server'
    })


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    client_id = request.sid if 'request' in globals() else 'unknown'
    logger.info(f'✗ Client disconnected: {client_id}')


@socketio.on('process_frame')
def handle_frame(data):
    """
    Process frame from React Native app
    
    Expected data format:
    {
        'image': 'base64_encoded_image_string',
        'width': image_width,
        'height': image_height,
        'timestamp': unix_timestamp,
        'cameraFacing': 'front' | 'back'
    }
    """
    try:
        # Extract data from payload
        base64_image = data.get('image')
        original_width = data.get('width')
        original_height = data.get('height')
        timestamp = data.get('timestamp')
        camera_facing = data.get('cameraFacing', 'unknown')
        
        if not base64_image:
            logger.error('No image provided in payload')
            emit('detection_error', {'error': 'No image provided'})
            return
        
        logger.info(f"Processing frame - Timestamp: {timestamp}, Camera: {camera_facing}, Size: {original_width}x{original_height}")
        
        # Decode base64 to bytes
        try:
            # Remove data URI prefix if present (shouldn't be there based on your code, but just in case)
            if ',' in base64_image:
                base64_image = base64_image.split(',')[1]
            
            image_bytes = base64.b64decode(base64_image)
        except Exception as e:
            logger.error(f"Failed to decode base64: {e}")
            emit('detection_error', {'error': 'Invalid base64 image'})
            return
        
        # Load into PIL Image
        try:
            image_buffer = io.BytesIO(image_bytes)
            pil_image = Image.open(image_buffer)
            
            # Get actual image dimensions (after any processing)
            width, height = pil_image.size
            logger.info(f"Decoded image size: {width}x{height}")
            
        except Exception as e:
            logger.error(f"Failed to load image: {e}")
            emit('detection_error', {'error': 'Failed to process image'})
            return
        
        # Call Gemini API for object detection
        try:
            logger.info("Calling Gemini API for object detection...")
            response = client.models.generate_content(
                model=ACTIVE_MODEL,
                contents=[pil_image, prompt],
                config=config
            )
            
            # Parse response
            bounding_boxes = json.loads(response.text)
            logger.info(f"Gemini detected {len(bounding_boxes)} objects")
            
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            emit('detection_error', {'error': f'AI model error: {str(e)}'})
            return
        
        # Convert bounding boxes to format expected by React Native frontend
        detections = []
        for bbox in bounding_boxes:
            try:
                # Gemini returns normalized coordinates (0-1000)
                # Convert to relative coordinates (0-1) for React Native
                norm_y1 = bbox["box_2d"][0] / 1000.0
                norm_x1 = bbox["box_2d"][1] / 1000.0
                norm_y2 = bbox["box_2d"][2] / 1000.0
                norm_x2 = bbox["box_2d"][3] / 1000.0
                
                # Calculate width and height in relative coordinates
                norm_width = norm_x2 - norm_x1
                norm_height = norm_y2 - norm_y1
                
                detection = {
                    'x': norm_x1,  # Left position (0-1)
                    'y': norm_y1,  # Top position (0-1)
                    'width': norm_width,  # Width (0-1)
                    'height': norm_height,  # Height (0-1)
                    'label': bbox.get('label', 'object'),
                    'confidence': bbox.get('confidence', 0.9)  # Default confidence if not provided
                }
                
                detections.append(detection)
                logger.debug(f"  - {detection['label']}: x={norm_x1:.2f}, y={norm_y1:.2f}, w={norm_width:.2f}, h={norm_height:.2f}")
                
            except (KeyError, IndexError) as e:
                logger.warning(f"Skipping malformed bounding box: {e}")
                continue
        
        # Send results back to React Native app
        result = {
            'success': True,
            'detections': detections,
            'count': len(detections),
            'timestamp': timestamp,
            'processingTime': None  # Could add actual processing time if needed
        }
        
        logger.info(f"✓ Sending {len(detections)} detections back to client")
        emit('detection_result', result)
        
    except Exception as e:
        logger.error(f"Unexpected error in handle_frame: {e}", exc_info=True)
        emit('detection_error', {'error': 'Server error occurred'})


@socketio.on('ping')
def handle_ping():
    """Handle ping for connection testing"""
    emit('pong', {'timestamp': os.time.time() if hasattr(os.time, 'time') else None})


if __name__ == '__main__':
    # Get local IP address for display
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        
        # Try to get actual network IP (more reliable)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        network_ip = s.getsockname()[0]
        s.close()
        
        logger.info("="*50)
        logger.info("🚀 Object Detection WebSocket Server Starting")
        logger.info("="*50)
        logger.info(f"📡 Server will run on: http://0.0.0.0:5000")
        logger.info(f"📱 Mobile app should connect to:")
        logger.info(f"   ws://{network_ip}:5000")
        logger.info(f"   (or ws://{local_ip}:5000)")
        logger.info("="*50)
        
    except Exception as e:
        logger.warning(f"Could not determine IP address: {e}")
        logger.info("Server starting on http://0.0.0.0:5000")
    
    # Run the server
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)