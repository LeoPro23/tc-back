import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisFieldCampaignOrmEntity } from './analysis-field-campaign.orm-entity';

@Module({
    imports: [TypeOrmModule.forFeature([AnalysisFieldCampaignOrmEntity])],
    exports: [TypeOrmModule],
})
export class AnalysisFieldCampaignModule { }
