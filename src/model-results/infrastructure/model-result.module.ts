import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelResultOrmEntity } from './model-result.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([ModelResultOrmEntity])],
  exports: [TypeOrmModule],
})
export class ModelResultModule {}
