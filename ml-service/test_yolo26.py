from ultralytics import YOLO
from PIL import Image
import os

def test_model():
    model_path = os.path.join("models", "yolo26n.pt")
    if not os.path.exists(model_path):
        print(f"Model not found at {model_path}")
        return

    print("Loading model...")
    model = YOLO(model_path)
    
    # Path to test images
    test_dir = r"c:\Rimenri2\tomato-code-train\pruebas"
    if not os.path.exists(test_dir):
        print(f"Test directory not found: {test_dir}")
        return

    images = [os.path.join(test_dir, f) for f in os.listdir(test_dir) if f.endswith(('.jpeg', '.jpg', '.png'))]
    
    if not images:
        print("No test images found.")
        return

    print(f"Testing {len(images)} images with conf=0.1 (low threshold to see all detections)...")
    
    for img_path in images[:3]: # Test first 3 images
        print(f"\n--- Testing {os.path.basename(img_path)} ---")
        img = Image.open(img_path)
        
        # Run inference
        results = model(img, conf=0.1)
        
        for result in results:
            print(f"Found {len(result.boxes)} boxes.")
            for box in result.boxes:
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                name = result.names[cls]
                print(f"  - Class: {name} ({cls}), Conf: {conf:.2f}")

if __name__ == "__main__":
    test_model()
