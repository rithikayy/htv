from flask import Flask, request
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

# ===== DISTANCE ESTIMATION CONFIGURATION =====
# Known object dimensions (real-world measurements in cm)
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
    "pen": {"width_cm": 1, "height_cm": 14},
    "pencil": {"width_cm": 1, "height_cm": 18},
    "mug": {"width_cm": 8, "height_cm": 10},
    "glass": {"width_cm": 7, "height_cm": 12},
    "watch": {"width_cm": 4, "height_cm": 4},
    "backpack": {"width_cm": 30, "height_cm": 45},
    "bag": {"width_cm": 35, "height_cm": 30},
    "car": {"width_cm": 180, "height_cm": 150},
    "bicycle": {"width_cm": 60, "height_cm": 100},
    "dog": {"width_cm": 30, "height_cm": 60},
    "cat": {"width_cm": 25, "height_cm": 25},
}

# Camera focal length (pixels) - This is a typical value for mobile cameras
# You may need to calibrate this for specific devices
FOCAL_LENGTH = 800  # Adjusted for typical mobile camera


def distance_to_camera(known_height, focal_length, pixel_height):
    """
    Calculate distance to object using pinhole camera model.
    
    Formula: Distance = (Known Height × Focal Length) / Pixel Height
    
    Args:
        known_height: Real-world height of object in cm
        focal_length: Camera focal length in pixels
        pixel_height: Height of object in image in pixels
    
    Returns:
        Distance to object in cm
    """
    if pixel_height == 0:
        return None
    return (known_height * focal_length) / pixel_height


def estimate_object_distance(norm_box, label, image_height):
    """
    Estimate distance to detected object.
    
    Args:
        norm_box: Normalized bounding box coordinates (0-1)
        label: Object label/class
        image_height: Actual image height in pixels
    
    Returns:
        Distance in meters (rounded to 2 decimal places) or None
    """
    # Get known dimensions for this object type
    object_info = None
    label_lower = label.lower()
    
    # Try exact match first
    if label_lower in KNOWN_OBJECTS:
        object_info = KNOWN_OBJECTS[label_lower]
    else:
        # Try partial match for compound labels (e.g., "cell phone" -> "phone")
        for known_obj, dimensions in KNOWN_OBJECTS.items():
            if known_obj in label_lower or label_lower in known_obj:
                object_info = dimensions
                logger.debug(f"Matched '{label}' to known object '{known_obj}'")
                break
    
    if not object_info:
        logger.debug(f"No known dimensions for object: {label}")
        return None
    
    # Calculate pixel height of bounding box
    box_height_normalized = norm_box['height']
    pixel_height = box_height_normalized * image_height
    
    if pixel_height <= 0:
        return None
    
    # Use known height for distance calculation
    known_height_cm = object_info['height_cm']
    distance_cm = distance_to_camera(known_height_cm, FOCAL_LENGTH, pixel_height)
    
    if distance_cm is None:
        return None
    
    # Convert to meters and round
    distance_m = round(distance_cm / 100, 2)
    
    # Sanity check - ignore unrealistic distances
    if distance_m < 0.1 or distance_m > 100:
        logger.debug(f"Unrealistic distance calculated for {label}: {distance_m}m")
        return None
    
    return distance_m


@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    client_id = request.sid
    logger.info(f'✓ Client connected: {client_id}')
    emit('connection_status', {
        'status': 'connected',
        'model': ACTIVE_MODEL,
        'message': 'Successfully connected to object detection server with distance estimation'
    })


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    client_id = request.sid
    logger.info(f'✗ Client disconnected: {client_id}')


@socketio.on('process_frame')
def handle_frame(data):
    """
    Process frame from React Native app with distance estimation
    
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
            # Remove data URI prefix if present
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
            
            # Get actual image dimensions
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
                
                # Create normalized box for distance calculation
                norm_box = {
                    'x': norm_x1,
                    'y': norm_y1,
                    'width': norm_width,
                    'height': norm_height
                }
                
                # Get label
                label = bbox.get('label', 'object')
                
                # Estimate distance to object
                distance_m = estimate_object_distance(norm_box, label, height)
                
                detection = {
                    'x': norm_x1,  # Left position (0-1)
                    'y': norm_y1,  # Top position (0-1)
                    'width': norm_width,  # Width (0-1)
                    'height': norm_height,  # Height (0-1)
                    'label': label,
                    'confidence': bbox.get('confidence', 0.9),  # Keep confidence for debugging
                    'distance_m': distance_m  # Distance in meters (can be None)
                }
                
                detections.append(detection)
                
                if distance_m:
                    logger.debug(f"  - {label}: {distance_m}m away")
                else:
                    logger.debug(f"  - {label}: distance unknown")
                
            except (KeyError, IndexError) as e:
                logger.warning(f"Skipping malformed bounding box: {e}")
                continue
        
        # Send results back to React Native app
        result = {
            'success': True,
            'detections': detections,
            'count': len(detections),
            'timestamp': timestamp,
            'processingTime': None,
            'distanceEnabled': True  # Flag to indicate distance feature is active
        }
        
        logger.info(f"✓ Sending {len(detections)} detections back to client")
        emit('detection_result', result)
        
    except Exception as e:
        logger.error(f"Unexpected error in handle_frame: {e}", exc_info=True)
        emit('detection_error', {'error': 'Server error occurred'})


@socketio.on('ping')
def handle_ping():
    """Handle ping for connection testing"""
    import time
    emit('pong', {'timestamp': time.time()})


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
        logger.info("📏 Distance Estimation: ENABLED")
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