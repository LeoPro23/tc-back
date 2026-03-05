import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { FieldCampaignOrmEntity } from './field-campaign.orm-entity';
import { CreateFieldCampaignDto } from './dto/create-field-campaign.dto';

@Controller('field-campaigns')
@UseGuards(JwtAuthGuard)
export class FieldCampaignController {
    constructor(
        @InjectRepository(FieldCampaignOrmEntity)
        private readonly fieldCampaignRepo: Repository<FieldCampaignOrmEntity>,
    ) { }

    @Get('campaign/:campaignId')
    async findByCampaign(@Req() req: any, @Param('campaignId') campaignId: string) {
        const userId = req.user.userId;
        return this.fieldCampaignRepo.find({
            where: {
                campaign: { id: campaignId, user: { id: userId } }
            },
            relations: ['field', 'campaign'],
            order: { createdAt: 'DESC' },
        });
    }

    @Post()
    async enroll(@Req() req: any, @Body() dto: CreateFieldCampaignDto) {
        const newEnrollment = this.fieldCampaignRepo.create({
            field: { id: dto.fieldId },
            campaign: { id: dto.campaignId },
        });

        const saved = await this.fieldCampaignRepo.save(newEnrollment);
        return this.fieldCampaignRepo.findOne({
            where: { id: saved.id },
            relations: ['field', 'campaign'],
        });
    }
}
