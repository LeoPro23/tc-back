import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignOrmEntity } from './campaign.orm-entity';
import { CampaignController } from './campaign.controller';
import { AnalysisFieldCampaignOrmEntity } from '../../analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { FieldCampaignOrmEntity } from '../../field-campaigns/infrastructure/field-campaign.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    CampaignOrmEntity,
    AnalysisFieldCampaignOrmEntity,
    FieldCampaignOrmEntity
  ])],
  controllers: [CampaignController],
  exports: [TypeOrmModule],
})
export class CampaignModule { }
