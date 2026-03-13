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
import { CampaignIntelligenceService } from '../application/campaign-intelligence.service';
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
    private readonly campaignIntelligenceService: CampaignIntelligenceService,
  ) { }

  @Get('metrics')
  async getMetrics(
    @Req() req: any,
    @Query('campaignId') queryCampaignId?: string
  ) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: queryCampaignId 
        ? { id: queryCampaignId, user: { id: userId } }
        : { user: { id: userId }, isActive: true },
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
  async getPestsTemporal(
    @Req() req: any, 
    @Query('fieldIds') fieldIds?: string,
    @Query('campaignId') queryCampaignId?: string
  ) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: queryCampaignId 
        ? { id: queryCampaignId, user: { id: userId } }
        : { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return { data: [], topPests: [] };
    }

    // Forzamos las 3 plagas principales para que el gráfico siempre sea robusto (Triángulo fijo)
    const topPests = ['tuta_absoluta', 'minador', 'mosca_blanca'];

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
      .addSelect('SUM(analysis.bugDensity)', 'density')
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .addGroupBy('analysis.primaryTargetPest')
      .orderBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    const groupedByDate: Record<string, any> = {};

    for (const row of temporalData) {
      const dateStr = row.dateStr;
      const pestName = row.pestName;
      const count = Number(row.density);

      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { dateStr };
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

  @Get('pest-evolution')
  async getPestEvolution(
    @Req() req: any, 
    @Query('fieldIds') fieldIds?: string,
    @Query('campaignId') queryCampaignId?: string,
    @Query('pest') queryPest?: string
  ) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: queryCampaignId 
        ? { id: queryCampaignId, user: { id: userId } }
        : { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return { data: [], topFields: [], pest: queryPest || 'N/A' };
    }

    let targetPest = queryPest;
    if (!targetPest || targetPest === 'null' || targetPest === 'undefined') {
      const topPestResult = await this.analysisRepository
        .createQueryBuilder('analysis')
        .innerJoin('analysis.fieldCampaign', 'fc')
        .innerJoin('fc.campaign', 'campaign')
        .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
        .andWhere('analysis.isInfected = true')
        .andWhere('analysis.primaryTargetPest IS NOT NULL')
        .select('analysis.primaryTargetPest', 'pestName')
        .addSelect('SUM(analysis.bugDensity)', 'totalDensity')
        .groupBy('analysis.primaryTargetPest')
        .orderBy('SUM(analysis.bugDensity)', 'DESC')
        .limit(1)
        .getRawOne();
      
      targetPest = topPestResult?.pestName || 'tuta_absoluta';
    }

    const fieldCountQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.primaryTargetPest = :pest', { pest: targetPest });

    if (fieldIds) {
      const fieldIdArray = fieldIds.split(',').map((id) => id.trim());
      fieldCountQuery.andWhere('field.id IN (:...fieldIdArray)', { fieldIdArray });
    }

    const topFieldsResult = await fieldCountQuery
      .select('field.name', 'fieldName')
      .addSelect('SUM(analysis.bugDensity)', 'totalDensity')
      .groupBy('field.name')
      .orderBy('SUM(analysis.bugDensity)', 'DESC')
      .limit(4)
      .getRawMany();

    const topFields = topFieldsResult.map((row) => row.fieldName);

    if (topFields.length === 0) {
      return { data: [], topFields: [], pest: targetPest };
    }

    const temporalQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.primaryTargetPest = :pest', { pest: targetPest })
      .andWhere('field.name IN (:...topFields)', { topFields });

    const temporalData = await temporalQuery
      .select("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'dateStr')
      .addSelect('field.name', 'fieldName')
      .addSelect('SUM(analysis.bugDensity)', 'density') 
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .addGroupBy('field.name')
      .orderBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    const groupedByDate: Record<string, any> = {};
    for (const row of temporalData) {
      const dateStr = row.dateStr;
      const fieldName = row.fieldName;
      const count = Number(row.density);
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { date: dateStr };
        topFields.forEach(f => groupedByDate[dateStr][f] = 0);
      }
      groupedByDate[dateStr][fieldName] = count;
    }

    return {
      data: Object.values(groupedByDate),
      topFields,
      pest: targetPest
    };
  }

  @Get('fields-temporal')
  async getFieldsTemporal(
    @Req() req: any, 
    @Query('fieldIds') fieldIds?: string,
    @Query('campaignId') queryCampaignId?: string
  ) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: queryCampaignId 
        ? { id: queryCampaignId, user: { id: userId } }
        : { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return { data: [], topFields: [] };
    }

    const fieldQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.isInfected = true');

    if (fieldIds) {
      const fieldIdArray = fieldIds.split(',').map((id) => id.trim());
      fieldQuery.andWhere('field.id IN (:...fieldIdArray)', { fieldIdArray });
    }

    const topFieldsResult = await fieldQuery
      .select('field.name', 'fieldName')
      .addSelect('SUM(analysis.bugDensity)', 'totalDensity')
      .groupBy('field.name')
      .orderBy('SUM(analysis.bugDensity)', 'DESC')
      .limit(3)
      .getRawMany();

    const topFields = topFieldsResult.map((row) => row.fieldName);

    if (topFields.length === 0) {
      return { data: [], topFields: [] };
    }

    const temporalQuery = this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('field.name IN (:...topFields)', { topFields });

    const temporalData = await temporalQuery
      .select("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'dateStr')
      .addSelect('field.name', 'fieldName')
      .addSelect('SUM(analysis.bugDensity)', 'density')
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .addGroupBy('field.name')
      .orderBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    const groupedByDate: Record<string, any> = {};
    for (const row of temporalData) {
      const dateStr = row.dateStr;
      const fieldName = row.fieldName;
      const count = Number(row.density);
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = { date: dateStr };
        topFields.forEach(field => { groupedByDate[dateStr][field] = 0; });
      }
      groupedByDate[dateStr][fieldName] = count;
    }

    return {
      data: Object.values(groupedByDate),
      topFields
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


  @Get('field-risk-profile')
  async getFieldRiskProfile(
    @Req() req: any,
    @Query('campaignId') queryCampaignId?: string
  ) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: queryCampaignId 
        ? { id: queryCampaignId, user: { id: userId } }
        : { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return [];
    }

    const past14Days = currentCampaign.startDate || new Date(new Date().setDate(new Date().getDate() - 30));

    const queryData = await this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.isInfected = true')
      .andWhere('analysis.primaryTargetPest IS NOT NULL')
      .andWhere('analysis.date >= :past14Days', { past14Days })
      .select('analysis.primaryTargetPest', 'pestName')
      .addSelect('field.name', 'fieldName')
      .addSelect('SUM(analysis.bugDensity)', 'density')
      .groupBy('analysis.primaryTargetPest')
      .addGroupBy('field.name')
      .getRawMany();

    const ALL_PESTS = ['tuta_absoluta', 'minador', 'mosca_blanca'];
    const ALL_FIELDS = Array.from(new Set(queryData.map(r => r.fieldName)));

    const formattedData = ALL_PESTS.map(pest => {
      const row: any = { pest };
      ALL_FIELDS.forEach(field => {
        const match = queryData.find(q => q.pestName === pest && q.fieldName === field);
        row[field] = match ? Number(match.density) : 0;
      });
      return row;
    });

    return {
      pests: ALL_PESTS,
      fields: ALL_FIELDS,
      data: formattedData
    };
  }

  @Get('field-performance')
  async getFieldPerformance(
    @Req() req: any, 
    @Query('field') targetField?: string,
    @Query('campaignId') queryCampaignId?: string
  ) {
    const userId = req.user.userId;

    const currentCampaign = await this.campaignRepository.findOne({
      where: queryCampaignId 
        ? { id: queryCampaignId, user: { id: userId } }
        : { user: { id: userId }, isActive: true },
    });

    if (!currentCampaign) {
      return [];
    }

    let fieldToFilter = targetField;
    if (!fieldToFilter || fieldToFilter === 'null' || fieldToFilter === 'undefined') {
       const topFieldResult = await this.analysisRepository
        .createQueryBuilder('analysis')
        .innerJoin('analysis.fieldCampaign', 'fc')
        .innerJoin('fc.campaign', 'campaign')
        .innerJoin('fc.field', 'field')
        .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
        .andWhere('analysis.isInfected = true')
        .select('field.name', 'fieldName')
        .addSelect('SUM(analysis.bugDensity)', 'density')
        .groupBy('field.name')
        .orderBy('SUM(analysis.bugDensity)', 'DESC')
        .limit(1)
        .getRawOne();
      
      if (!topFieldResult) return { field: null, data: [] };
      fieldToFilter = topFieldResult.fieldName;
    }

    const startDate = currentCampaign.startDate || new Date(new Date().setDate(new Date().getDate() - 90));

    const generalData = await this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('analysis.isInfected = true')
      .andWhere('analysis.date >= :startDate', { startDate })
      .select("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'dateStr')
      .addSelect('COUNT(DISTINCT field.id)', 'totalActiveFields')
      .addSelect('SUM(analysis.bugDensity)', 'totalDensity')
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    const specificFieldData = await this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId: currentCampaign.id })
      .andWhere('field.name = :fieldToFilter', { fieldToFilter })
      .andWhere('analysis.isInfected = true')
      .andWhere('analysis.date >= :startDate', { startDate })
      .select("TO_CHAR(analysis.date, 'YYYY-MM-DD')", 'dateStr')
      .addSelect('SUM(analysis.bugDensity)', 'density')
      .groupBy("TO_CHAR(analysis.date, 'YYYY-MM-DD')")
      .getRawMany();

    const groupedByDate: Record<string, any> = {};

    generalData.forEach(g => {
      const avg = Number(g.totalActiveFields) > 0 ? (Number(g.totalDensity) / Number(g.totalActiveFields)) : 0;
      groupedByDate[g.dateStr] = {
        date: g.dateStr,
        campaignAverage: Number(avg.toFixed(1)),
        fieldIncidence: 0 
      };
    });

    specificFieldData.forEach(s => {
      if (!groupedByDate[s.dateStr]) {
        groupedByDate[s.dateStr] = {
          date: s.dateStr,
          campaignAverage: 0,
          fieldIncidence: Number(s.density)
        };
      } else {
        groupedByDate[s.dateStr].fieldIncidence = Number(s.density);
      }
    });

    const sortedData = Object.values(groupedByDate).sort((a: any, b: any) => a.date.localeCompare(b.date));

    return {
      field: fieldToFilter,
      data: sortedData
    };
  }

  @Get('strategic-recommendation')
  async getStrategicRecommendation(
    @Req() req: any,
    @Query('campaignId') queryCampaignId?: string
  ) {
    const metrics = await this.getMetrics(req, queryCampaignId);
    const pestsObj = await this.getPestsTemporal(req, undefined, queryCampaignId);
    const fieldsObj = await this.getFieldsTemporal(req, undefined, queryCampaignId);
    const riskProfile = await this.getFieldRiskProfile(req, queryCampaignId);

    return this.campaignIntelligenceService.generateStrategicRecommendation(
      metrics,
      Array.isArray((riskProfile as any)?.data) ? (riskProfile as any).data : [],
      pestsObj.topPests || [],
      fieldsObj.topFields || []
    );
  }

  @Get('compare-evolution')
  async getCompareEvolution(@Req() req: any, @Query('campaignIds') campaignIdsStr?: string) {
    try {
      if (!campaignIdsStr) return { campaigns: [], data: [] };
      const ids = campaignIdsStr.split(',').map(id => id.trim());
      if (ids.length === 0) return { campaigns: [], data: [] };

      const campaigns = await this.campaignRepository.createQueryBuilder('campaign')
        .innerJoin('campaign.user', 'user')
        .where('campaign.id IN (:...ids)', { ids })
        .andWhere('user.id = :userId', { userId: req.user.userId })
        .getMany();

      if (campaigns.length === 0) return { campaigns: [], data: [] };
      const validIds = campaigns.map(c => c.id);

      const queryData = await this.analysisRepository
        .createQueryBuilder('analysis')
        .innerJoin('analysis.fieldCampaign', 'fc')
        .innerJoin('fc.campaign', 'campaign')
        .where('campaign.id IN (:...validIds)', { validIds })
        .andWhere('analysis.isInfected = true')
        .select('campaign.id', 'campaignId')
        .addSelect("TRUNC((EXTRACT(EPOCH FROM analysis.date) - EXTRACT(EPOCH FROM campaign.startDate)) / (86400 * 7))", 'relativeWeek')
        .addSelect('SUM(analysis.bugDensity)', 'density')
        .groupBy('campaign.id')
        .addGroupBy("TRUNC((EXTRACT(EPOCH FROM analysis.date) - EXTRACT(EPOCH FROM campaign.startDate)) / (86400 * 7))")
        .orderBy("1", 'ASC')
        .getRawMany();

      const campaignMap: Record<string, string> = {};
      campaigns.forEach(c => {
        campaignMap[c.id] = c.isActive ? `Campaña ${c.id.substring(0,8)} (Activa)` : `Campaña ${c.id.substring(0,8)}`;
      });

      const groupedByWeek: Record<string, any> = {};
      const ALL_CAMPAIGNS = Array.from(new Set(campaigns.map(c => campaignMap[c.id])));

      for (const row of queryData) {
        if (row.relativeWeek === null || row.relativeWeek === undefined) continue;
        const weekIndex = Number(row.relativeWeek);
        const week = `Semana ${Math.max(0, weekIndex)}`;
        const campaignName = campaignMap[row.campaignId];
        const count = Number(row.density);

        if (!groupedByWeek[week]) {
          groupedByWeek[week] = { relativeTime: week, sortKey: Math.max(0, weekIndex) };
          ALL_CAMPAIGNS.forEach(c => { groupedByWeek[week][c] = 0; });
        }
        groupedByWeek[week][campaignName] += count; 
      }

      const data = Object.values(groupedByWeek).sort((a: any, b: any) => a.sortKey - b.sortKey);

      return { campaigns: ALL_CAMPAIGNS, data };
    } catch (error) {
      console.error("[COMPARE-EVOLUTION ERROR]", error);
      throw error;
    }
  }

  @Get('compare-risk-profile')
  async getCompareRiskProfile(@Req() req: any, @Query('campaignIds') campaignIdsStr?: string) {
    if (!campaignIdsStr) return { pests: [], campaigns: [], data: [] };
    const ids = campaignIdsStr.split(',').map(id => id.trim());
    if (ids.length === 0) return { pests: [], campaigns: [], data: [] };
    
    const campaigns = await this.campaignRepository.createQueryBuilder('campaign')
      .innerJoin('campaign.user', 'user')
      .where('campaign.id IN (:...ids)', { ids })
      .andWhere('user.id = :userId', { userId: req.user.userId })
      .getMany();
    if (campaigns.length === 0) return { pests: [], campaigns: [], data: [] };
    const validIds = campaigns.map(c => c.id);

    const queryData = await this.analysisRepository
      .createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .where('campaign.id IN (:...validIds)', { validIds })
      .andWhere('analysis.isInfected = true')
      .andWhere('analysis.primaryTargetPest IS NOT NULL')
      .select('campaign.id', 'campaignId')
      .addSelect('analysis.primaryTargetPest', 'pestName')
      .addSelect('SUM(analysis.bugDensity)', 'density')
      .groupBy('campaign.id')
      .addGroupBy('analysis.primaryTargetPest')
      .getRawMany();

    const campaignMap: Record<string, string> = {};
    campaigns.forEach(c => {
      campaignMap[c.id] = c.isActive ? `Campaña ${c.id.substring(0,8)} (Activa)` : `Campaña ${c.id.substring(0,8)}`;
    });

    const ALL_PESTS = ['tuta_absoluta', 'minador', 'mosca_blanca'];
    const ALL_CAMPAIGNS = Array.from(new Set(campaigns.map(c => campaignMap[c.id])));

    const formattedData = ALL_PESTS.map(pest => {
      const row: any = { pest };
      ALL_CAMPAIGNS.forEach(c => {
        const match = queryData.find(q => q.pestName === pest && campaignMap[q.campaignId] === c);
        row[c] = match ? Number(match.density) : 0;
      });
      return row;
    });

    return { pests: ALL_PESTS, campaigns: ALL_CAMPAIGNS, data: formattedData };
  }

  @Get('compare-performance')
  async getComparePerformance(@Req() req: any, @Query('campaignIds') campaignIdsStr?: string) {
    if (!campaignIdsStr) return { campaigns: [], data: [] };
    const ids = campaignIdsStr.split(',').map(id => id.trim());
    if (ids.length === 0) return { campaigns: [], data: [] };
    
    const campaigns = await this.campaignRepository.createQueryBuilder('campaign')
      .innerJoin('campaign.user', 'user')
      .where('campaign.id IN (:...ids)', { ids })
      .andWhere('user.id = :userId', { userId: req.user.userId })
      .getMany();
    if (campaigns.length === 0) return { campaigns: [], data: [] };
    const validIds = campaigns.map(c => c.id);

      const queryData = await this.analysisRepository
        .createQueryBuilder('analysis')
        .innerJoin('analysis.fieldCampaign', 'fc')
        .innerJoin('fc.campaign', 'campaign')
        .where('campaign.id IN (:...validIds)', { validIds })
        .andWhere('analysis.isInfected = true')
        .select('campaign.id', 'campaignId')
        .addSelect("TRUNC((EXTRACT(EPOCH FROM analysis.date) - EXTRACT(EPOCH FROM campaign.startDate)) / (86400 * 30))", 'relativeMonth')
        .addSelect('SUM(analysis.bugDensity)', 'density')
        .groupBy('campaign.id')
        .addGroupBy("TRUNC((EXTRACT(EPOCH FROM analysis.date) - EXTRACT(EPOCH FROM campaign.startDate)) / (86400 * 30))")
        .orderBy("1", 'ASC')
        .getRawMany();

    const campaignMap: Record<string, string> = {};
    campaigns.forEach(c => {
      campaignMap[c.id] = c.isActive ? `Campaña ${c.id.substring(0,8)} (Activa)` : `Campaña ${c.id.substring(0,8)}`;
    });

    const groupedByMonth: Record<string, any> = {};
    const ALL_CAMPAIGNS = Array.from(new Set(campaigns.map(c => campaignMap[c.id])));

    for (const row of queryData) {
      if (row.relativeMonth === null || row.relativeMonth === undefined) continue;
      const monthIndex = Number(row.relativeMonth);
      const month = `Mes ${Math.max(1, monthIndex + 1)}`;
      const campaignName = campaignMap[row.campaignId];
      const count = Number(row.density);

      if (!groupedByMonth[month]) {
        groupedByMonth[month] = { relativeTime: month, sortKey: Math.max(1, monthIndex + 1) };
        ALL_CAMPAIGNS.forEach(c => { groupedByMonth[month][c] = 0; });
      }
      groupedByMonth[month][campaignName] += count;
    }

    const data = Object.values(groupedByMonth).sort((a: any, b: any) => a.sortKey - b.sortKey);

    return { campaigns: ALL_CAMPAIGNS, data };
  }
}
