import requests
from io import BytesIO
from PIL import Image

url = "http://localhost:8001/predict"

def test_image(img, name):
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"file": (name, buf, "image/jpeg")}
    try:
        r = requests.post(url, files=files)
        print(f"--- {name} ---")
        print(r.status_code)
        print(r.json())
    except Exception as e:
        print(f"Failed to connect: {e}")

# 1. Very small image (Resolution check)
small_img = Image.new("RGB", (200, 200), color="white")
test_image(small_img, "small.jpg")

# 2. Too dark (Illumination < 20 check)
dark_img = Image.new("RGB", (600, 600), color=(10, 10, 10))
test_image(dark_img, "dark.jpg")

# 3. Too bright (Illumination > 240 check)
bright_img = Image.new("RGB", (600, 600), color=(250, 250, 250))
test_image(bright_img, "bright.jpg")

# 4. Normal image (Should pass image checks, but likely fail evidence check)
normal_img = Image.new("RGB", (800, 800), color=(128, 128, 128))
test_image(normal_img, "normal.jpg")
