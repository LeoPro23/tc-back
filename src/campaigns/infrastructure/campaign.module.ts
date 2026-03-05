import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignOrmEntity } from './campaign.orm-entity';
import { CampaignController } from './campaign.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignOrmEntity])],
  controllers: [CampaignController],
  exports: [TypeOrmModule],
})
export class CampaignModule {}
