import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { FieldOrmEntity } from './field.orm-entity';
import { CreateFieldDto } from './dto/create-field.dto';

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
            userId,
        });

        return this.fieldRepository.save(newField);
    }
}
