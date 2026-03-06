import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
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

  @Get('pests-temporal')
  async getPestsTemporal(@Req() req: any, @Query('fieldIds') fieldIds?: string) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return { data: [], topPests: [] };
    }

    const pestQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.isInfected = true')
      .andWhere('analysis.primaryTargetPest IS NOT NULL');

    if (fieldIds) {
      const fieldIdArray = fieldIds.split(',').map((id) => id.trim());
      pestQuery.innerJoin('fc.field', 'field');
      pestQuery.andWhere('field.id IN (:...fieldIdArray)', { fieldIdArray });
    }

    const topPestsResult = await pestQuery
      .select('analysis.primaryTargetPest', 'pestName')
      .addSelect('COUNT(analysis.id)', 'count')
      .groupBy('analysis.primaryTargetPest')
      .orderBy('count', 'DESC')
      .limit(3)
      .getRawMany();

    const topPests = topPestsResult.map((row) => row.pestName);

    if (topPests.length === 0) {
      return { data: [], topPests: [] };
    }

    // 2. Get the daily counts for these top pests
    const temporalQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.primaryTargetPest IN (:...topPests)', { topPests });

    if (fieldIds) {
      const fieldIdArray = fieldIds.split(',').map((id) => id.trim());
      temporalQuery.innerJoin('fc.field', 'field');
      temporalQuery.andWhere('field.id IN (:...fieldIdArray)', { fieldIdArray });
    }

    const temporalData = await temporalQuery
      .select("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'dateStr')
      .addSelect('analysis.primaryTargetPest', 'pestName')
      .addSelect('COUNT(analysis.id)', 'count')
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .addGroupBy('analysis.primaryTargetPest')
      .orderBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    // 3. Format the data for Recharts
    // Expected format: [ { date: '2023-10-01', pestA: 5, pestB: 2 }, ... ]

    // First, group by date
    const groupedByDate: Record<string, any> = {};

    for (const row of temporalData) {
      const dateStr = row.dateStr;
      const pestName = row.pestName;
      const count = Number(row.count);

      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { dateStr };
        // Initialize all top pests to 0 for this date
        topPests.forEach(pest => {
          groupedByDate[dateStr][pest] = 0;
        });
      }

      groupedByDate[dateStr][pestName] = count;
    }

    const data = Object.values(groupedByDate);

    return {
      data,
      topPests
    };
  }

  @Get('fields-temporal')
  async getFieldsTemporal(@Req() req: any, @Query('fieldIds') fieldIds?: string) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return { data: [], topFields: [] };
    }

    // 1. Get the top 3 fields for the current campaign
    const fieldQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field') // Join standard to get field properties
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.isInfected = true');

    if (fieldIds) {
      const fieldIdArray = fieldIds.split(',').map((id) => id.trim());
      fieldQuery.andWhere('field.id IN (:...fieldIdArray)', { fieldIdArray });
    }

    const topFieldsResult = await fieldQuery
      .select('field.name', 'fieldName')
      .addSelect('COUNT(analysis.id)', 'count')
      .groupBy('field.name')
      .orderBy('count', 'DESC')
      .limit(3)
      .getRawMany();

    const topFields = topFieldsResult.map((row) => row.fieldName);

    if (topFields.length === 0) {
      return { data: [], topFields: [] };
    }

    // 2. Get the daily counts for these top fields
    const temporalQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('field.name IN (:...topFields)', { topFields });

    if (fieldIds) {
      const fieldIdArray = fieldIds.split(',').map((id) => id.trim());
      temporalQuery.andWhere('field.id IN (:...fieldIdArray)', { fieldIdArray });
    }

    const temporalData = await temporalQuery
      .select("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'dateStr')
      .addSelect('field.name', 'fieldName')
      .addSelect('COUNT(analysis.id)', 'count')
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .addGroupBy('field.name')
      .orderBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    // 3. Format the data for Recharts
    const groupedByDate: Record<string, any> = {};

    for (const row of temporalData) {
      const dateStr = row.dateStr;
      const fieldName = row.fieldName;
      const count = Number(row.count);

      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { dateStr };
        topFields.forEach(field => {
          groupedByDate[dateStr][field] = 0;
        });
      }

      groupedByDate[dateStr][fieldName] = count;
    }

    const data = Object.values(groupedByDate);

    return {
      data,
      topFields
    };
  }

  // PASO 0.1.1 (BACKEND ORIGEN DE DATOS - CAMPAÑAS): Consulta BD Lotes
  // Este endpoint recibe la petición inicial del Frontend al cargar la página de Análisis.
  // Rescata el JWT del header, y saca el ID del agricultor para buscar solo SUS campañas en la tabla SQL.
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
