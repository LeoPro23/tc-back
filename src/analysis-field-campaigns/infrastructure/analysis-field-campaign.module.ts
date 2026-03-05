import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisFieldCampaignOrmEntity } from './analysis-field-campaign.orm-entity';
import { AnalysisFieldCampaignController } from './analysis-field-campaign.controller';
import { AnalysisFieldCampaignService } from '../application/analysis-field-campaign.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnalysisFieldCampaignOrmEntity])],
  controllers: [AnalysisFieldCampaignController],
  providers: [AnalysisFieldCampaignService],
  exports: [TypeOrmModule, AnalysisFieldCampaignService],
})
export class AnalysisFieldCampaignModule { }
