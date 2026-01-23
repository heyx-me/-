import os
import time
import base64
import cairosvg
import requests
import re
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# --- CONFIGURATION ---
API_KEY = os.environ.get("GEMINI_API_KEY") 
INPUT_DIR = "svgs"
OUTPUT_DIR = "svgs_ai_regenerated"
MODEL_NAME = "gemini-3-pro-preview" 

if not API_KEY:
    print("Error: GEMINI_API_KEY environment variable not found in .env.")
    exit(1)

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def regenerate_svg(file_path, output_path):
    print(f"Processing {file_path} with {MODEL_NAME}...")
    
    # 1. Convert SVG to PNG (in-memory) for the AI to "see"
    try:
        png_data = cairosvg.svg2png(url=file_path, output_height=1024, output_width=1024)
        b64_image = base64.b64encode(png_data).decode('utf-8')
    except Exception as e:
        print(f"Failed to rasterize {file_path}: {e}")
        return

    # 2. Construct the API Request
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={API_KEY}"
    
    prompt_text = """
    You are a master vector illustrator. I am providing an image of a simple character/face icon. 
    Your task is to re-draw this icon as a perfectly structured SVG.
    
    CRITICAL STRUCTURAL REQUIREMENTS:
    1. SEGREGATION: You MUST create two distinct paths.
       - A path for the HAIR (must have id="hair").
       - A path for the FACE/HEAD outline (must have id="face").
    2. INTERNALS: Eyes, mouth, or other features should be included as separate paths or clearly defined sub-paths inside the face group.
    3. STYLE: Use a clean, minimal vector style. Solid white fill (#ffffff) by default unless specified otherwise.
    4. PRECISION: The silhouette must match the provided image exactly, but the points must be separated where the hair meets the skin.
    
    Return ONLY the raw SVG code. No explanations, no markdown blocks.
    """

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt_text},
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": b64_image
                    }
                }
            ]
        }]
    }

    # 3. Call the API
    try:
        response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'})
        response.raise_for_status()
        result = response.json()
        
        try:
            ai_text = result['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):
            print(f"Error parsing API response for {file_path}: {result}")
            return

        ai_text = re.sub(r'^```(xml|svg)?\n', '', ai_text.strip(), flags=re.MULTILINE)
        ai_text = re.sub(r'\n```$', '', ai_text.strip(), flags=re.MULTILINE)
        
        with open(output_path, 'w') as f:
            f.write(ai_text)
            
        print(f"Saved regenerated icon to {output_path}")
        time.sleep(2)

    except requests.exceptions.RequestException as e:
        print(f"API Request failed for {file_path}: {e}")

# --- MAIN LOOP ---
files = sorted([f for f in os.listdir(INPUT_DIR) if f.endswith('.svg')])
MAX_FILES = 1 
count = 0

print(f"Found {len(files)} SVGs. Will process up to {MAX_FILES}.")

for file in files:
    if count >= MAX_FILES:
        break
    
    input_p = os.path.join(INPUT_DIR, file)
    output_p = os.path.join(OUTPUT_DIR, file)
    
    if os.path.exists(output_p):
        print(f"Skipping {file} (already exists)")
        continue
        
    regenerate_svg(input_p, output_p)
    count += 1

print("Batch processing complete.")