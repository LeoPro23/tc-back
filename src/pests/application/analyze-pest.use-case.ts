import { Inject, Injectable } from '@nestjs/common';
import { IPestRepository } from '../domain/pest.repository.interface';
import { PestAnalysisResult } from '../domain/pest.entity';

@Injectable()
export class AnalyzePestUseCase {
    constructor(
        @Inject(IPestRepository)
        private readonly pestRepository: IPestRepository,
    ) { }

    async execute(imageBuffer: Buffer, filename: string): Promise<PestAnalysisResult> {
        return this.pestRepository.analyzeImage(imageBuffer, filename);
    }

    async executeBatch(images: Array<{ buffer: Buffer; filename: string }>): Promise<PestAnalysisResult[]> {
        const results: PestAnalysisResult[] = [];

        // Process sequentially to avoid saturating the ML service with concurrent heavy inferences.
        for (const image of images) {
            const result = await this.pestRepository.analyzeImage(image.buffer, image.filename);
            results.push(result);
        }

        return results;
    }
}
