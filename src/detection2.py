from google import genai
from google.genai import types
from PIL import Image
import json
import cv2
import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io

# Load environment variables from .env file
load_dotenv()

# Initialize client with API key
api_key = os.environ.get("GENAI_API_KEY")
client = genai.Client(api_key=api_key)

prompt = "Detect all of the prominent items in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."

app = Flask(__name__)
CORS(app)

@app.route('/detect-objects', methods=['POST'])
def detect_objects():
    try:
        data = request.json
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
            model='gemini-2.0-flash-exp',
            contents=[pil_image, custom_prompt],
            config=config
        )

        # Parse bounding boxes
        bounding_boxes = json.loads(response.text)

        # Convert normalized coordinates to absolute
        detected_objects = []
        for bbox in bounding_boxes:
            abs_y1 = int(bbox["box_2d"][0] / 1000 * height)
            abs_x1 = int(bbox["box_2d"][1] / 1000 * width)
            abs_y2 = int(bbox["box_2d"][2] / 1000 * height)
            abs_x2 = int(bbox["box_2d"][3] / 1000 * width)
            label = bbox.get("label", "object")

            detected_objects.append({
                "label": label,
                "box": {
                    "x1": abs_x1,
                    "y1": abs_y1,
                    "x2": abs_x2,
                    "y2": abs_y2
                },
                "normalized": bbox["box_2d"]
            })

        return jsonify({
            'objects': detected_objects,
            'count': len(detected_objects),
            'image_size': {'width': width, 'height': height},
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
