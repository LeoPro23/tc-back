import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachedImageOrmEntity } from './attached-image.orm-entity';

@Module({
    imports: [TypeOrmModule.forFeature([AttachedImageOrmEntity])],
    exports: [TypeOrmModule],
})
export class AttachedImageModule { }
