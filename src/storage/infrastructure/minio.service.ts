import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinioService {
    private readonly logger = new Logger(MinioService.name);
    private minioClient: Minio.Client;
    private readonly bucketName = 'tomato-analysis';

    constructor() {
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
                await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
                this.logger.log(`Bucket ${this.bucketName} creado y configurado como público.`);
            }
        } catch (error) {
            this.logger.error(`Error inicializando Minio Bucket: ${error.message}`);
        }
    }

    async uploadImage(buffer: Buffer, originalFilename: string, mimeType: string): Promise<{ url: string, filename: string }> {
        const extension = originalFilename.split('.').pop() || 'jpg';
        const filename = `${uuidv4()}_${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        try {
            await this.minioClient.putObject(
                this.bucketName,
                filename,
                buffer,
                buffer.length,
                { 'Content-Type': mimeType }
            );

            // Construcción de la URL pública asumiendo que el endpoint es el root expuesto
            const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
            const port = process.env.MINIO_PORT === '443' || process.env.MINIO_PORT === '80'
                ? ''
                : `:${process.env.MINIO_PORT}`;

            // Extraemos el host limpio de nuevo en caso de tener scheme
            let cleanHost = process.env.MINIO_ENDPOINT || 'localhost';
            if (cleanHost.startsWith('http')) {
                cleanHost = new URL(cleanHost).hostname;
            }

            const publicUrl = `${protocol}://${cleanHost}${port}/${this.bucketName}/${filename}`;
            return { url: publicUrl, filename };
        } catch (error) {
            this.logger.error(`Fallo subiendo imagen a Minio: ${error.message}`);
            throw error;
        }
    }
}
