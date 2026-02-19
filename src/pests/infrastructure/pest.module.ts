import { Module } from '@nestjs/common';
import { PestController } from './pest.controller';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';
import { FastApiPestRepositoryImpl } from './fastapi-pest.repository.impl';
import { IPestRepository } from '../domain/pest.repository.interface';

@Module({
    controllers: [PestController],
    providers: [
        AnalyzePestUseCase,
        {
            provide: IPestRepository,
            useClass: FastApiPestRepositoryImpl,
        },
    ],
})
export class PestModule { }
