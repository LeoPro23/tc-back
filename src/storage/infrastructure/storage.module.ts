import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinioService } from './minio.service';
import { PendingUploadOrmEntity } from './pending-upload.orm-entity';
import { SyncService } from '../application/sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([PendingUploadOrmEntity])],
  providers: [MinioService, SyncService],
  exports: [MinioService],
})
export class StorageModule {}
