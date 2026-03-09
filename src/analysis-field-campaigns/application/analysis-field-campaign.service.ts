import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisFieldCampaignOrmEntity } from '../infrastructure/analysis-field-campaign.orm-entity';

@Injectable()
export class AnalysisFieldCampaignService {
  constructor(
    @InjectRepository(AnalysisFieldCampaignOrmEntity)
    private readonly analysisRepository: Repository<AnalysisFieldCampaignOrmEntity>,
  ) { }

  async getHistory(
    userId: string,
    campaignId: string,
    isInfected?: boolean,
    fieldIds?: string[],
    startDate?: Date,
    endDate?: Date,
  ) {
    if (!campaignId) {
      throw new BadRequestException('campaignId es requerido.');
    }

    const query = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoinAndSelect('analysis.fieldCampaign', 'fieldCampaign')
      .innerJoinAndSelect('fieldCampaign.campaign', 'campaign')
      .innerJoinAndSelect('fieldCampaign.field', 'field')
      .leftJoinAndSelect('analysis.attachedImages', 'attachedImages')
      .where('campaign.user.id = :userId', { userId })
      .andWhere('campaign.id = :campaignId', { campaignId });

    if (isInfected !== undefined) {
      query.andWhere('analysis.isInfected = :isInfected', { isInfected });
    }

    if (fieldIds && fieldIds.length > 0) {
      query.andWhere('field.id IN (:...fieldIds)', { fieldIds });
    }

    if (startDate) {
      query.andWhere('analysis.date >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('analysis.date <= :endDate', { endDate });
    }

    // Ordenar del más reciente al más antiguo
    query.orderBy('analysis.date', 'DESC');

    return await query.getMany();
  }

  async getById(userId: string, id: string) {
    const analysis = await this.analysisRepository
        .createQueryBuilder('analysis')
        .innerJoinAndSelect('analysis.fieldCampaign', 'fieldCampaign')
        .innerJoinAndSelect('fieldCampaign.campaign', 'campaign')
        .innerJoinAndSelect('fieldCampaign.field', 'field')
        .leftJoinAndSelect('analysis.attachedImages', 'attachedImages')
        .leftJoinAndSelect('attachedImages.modelResults', 'modelResults')
        .leftJoinAndSelect('modelResults.model', 'model')
        .where('campaign.user.id = :userId', { userId })
        .andWhere('analysis.id = :id', { id })
        .getOne();

    if (!analysis) {
        throw new BadRequestException('Analysis not found.');
    }
    
    return analysis;
  }
}
