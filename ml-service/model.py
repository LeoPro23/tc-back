from ultralytics import YOLO
from PIL import Image
import os

class PestDetector:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = None

    def load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found at {self.model_path}")
        print(f"Loading model from {self.model_path}...")
        self.model = YOLO(self.model_path)
        print("Model loaded successfully.")

    def predict(self, image: Image.Image, conf_threshold: float = 0.25):
        if self.model is None:
            self.load_model()
        
        # Run inference
        results = self.model(image, conf=conf_threshold)
        
        # Process results
        detections = []
        for result in results:
            for box in result.boxes:
                # Get box coordinates, confidence, and class
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                class_name = result.names[cls]
                
                detections.append({
                    "box": [x1, y1, x2, y2],
                    "confidence": conf,
                    "class": class_name,
                    "class_id": cls
                })
        
        return detections
