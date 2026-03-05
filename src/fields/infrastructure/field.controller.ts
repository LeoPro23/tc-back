import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { FieldOrmEntity } from './field.orm-entity';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';

@Controller('fields')
@UseGuards(JwtAuthGuard)
export class FieldController {
    constructor(
        @InjectRepository(FieldOrmEntity)
        private readonly fieldRepository: Repository<FieldOrmEntity>,
    ) { }

    @Get()
    async findAll(@Req() req: any) {
        const userId = req.user.userId;
        return this.fieldRepository.find({
            where: { user: { id: userId } },
            order: { createdAt: 'DESC' },
        });
    }

    @Post()
    async create(@Req() req: any, @Body() dto: CreateFieldDto) {
        const userId = req.user.userId;
        const newField = this.fieldRepository.create({
            name: dto.name,
            irrigationType: dto.irrigationType ?? null,
            userId,
        });

        return this.fieldRepository.save(newField);
    }

    @Patch(':id')
    async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateFieldDto) {
        const userId = req.user.userId;
        const field = await this.fieldRepository.findOne({ where: { id, user: { id: userId } } });
        if (!field) {
            throw new Error('Campo no encontrado o no pertenece al usuario');
        }

        if (dto.name !== undefined) field.name = dto.name;
        if (dto.irrigationType !== undefined) field.irrigationType = dto.irrigationType;

        return this.fieldRepository.save(field);
    }
}
