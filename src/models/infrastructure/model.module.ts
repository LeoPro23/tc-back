import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelOrmEntity } from './model.orm-entity';

@Module({
    imports: [TypeOrmModule.forFeature([ModelOrmEntity])],
    exports: [TypeOrmModule],
})
export class ModelModule { }
