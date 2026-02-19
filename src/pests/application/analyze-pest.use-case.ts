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
}
