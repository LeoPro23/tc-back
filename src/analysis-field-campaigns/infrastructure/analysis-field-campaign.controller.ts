import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
import { AnalysisFieldCampaignService } from '../application/analysis-field-campaign.service';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';

@Controller('analysis-field-campaigns')
@UseGuards(JwtAuthGuard)
export class AnalysisFieldCampaignController {
  constructor(private readonly analysisService: AnalysisFieldCampaignService) { }

  @Get('history')
  async getHistory(
    @Req() req: any,
    @Query('campaignId') campaignId: string,
    @Query('isInfected') isInfectedStr?: string,
    @Query('fieldIds') fieldIdsStr?: string,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    let isInfected: boolean | undefined = undefined;
    if (isInfectedStr === 'true') isInfected = true;
    if (isInfectedStr === 'false') isInfected = false;

    const fieldIds = fieldIdsStr
      ? fieldIdsStr.split(',').map((id) => id.trim())
      : undefined;

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    return await this.analysisService.getHistory(
      req.user.userId,
      campaignId,
      isInfected,
      fieldIds,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    return await this.analysisService.getById(req.user.userId, id);
  }
}
