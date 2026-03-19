import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PendingUploadOrmEntity } from './pending-upload.orm-entity';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private readonly bucketName = 'tomato-analysis';

  constructor(
    @InjectRepository(PendingUploadOrmEntity)
    private readonly pendingUploadRepo: Repository<PendingUploadOrmEntity>,
  ) {
    const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
    // Parse URL to extract hostname and protocol
    let hostname = endPoint;
    let useSSL = process.env.MINIO_USE_SSL === 'true';

    try {
      if (endPoint.startsWith('http')) {
        const url = new URL(endPoint);
        hostname = url.hostname;
        useSSL = url.protocol === 'https:';
      }
    } catch (e) { }

    this.minioClient = new Minio.Client({
      endPoint: hostname,
      port: parseInt(process.env.MINIO_PORT || (useSSL ? '443' : '80')),
      useSSL: useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
    });

    this.initializeBucket();
  }

  private async initializeBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');

        // Hacer el bucket publico para lectura
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(policy),
        );
        this.logger.log(
          `Bucket ${this.bucketName} creado y configurado como público.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error inicializando Minio Bucket: ${error.message}`);
    }
  }

  async uploadImage(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<{ url: string; filename: string }> {
    const extension = originalFilename.split('.').pop() || 'jpg';
    const filename = `${uuidv4()}_${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // PASO 6.2.1 (ALMACENAMIENTO BINARIO - S3/MINIO)
    // El Buffer de RAM directamente se serializa hacia el Object Storage
    // usando librerías AWS S3 compatibles (MinIO en este caso).
    try {
      await this.minioClient.putObject(
        this.bucketName,
        filename,
        buffer,
        buffer.length,
        { 'Content-Type': mimeType },
      );

      // Construcción de la URL pública asumiendo que el endpoint es el root expuesto
      const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
      const port =
        process.env.MINIO_PORT === '443' || process.env.MINIO_PORT === '80'
          ? ''
          : `:${process.env.MINIO_PORT}`;

      // Extraemos el host limpio de nuevo en caso de tener scheme
      let cleanHost = process.env.MINIO_ENDPOINT || 'localhost';
      if (cleanHost.startsWith('http')) {
        cleanHost = new URL(cleanHost).hostname;
      }

      // PASO 6.2.2 (GENERACIÓN DE RUTA PÚBLICA)
      // Se formatea la IP/Dominio de Edge Cloud para devolverle al UseCase 
      // un string (URL) en texto plano, que será lo que realmente se almacene en Postgres SQL.
      const publicUrl = `${protocol}://${cleanHost}${port}/${this.bucketName}/${filename}`;
      return { url: publicUrl, filename };
    } catch (error) {
      this.logger.warn(
        `MinIO no disponible (${error.message}). Guardando en disco local.`,
      );
      return this.saveToLocalDisk(buffer, filename, mimeType);
    }
  }

  /**
   * Upload directly to MinIO without local fallback.
   * Used by SyncService to re-upload pending files.
   */
  async uploadToCloud(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ url: string; filename: string } | null> {
    try {
      await this.minioClient.putObject(
        this.bucketName,
        filename,
        buffer,
        buffer.length,
        { 'Content-Type': mimeType },
      );

      const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
      const port =
        process.env.MINIO_PORT === '443' || process.env.MINIO_PORT === '80'
          ? ''
          : `:${process.env.MINIO_PORT}`;

      let cleanHost = process.env.MINIO_ENDPOINT || 'localhost';
      if (cleanHost.startsWith('http')) {
        cleanHost = new URL(cleanHost).hostname;
      }

      const publicUrl = `${protocol}://${cleanHost}${port}/${this.bucketName}/${filename}`;
      return { url: publicUrl, filename };
    } catch {
      return null;
    }
  }

  async isCloudReachable(): Promise<boolean> {
    try {
      await this.minioClient.bucketExists(this.bucketName);
      return true;
    } catch {
      return false;
    }
  }

  private async saveToLocalDisk(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ url: string; filename: string }> {
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    const localPath = join(uploadsDir, filename);
    writeFileSync(localPath, buffer);

    const port = process.env.PORT ?? '8000';
    const publicUrl = `http://localhost:${port}/uploads/${filename}`;

    try {
      const pending = this.pendingUploadRepo.create({
        localFilename: filename,
        localUrl: publicUrl,
        mimeType,
      });
      await this.pendingUploadRepo.save(pending);
      this.logger.log(
        `Archivo guardado localmente (pendiente de sincronizar): ${publicUrl}`,
      );
    } catch (err) {
      this.logger.warn(`No se pudo registrar upload pendiente: ${err.message}`);
    }

    return { url: publicUrl, filename };
  }
}
