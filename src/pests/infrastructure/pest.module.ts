import { Module } from '@nestjs/common';
import { PestController } from './pest.controller';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';
import { ImageVerificationService } from '../application/image-verification.service';
import { AnalysisInterpretationService } from '../application/analysis-interpretation.service';
import { StorageModule } from '../../storage/infrastructure/storage.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FastApiPestRepositoryImpl } from './fastapi-pest.repository.impl';
import { IPestRepository } from '../domain/pest.repository.interface';
import { NotificationModule } from '../../notifications/infrastructure/notification.module';
import { ReportsModule } from '../../reports/infrastructure/reports.module';

@Module({
  imports: [StorageModule, TypeOrmModule.forFeature([]), NotificationModule, ReportsModule],
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
