from google import genai
from google.genai import types
from PIL import Image
import json
import cv2
import numpy as np
import os
from dotenv import load_dotenv
import threading
import time

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
}

FOCAL_LENGTH = 350  # Default value, needs calibration


def distance_to_camera(knownWidth, focalLength, perWidth):
    if perWidth == 0:
        return None
    return (knownWidth * focalLength) / perWidth


def estimate_object_distance(box, label):
    object_info = KNOWN_OBJECTS.get(label.lower())
    
    if not object_info:
        return None
    
    box_width = box['x2'] - box['x1']
    box_height = box['y2'] - box['y1']
    known_height = object_info['height_cm']
    distance = distance_to_camera(known_height, FOCAL_LENGTH, box_height)
    
    return distance


# Thread-safe variables
detection_lock = threading.Lock()
last_detections = []
is_processing = False
processing_thread = None


def process_frame_async(frame, width, height):
    """Process frame in background thread"""
    global last_detections, is_processing
    
    try:
        # Convert BGR to RGB for Gemini API
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        
        # Call Gemini API for object detection
        print(f"Processing frame in background...")
        response = client.models.generate_content(
            model=ACTIVE_MODEL,
            contents=[pil_image, prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        # Parse bounding boxes
        bounding_boxes = json.loads(response.text)
        
        # Convert normalized coordinates to absolute and estimate distance
        new_detections = []
        for bbox in bounding_boxes:
            abs_y1 = int(bbox["box_2d"][0]/1000 * height)
            abs_x1 = int(bbox["box_2d"][1]/1000 * width)
            abs_y2 = int(bbox["box_2d"][2]/1000 * height)
            abs_x2 = int(bbox["box_2d"][3]/1000 * width)
            
            label = bbox.get("label", "object")
            box = {
                "x1": abs_x1,
                "y1": abs_y1,
                "x2": abs_x2,
                "y2": abs_y2
            }
            
            # Estimate distance
            distance_cm = estimate_object_distance(box, label)
            
            detection = {
                "coords": [abs_x1, abs_y1, abs_x2, abs_y2],
                "label": label,
                "distance_cm": distance_cm,
                "distance_m": round(distance_cm / 100, 2) if distance_cm else None
            }
            
            new_detections.append(detection)
        
        # Update detections thread-safely
        with detection_lock:
            last_detections = new_detections
        
        print(f"Detected {len(new_detections)} objects:")
        for det in new_detections:
            if det['distance_m']:
                print(f"  - {det['label']}: {det['distance_m']}m")
            else:
                print(f"  - {det['label']}: (distance unknown)")
        
    except Exception as e:
        print(f"Error processing frame: {e}")
    finally:
        with detection_lock:
            is_processing = False


# Open webcam
capture = cv2.VideoCapture(0)

if not capture.isOpened():
    raise Exception("Could not open webcam. Make sure your camera is connected.")

# Set camera resolution
capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

print("\nStarting video detection with distance estimation...")
print("Press 'q' to quit")
print("Press 's' to process current frame")
print("Press 'a' to toggle auto-detection mode")
print("Press 'c' to clear detections")

frame_count = 0
auto_detect = False
process_every_n_frames = 40  # Process every 40 frames (~2 seconds at 20fps)

try:
    while True:
        ret, frame = capture.read()
        
        if not ret:
            print("Failed to grab frame")
            break
        
        frame_count += 1
        display_frame = frame.copy()
        
        # Get frame dimensions
        height, width = frame.shape[:2]
        
        # Auto-detection mode
        should_process = False
        if auto_detect and frame_count % process_every_n_frames == 0:
            should_process = True
        
        # Handle key presses
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            should_process = True
            print("Manual detection triggered...")
        elif key == ord('a'):
            auto_detect = not auto_detect
            print(f"Auto-detection: {'ON' if auto_detect else 'OFF'}")
        elif key == ord('c'):
            with detection_lock:
                last_detections = []
            print("Detections cleared")
        
        # Start processing in background thread if needed
        if should_process:
            with detection_lock:
                if not is_processing:
                    is_processing = True
                    processing_thread = threading.Thread(
                        target=process_frame_async, 
                        args=(frame.copy(), width, height),
                        daemon=True
                    )
                    processing_thread.start()
        
        # Draw bounding boxes and distance on display frame (thread-safe)
        with detection_lock:
            current_detections = last_detections.copy()
            processing_status = is_processing
        
        for det in current_detections:
            x1, y1, x2, y2 = det["coords"]
            label = det["label"]
            distance = det["distance_m"]
            
            # Choose color based on whether distance is known
            color = (0, 255, 0) if distance else (255, 165, 0)
            
            # Draw rectangle
            cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
            
            # Prepare label text
            if distance:
                label_text = f"{label} ({distance}m)"
            else:
                label_text = f"{label}"
            
            # Draw label background
            label_size, _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(display_frame, (x1, y1 - label_size[1] - 10), 
                         (x1 + label_size[0] + 10, y1), color, -1)
            
            # Draw label text
            cv2.putText(display_frame, label_text, (x1 + 5, y1 - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        
        # Display status bar
        status_text = f"Auto: {'ON' if auto_detect else 'OFF'} | Frame: {frame_count} | Objects: {len(current_detections)}"
        if processing_status:
            status_text += " | PROCESSING..."
        cv2.putText(display_frame, status_text, (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Show frame
        cv2.imshow('Object Detection + Distance', display_frame)

except KeyboardInterrupt:
    print("\nInterrupted by user")
finally:
    # Cleanup
    capture.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")