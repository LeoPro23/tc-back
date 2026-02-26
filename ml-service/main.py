from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model import PestDetector
from io import BytesIO
from PIL import Image
import os
import uvicorn

app = FastAPI(title="Tomato Pest Detection Service")

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
        
        detections = detector.predict(image)
        models = detector.get_model_names()
        
        return {"filename": file.filename, "models": models, "detections": detections}
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
