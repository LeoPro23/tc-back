import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CampaignOrmEntity } from './campaign.orm-entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { NotFoundException } from '@nestjs/common';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignController {
    constructor(
        @InjectRepository(CampaignOrmEntity)
        private readonly campaignRepository: Repository<CampaignOrmEntity>,
    ) { }

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
    async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
        const userId = req.user.userId;

        const campaign = await this.campaignRepository.findOne({ where: { id, user: { id: userId } } });
        if (!campaign) {
            throw new NotFoundException('Campaña no encontrada o no pertenece a este usuario');
        }

        if (dto.startDate) campaign.startDate = new Date(dto.startDate);
        if (dto.endDate) campaign.endDate = new Date(dto.endDate);

        return this.campaignRepository.save(campaign);
    }
}
