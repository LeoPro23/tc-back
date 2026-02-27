from ultralytics import YOLO
from PIL import Image
import os
from glob import glob
from typing import Dict, List

class PestDetector:
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.models: Dict[str, YOLO] = {}

    def _discover_model_paths(self) -> List[str]:
        if not os.path.isdir(self.models_dir):
            raise FileNotFoundError(f"Models directory not found at {self.models_dir}")

        model_paths = sorted(glob(os.path.join(self.models_dir, "*.pt")))
        if not model_paths:
            raise FileNotFoundError(f"No .pt models found in {self.models_dir}")

        return model_paths

    def load_models(self) -> List[str]:
        model_paths = self._discover_model_paths()
        discovered_paths = set(model_paths)

        # If a model file was removed from disk, stop using it.
        for loaded_path in list(self.models.keys()):
            if loaded_path not in discovered_paths:
                print(f"Unloading model removed from disk: {loaded_path}")
                del self.models[loaded_path]

        # Load only models not loaded yet.
        for model_path in model_paths:
            if model_path in self.models:
                continue
            print(f"Loading model from {model_path}...")
            self.models[model_path] = YOLO(model_path)
            print("Model loaded successfully.")

        return self.get_model_names()

    def get_model_names(self) -> List[str]:
        return [
            os.path.splitext(os.path.basename(path))[0]
            for path in sorted(self.models.keys())
        ]

    def predict(self, image: Image.Image, conf_threshold: float = 0.25):
        self.load_models()

        detections = []
        for model_path in sorted(self.models.keys()):
            model = self.models[model_path]
            model_name = os.path.splitext(os.path.basename(model_path))[0]

            # Run inference for each model in models/
            results = model(image, conf=conf_threshold)

            for result in results:
                for box in result.boxes:
                    # Get box coordinates, confidence, and class
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    class_name = result.names[cls]

                    # 3. Ubicación: Validar que el bounding box esté dentro de la imagen
                    width, height = image.size
                    if x1 < 0 or y1 < 0 or x2 > width or y2 > height:
                        continue # descartar por estar fuera de rango

                    # 4. Escala del Objeto: Descartar bounding boxes muy pequeños o que cubran casi toda la imagen
                    area = (x2 - x1) * (y2 - y1)
                    image_area = width * height
                    if area < 100 or area > (image_area * 0.8):
                        continue # descartar por ser posible falso positivo o recorte

                    detections.append({
                        "box": [x1, y1, x2, y2],
                        "confidence": conf,
                        "class": class_name,
                        "class_id": cls,
                        "model": model_name
                    })

        return detections
