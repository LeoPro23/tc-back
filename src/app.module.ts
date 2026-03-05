import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PestModule } from './pests/infrastructure/pest.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/infrastructure/auth.module';
import { CampaignModule } from './campaigns/infrastructure/campaign.module';
import { FieldModule } from './fields/infrastructure/field.module';
import { FieldCampaignModule } from './field-campaigns/infrastructure/field-campaign.module';
import { AnalysisFieldCampaignModule } from './analysis-field-campaigns/infrastructure/analysis-field-campaign.module';
import { AttachedImageModule } from './attached-images/infrastructure/attached-image.module';
import { ModelModule } from './models/infrastructure/model.module';
import { ModelResultModule } from './model-results/infrastructure/model-result.module';
import { StorageModule } from './storage/infrastructure/storage.module';
import { NotificationModule } from './notifications/infrastructure/notification.module';

@Module({
  imports: [
    StorageModule,
    DatabaseModule,
    AuthModule,
    PestModule,
    CampaignModule,
    FieldModule,
    FieldCampaignModule,
    AnalysisFieldCampaignModule,
    AttachedImageModule,
    ModelModule,
    ModelResultModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
