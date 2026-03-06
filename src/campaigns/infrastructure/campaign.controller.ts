import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CampaignOrmEntity } from './campaign.orm-entity';
import { AnalysisFieldCampaignOrmEntity } from '../../analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { FieldCampaignOrmEntity } from '../../field-campaigns/infrastructure/field-campaign.orm-entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { NotFoundException } from '@nestjs/common';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignController {
  constructor(
    @InjectRepository(CampaignOrmEntity)
    private readonly campaignRepository: Repository<CampaignOrmEntity>,
    @InjectRepository(AnalysisFieldCampaignOrmEntity)
    private readonly analysisRepository: Repository<AnalysisFieldCampaignOrmEntity>,
    @InjectRepository(FieldCampaignOrmEntity)
    private readonly fieldCampaignRepository: Repository<FieldCampaignOrmEntity>,
  ) { }

  @Get('metrics')
  async getMetrics(@Req() req: any) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: { user: { id: userId }, isActive: true },
    });

    const previousCampaign = await this.campaignRepository.findOne({
      where: { user: { id: userId }, isActive: false },
      order: { createdAt: 'DESC' },
    });

    let totalScans = 0;
    let previousScans = 0;
    let infectedScans = 0;
    let activeNodes = 0;
    let totalFields = 0;

    if (currentCampaign) {
      totalScans = await this.analysisRepository.count({
        where: { fieldCampaign: { campaign: { id: currentCampaign.id } } },
      });

      infectedScans = await this.analysisRepository.count({
        where: { fieldCampaign: { campaign: { id: currentCampaign.id } }, isInfected: true },
      });

      totalFields = await this.fieldCampaignRepository.count({
        where: { campaign: { id: currentCampaign.id } },
      });

      const activeNodesCount = await this.analysisRepository
        .createQueryBuilder('analysis')
        .innerJoin('analysis.fieldCampaign', 'fc')
        .innerJoin('fc.field', 'field')
        .innerJoin('fc.campaign', 'campaign')
        .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
        .select('COUNT(DISTINCT field.id)', 'count')
        .getRawOne();

      activeNodes = Number(activeNodesCount?.count) || 0;
    }

    if (previousCampaign) {
      previousScans = await this.analysisRepository.count({
        where: { fieldCampaign: { campaign: { id: previousCampaign.id } } },
      });
    }

    const infectionRate = totalScans > 0 ? (infectedScans / totalScans) * 100 : 0;

    let scansChangePercentage = 0;
    if (previousScans > 0) {
      scansChangePercentage = ((totalScans - previousScans) / previousScans) * 100;
    } else if (totalScans > 0) {
      scansChangePercentage = 100;
    }

    return {
      totalScans,
      previousScans,
      scansChangePercentage,
      infectionRate,
      activeNodes,
      totalFields,
    };
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user.userId;
    return this.campaignRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateCampaignDto) {
    const userId = req.user.userId;
    const newCampaign = this.campaignRepository.create({
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isActive: true,
      userId,
    });

    return this.campaignRepository.save(newCampaign);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    const userId = req.user.userId;

    const campaign = await this.campaignRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!campaign) {
      throw new NotFoundException(
        'Campaña no encontrada o no pertenece a este usuario',
      );
    }

    if (dto.startDate) campaign.startDate = new Date(dto.startDate);
    if (dto.endDate) campaign.endDate = new Date(dto.endDate);

    return this.campaignRepository.save(campaign);
  }
}
