from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model import PestDetector
from io import BytesIO
from PIL import Image, ImageStat
import os
import uvicorn

app = FastAPI(title="Pest Detection Service")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
detector = PestDetector(MODELS_DIR)

@app.on_event("startup")
async def startup_event():
    try:
        detector.load_models()
    except Exception as e:
        print(f"Error loading model: {e}")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        contents = await file.read()
        image = Image.open(BytesIO(contents)).convert("RGB")
        models = detector.get_model_names()

        # 1. Resolución de Imagen
        if image.width < 128 or image.height < 128:
            return {
                "filename": file.filename, 
                "models": models, 
                "detections": [], 
                "verified": False, 
                "verification_reason": f"Resolución insuficiente ({image.width}x{image.height}). Mínimo requerido: 256x256."
            }

        # 2. Nivel de Iluminación
        stat = ImageStat.Stat(image.convert("L"))
        avg_pixel_value = stat.mean[0]
        if avg_pixel_value < 20:
            return {
                "filename": file.filename,
                "models": models,
                "detections": [],
                "verified": False,
                "verification_reason": "Imagen demasiado oscura. Imposible distinguir textura/contornos."
            }
        elif avg_pixel_value > 240:
            return {
                "filename": file.filename,
                "models": models,
                "detections": [],
                "verified": False,
                "verification_reason": "Imagen quemada o sobreexpuesta. Imposible distinguir textura/contornos."
            }
        
        detections = detector.predict(image)
        
        # 5. Densidad de Población y Evidencia
        if len(detections) > 100:
            return {
                "filename": file.filename,
                "models": models,
                "detections": detections,
                "verified": False,
                "verification_reason": f"Densidad anormalmente alta ({len(detections)} objetos detectados). Posible ruido."
            }
        
        return {
            "filename": file.filename, 
            "models": models, 
            "detections": detections,
            "verified": True,
            "verification_reason": None if len(detections) > 0 else "Sin evidencia suficiente"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    try:
        model_names = detector.load_models()
    except Exception:
        model_names = detector.get_model_names()
    return {
        "status": "ok",
        "model_loaded": len(model_names) > 0,
        "model_count": len(model_names),
        "models": model_names
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
