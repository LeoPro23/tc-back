import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PendingUploadOrmEntity } from '../infrastructure/pending-upload.orm-entity';
import { MinioService } from '../infrastructure/minio.service';

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  constructor(
    @InjectRepository(PendingUploadOrmEntity)
    private readonly pendingRepo: Repository<PendingUploadOrmEntity>,
    private readonly minioService: MinioService,
    private readonly entityManager: EntityManager,
  ) {}

  onModuleInit() {
    this.intervalHandle = setInterval(() => this.syncPendingUploads(), 60_000);
    setTimeout(() => this.syncPendingUploads(), 15_000);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  private async syncPendingUploads(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const pending = await this.pendingRepo.find({
        where: { synced: false },
        order: { createdAt: 'ASC' },
      });

      if (pending.length === 0) return;

      const reachable = await this.minioService.isCloudReachable();
      if (!reachable) return;

      this.logger.log(
        `MinIO disponible. Sincronizando ${pending.length} archivo(s) pendiente(s)...`,
      );

      let synced = 0;

      for (const upload of pending) {
        try {
          const filePath = join(
            process.cwd(),
            'uploads',
            upload.localFilename,
          );

          if (!existsSync(filePath)) {
            this.logger.warn(
              `Archivo local no encontrado: ${upload.localFilename}. Marcando como sincronizado.`,
            );
            upload.synced = true;
            await this.pendingRepo.save(upload);
            continue;
          }

          const buffer = readFileSync(filePath);
          const result = await this.minioService.uploadToCloud(
            buffer,
            upload.localFilename,
            upload.mimeType,
          );

          if (!result) {
            this.logger.warn(
              `No se pudo subir ${upload.localFilename} a MinIO. Se reintentará.`,
            );
            continue;
          }

          await this.updateUrlsInDatabase(upload.localUrl, result.url);

          upload.synced = true;
          upload.minioUrl = result.url;
          await this.pendingRepo.save(upload);

          try {
            unlinkSync(filePath);
          } catch {
            /* local cleanup is best-effort */
          }

          synced++;
          this.logger.log(
            `Sincronizado: ${upload.localFilename} → ${result.url}`,
          );
        } catch (error) {
          this.logger.error(
            `Error sincronizando ${upload.localFilename}: ${error.message}`,
          );
        }
      }

      if (synced > 0) {
        this.logger.log(
          `Sincronización completada: ${synced}/${pending.length} archivo(s).`,
        );
      }
    } finally {
      this.syncing = false;
    }
  }

  private async updateUrlsInDatabase(
    localUrl: string,
    minioUrl: string,
  ): Promise<void> {
    await this.entityManager.query(
      `UPDATE attached_images SET url_or_filepath = $1 WHERE url_or_filepath = $2`,
      [minioUrl, localUrl],
    );

    await this.entityManager.query(
      `UPDATE analysis_comment SET audio_url = $1 WHERE audio_url = $2`,
      [minioUrl, localUrl],
    );
  }
}
