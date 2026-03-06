import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { PestAnalysisResult, PestDetection } from '../domain/pest.entity';
import { IPestRepository } from '../domain/pest.repository.interface';

@Injectable()
export class FastApiPestRepositoryImpl implements IPestRepository {
  private readonly fastApiUrl =
    process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8001';

  async analyzeImage(
    imageBuffer: Buffer,
    filename: string,
  ): Promise<PestAnalysisResult> {
    const formData = new FormData();
    formData.append('file', imageBuffer, filename);

    try {
      // PASO 5.2.1 (CAPA DE INFRAESTRUCTURA - ML): Petición HTTP a Python
      // Aquí Node.js abandona el control temporalmente y llama a la API de FastAPI.
      // Envía la imagen mediante FormData al endpoint /predict del modelo YOLO.
      const response = await axios.post(
        `${this.fastApiUrl}/predict`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      const data = response.data;

      const detections = data.detections.map(
        (d: any) =>
          new PestDetection(
            d.box,
            d.confidence,
            d.class,
            d.class_id,
            d.model ?? null,
          ),
      );
      const models = Array.isArray(data.models) ? data.models : [];

      // PASO 5.2.2 (CAPA DE INFRAESTRUCTURA - ML): Formateo de respuesta
      // Convierte los tensores y coordenadas crudas que devuelve Python
      // en un objeto fuertemente tipado de TypeScript (PestAnalysisResult)
      // útil para nuestra BDD y el frontend.
      return new PestAnalysisResult(
        data.filename,
        detections,
        models,
        data.verified ?? true,
        data.verification_reason ?? null,
      );
    } catch (error) {
      console.error('Error calling ML Service:', error);
      throw new InternalServerErrorException(
        'Failed to analyze image with ML service',
      );
    }
  }
}
