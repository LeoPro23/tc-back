import { Module } from '@nestjs/common';
import { PestController } from './pest.controller';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';
import { FastApiPestRepositoryImpl } from './fastapi-pest.repository.impl';
import { IPestRepository } from '../domain/pest.repository.interface';
import { ImageVerificationService } from '../application/image-verification.service';
import { AnalysisInterpretationService } from '../application/analysis-interpretation.service';

@Module({
    controllers: [PestController],
    providers: [
        AnalyzePestUseCase,
        ImageVerificationService,
        AnalysisInterpretationService,
        {
            provide: IPestRepository,
            useClass: FastApiPestRepositoryImpl,
        },
    ],
})
export class PestModule { }
