import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldCampaignOrmEntity } from './field-campaign.orm-entity';
import { FieldCampaignController } from './field-campaign.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FieldCampaignOrmEntity])],
  controllers: [FieldCampaignController],
  exports: [TypeOrmModule],
})
export class FieldCampaignModule {}
