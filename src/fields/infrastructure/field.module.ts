import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldOrmEntity } from './field.orm-entity';
import { FieldController } from './field.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FieldOrmEntity])],
  controllers: [FieldController],
  exports: [TypeOrmModule],
})
export class FieldModule {}
