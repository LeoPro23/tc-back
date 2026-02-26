import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { PestAnalysisResult, PestDetection } from '../domain/pest.entity';
import { IPestRepository } from '../domain/pest.repository.interface';

@Injectable()
export class FastApiPestRepositoryImpl implements IPestRepository {
    private readonly fastApiUrl = 'http://127.0.0.1:8000'; // Configuration would be better

    async analyzeImage(imageBuffer: Buffer, filename: string): Promise<PestAnalysisResult> {
        const formData = new FormData();
        formData.append('file', imageBuffer, filename);

        try {
            const response = await axios.post(`${this.fastApiUrl}/predict`, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
            });

            const data = response.data;

            const detections = data.detections.map((d: any) => new PestDetection(
                d.box,
                d.confidence,
                d.class,
                d.class_id,
                d.model ?? null
            ));
            const models = Array.isArray(data.models) ? data.models : [];

            return new PestAnalysisResult(data.filename, detections, models);
        } catch (error) {
            console.error('Error calling ML Service:', error);
            throw new InternalServerErrorException('Failed to analyze image with ML service');
        }
    }
}
