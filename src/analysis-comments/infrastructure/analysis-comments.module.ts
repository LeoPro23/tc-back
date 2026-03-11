import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisCommentOrmEntity } from './analysis-comment.orm-entity';
import { AnalysisCommentController } from './analysis-comment.controller';
import { AnalysisCommentService } from '../application/analysis-comment.service';
import { StorageModule } from '../../storage/infrastructure/storage.module';
import { NotificationModule } from '../../notifications/infrastructure/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisCommentOrmEntity]),
    StorageModule,
    NotificationModule,
  ],
  controllers: [AnalysisCommentController],
  providers: [AnalysisCommentService],
})
export class AnalysisCommentsModule {}
