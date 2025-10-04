from google import genai
from google.genai import types
from PIL import Image
import json
import cv2
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize client with API key
api_key = os.environ.get("GENAI_API_KEY")

client = genai.Client(api_key=api_key)
prompt = "Detect all of the prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."

# Open webcam
capture = cv2.VideoCapture(0)

if not capture.isOpened():
    raise Exception("Could not open webcam. Make sure your camera is connected.")

# Set camera resolution
capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

# API configuration
config = types.GenerateContentConfig(
    response_mime_type="application/json"
)

print("Starting video detection...")
print("Press 'q' to quit")
print("Press 's' to process current frame")
print("Press 'a' to toggle auto-detection mode")

frame_count = 0
auto_detect = False
process_every_n_frames = 60  # Process every 60 frames (every 2 seconds at 30fps)
last_bounding_boxes = []

try:
    while True:
        ret, frame = capture.read()
        
        if not ret:
            print("Failed to grab frame")
            break
        
        frame_count += 1
        display_frame = frame.copy()
        
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
        
        # Process frame
        if should_process:
            try:
                # Convert BGR to RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                
                # Get image dimensions
                width, height = pil_image.size
                
                # Call API
                print(f"Processing frame {frame_count}...")
                response = client.models.generate_content(
                    model="gemini-2.0-flash-exp",
                    contents=[pil_image, prompt],
                    config=config
                )
                
                # Parse bounding boxes
                bounding_boxes = json.loads(response.text)
                
                # Convert normalized coordinates to absolute
                last_bounding_boxes = []
                for bbox in bounding_boxes:
                    abs_y1 = int(bbox["box_2d"][0]/1000 * height)
                    abs_x1 = int(bbox["box_2d"][1]/1000 * width)
                    abs_y2 = int(bbox["box_2d"][2]/1000 * height)
                    abs_x2 = int(bbox["box_2d"][3]/1000 * width)
                    
                    label = bbox.get("label", "object")
                    last_bounding_boxes.append({
                        "coords": [abs_x1, abs_y1, abs_x2, abs_y2],
                        "label": label
                    })
                
                print(f"Detected {len(last_bounding_boxes)} objects")
                
            except Exception as e:
                print(f"Error processing frame: {e}")
        
        # Draw bounding boxes on display frame
        for bbox in last_bounding_boxes:
            x1, y1, x2, y2 = bbox["coords"]
            label = bbox["label"]
            
            # Draw rectangle
            cv2.rectangle(display_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Draw label background
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
            cv2.rectangle(display_frame, (x1, y1 - label_size[1] - 10), 
                         (x1 + label_size[0], y1), (0, 255, 0), -1)
            
            # Draw label text
            cv2.putText(display_frame, label, (x1, y1 - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
        
        # Display status
        status_text = f"Auto: {'ON' if auto_detect else 'OFF'} | Frame: {frame_count} | Objects: {len(last_bounding_boxes)}"
        cv2.putText(display_frame, status_text, (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Show frame
        cv2.imshow('Object Detection', display_frame)

except KeyboardInterrupt:
    print("\nInterrupted by user")
finally:
    # Cleanup
    capture.release()
    cv2.destroyAllWindows()
    print("Detection stopped.")