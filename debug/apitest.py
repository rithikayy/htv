import os 
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ.get("GENAI_API_KEY")

print(f"API Key: {API_KEY}")

if not API_KEY:
    raise ValueError("GENAI_API_KEY environment variable not set.")

