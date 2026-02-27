import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IPestRepository } from '../domain/pest.repository.interface';
import { BatchInterpretation, PestAnalysisResult } from '../domain/pest.entity';
import { ImageVerificationService } from './image-verification.service';
import { AnalysisInterpretationService } from './analysis-interpretation.service';

@Injectable()
export class AnalyzePestUseCase {
    constructor(
        @Inject(IPestRepository)
        private readonly pestRepository: IPestRepository,
        private readonly imageVerificationService: ImageVerificationService,
        private readonly analysisInterpretationService: AnalysisInterpretationService,
    ) { }

    async execute(imageBuffer: Buffer, filename: string, mimeType: string): Promise<PestAnalysisResult> {
        const decision = await this.imageVerificationService.verifyImage(imageBuffer, mimeType);
        if (!decision.isValid) {
            throw new BadRequestException(`Imagen rechazada por verificación: ${decision.reason}`);
        }

        return this.pestRepository.analyzeImage(imageBuffer, filename);
    }

    async executeBatch(
        images: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    ): Promise<{ results: PestAnalysisResult[]; interpretation: BatchInterpretation }> {
        const results: PestAnalysisResult[] = [];

        // Process sequentially to avoid saturating the ML service with concurrent heavy inferences.
        for (const image of images) {
            const decision = await this.imageVerificationService.verifyImage(image.buffer, image.mimeType);
            if (!decision.isValid) {
                results.push(new PestAnalysisResult(image.filename, [], [], false, decision.reason));
                continue;
            }

            const result = await this.pestRepository.analyzeImage(image.buffer, image.filename);
            results.push(result);
        }

        const interpretation = await this.analysisInterpretationService.interpretBatch(results);
        return { results, interpretation };
    }
}
