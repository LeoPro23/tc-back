import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { IPestRepository } from '../domain/pest.repository.interface';
import { BatchInterpretation, PestAnalysisResult } from '../domain/pest.entity';
import { ImageVerificationService } from './image-verification.service';
import { AnalysisInterpretationService } from './analysis-interpretation.service';
import { MinioService } from '../../storage/infrastructure/minio.service';
import { NotificationService } from '../../notifications/application/notification.service';
import { EntityManager } from 'typeorm';
import { CampaignOrmEntity } from '../../campaigns/infrastructure/campaign.orm-entity';
import { FieldOrmEntity } from '../../fields/infrastructure/field.orm-entity';
import { FieldCampaignOrmEntity } from '../../field-campaigns/infrastructure/field-campaign.orm-entity';
import { AnalysisFieldCampaignOrmEntity } from '../../analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { AttachedImageOrmEntity } from '../../attached-images/infrastructure/attached-image.orm-entity';
import { ModelResultOrmEntity } from '../../model-results/infrastructure/model-result.orm-entity';
import { ModelOrmEntity } from '../../models/infrastructure/model.orm-entity';
import { UserOrmEntity } from '../../auth/infrastructure/user.orm-entity';

@Injectable()
export class AnalyzePestUseCase {
  private readonly logger = new Logger(AnalyzePestUseCase.name);

  constructor(
    @Inject(IPestRepository)
    private readonly pestRepository: IPestRepository,
    private readonly imageVerificationService: ImageVerificationService,
    private readonly analysisInterpretationService: AnalysisInterpretationService,
    private readonly minioService: MinioService,
    private readonly entityManager: EntityManager,
    private readonly notificationService: NotificationService,
  ) { }

  async execute(
    imageBuffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<PestAnalysisResult> {
    const decision = await this.imageVerificationService.verifyImage(
      imageBuffer,
      mimeType,
    );
    if (!decision.isValid) {
      throw new BadRequestException(
        `Imagen rechazada por verificación: ${decision.reason}`,
      );
    }

    const result = await this.pestRepository.analyzeImage(
      imageBuffer,
      filename,
    );
    if (!result.verified) {
      throw new BadRequestException(
        `Imagen rechazada por análisis: ${result.verificationReason}`,
      );
    }

    return result;
  }

  async executeBatch(
    images: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    userId: string,
    fieldCampaignId: string,
    agronomicContext?: {
      phenologicalState: string | null;
      soilQuality: string | null;
      currentClimate: string | null;
    },
  ): Promise<{
    results: PestAnalysisResult[];
    interpretation: BatchInterpretation;
  }> {
    const results: PestAnalysisResult[] = [];
    const validImagesForMinio: {
      buffer: Buffer;
      filename: string;
      mimeType: string;
      resultTemp: PestAnalysisResult;
    }[] = [];

    // 1. Process sequentially ML Inference (sin subir a minio todavía)
    for (const image of images) {
      const decision = await this.imageVerificationService.verifyImage(
        image.buffer,
        image.mimeType,
      );
      if (!decision.isValid) {
        results.push(
          new PestAnalysisResult(
            image.filename,
            [],
            [],
            false,
            decision.reason,
          ),
        );
        continue;
      }

      const resultTemp = await this.pestRepository.analyzeImage(
        image.buffer,
        image.filename,
      );
      results.push(resultTemp);

      if (resultTemp.verified) {
        validImagesForMinio.push({ ...image, resultTemp });
      }
    }

    // 2. Obtener Interpretación General del LLM
    const interpretation =
      await this.analysisInterpretationService.interpretBatch(
        results,
        agronomicContext,
      );

    // 3. Efectuar Transacción de Guardado BDD + Subida Minio
    let createdAnalysisId: string | undefined;

    try {
      createdAnalysisId = await this.entityManager.transaction(async (manager) => {
        const user = await manager.findOne(UserOrmEntity, {
          where: { id: userId },
        });
        if (!user)
          throw new BadRequestException(
            'Usuario no válido para guardar análisis',
          );

        // Relación real desde la interfaz
        const fieldCampaign = await manager.findOne(FieldCampaignOrmEntity, {
          where: { id: fieldCampaignId },
          relations: ['campaign', 'field', 'campaign.user'],
        });

        if (!fieldCampaign || fieldCampaign.campaign.user.id !== userId) {
          throw new BadRequestException(
            'La inscripción de campo proveída no existe o no pertenece a este usuario',
          );
        }

        if (!fieldCampaign.campaign.isActive) {
          throw new BadRequestException(
            'La campaña asociada a este campo ya no está activa',
          );
        }

        // Calcular isInfected, plaga principal y confianza máxima
        let isInfected = false;
        let primaryTargetPest: string | null = null;
        let maxConfidence: number | null = null;

        for (const r of results) {
          if (r.verified && r.detections.length > 0) {
            isInfected = true;
            for (const det of r.detections) {
              if (maxConfidence === null || det.confidence > maxConfidence) {
                maxConfidence = det.confidence;
                primaryTargetPest = det.className;
              }
            }
          }
        }

        const analysisLog = manager.create(AnalysisFieldCampaignOrmEntity, {
          fieldCampaign,
          date: new Date(),
          generalSummary: interpretation.generalSummary,
          generalRecommendation: interpretation.generalRecommendation,
          recommendedProduct: interpretation.generalProduct,
          operativeGuide: interpretation.generalOperativeGuide,
          biosecurityProtocol: interpretation.generalBiosecurityProtocol,
          phenologicalState: agronomicContext?.phenologicalState ?? null,
          soilQuality: agronomicContext?.soilQuality ?? null,
          currentClimate: agronomicContext?.currentClimate ?? null,
          isInfected,
          primaryTargetPest,
          maxConfidence,
        });
        await manager.save(analysisLog);

        // Models cache
        const modelCache = new Map<string, ModelOrmEntity>();

        for (let i = 0; i < validImagesForMinio.length; i++) {
          const img = validImagesForMinio[i];

          // Subida a minio
          const uploaded = await this.minioService.uploadImage(
            img.buffer,
            img.filename,
            img.mimeType,
          );

          // Parseo LLM PerImage basado en su filename
          const llmInterp = interpretation.perImage.find(
            (p) => p.filename.toLowerCase() === img.filename.toLowerCase(),
          );

          const attachedLog = manager.create(AttachedImageOrmEntity, {
            analysis: analysisLog,
            url: uploaded.url,
            fileName: uploaded.filename,
            height: 0,
            width: 0,
            imageRecommendation:
              llmInterp?.imageRecommendation || 'Sin hallazgos mayores',
            recommendedProduct: llmInterp?.recipe?.product || 'No aplica',
            operativeGuide: llmInterp?.recipe?.method || 'N/A',
            biosecurityProtocol: llmInterp?.biosecurityProtocol || 'N/A',
          });
          await manager.save(attachedLog);

          // Resultados Modelos
          for (const det of img.resultTemp.detections) {
            const rawModelName = det.model || 'yolov8_default';
            let dbModel = modelCache.get(rawModelName);
            if (!dbModel) {
              dbModel =
                (await manager.findOne(ModelOrmEntity, {
                  where: { name: rawModelName },
                })) || undefined;
              if (!dbModel) {
                dbModel = manager.create(ModelOrmEntity, {
                  name: rawModelName,
                });
                await manager.save(dbModel);
              }
              modelCache.set(rawModelName, dbModel);
            }

            const resultModelLog = manager.create(ModelResultOrmEntity, {
              model: dbModel,
              image: attachedLog,
              diagnosis: det.className,
              confidence: det.confidence,
              boundingBox: det.box,
            });
            await manager.save(resultModelLog);
          }
        }

        return analysisLog.id;
      });
      // El scope de la TBL en manager ha terminado exitosamente (y la IA ha respondido)
      this.logger.log(
        `Análisis guardado exitosamente: ${results.length} imgs para user ${userId}`,
      );

      // Dispatch WhatsApp Webhook Async (UNA SOLA VEZ POR TODO EL LOTE YA FINALIZADO)
      if (createdAnalysisId) {
        try {
          const fullUser = await this.entityManager.findOne(UserOrmEntity, { where: { id: userId } });
          if (fullUser && fullUser.phoneCountry && fullUser.phoneNumber) {
            const fieldRecord = await this.entityManager.findOne(FieldCampaignOrmEntity, {
              where: { id: fieldCampaignId }, relations: ['field']
            });
            const frontUrl = process.env.ORIGIN_URL || 'http://localhost:3000';

            let msg = `🔬 *PlagaCode AI Analysis*\nLote Analizado: ${fieldRecord?.field?.name || 'Desconocido'}\n\n`;
            msg += `*Resumen General:*\n${interpretation.generalSummary}\n\n`;
            msg += `*Puedes ver más detalles en:*\n${frontUrl}/scan-history/${createdAnalysisId}`;

            this.notificationService.notifyWhatsapp(
              fullUser.phoneCountry,
              fullUser.phoneNumber,
              msg
            ).catch((err) => this.logger.error("Async Whatsapp error", err.message));
          }
        } catch (err) {
          this.logger.error("Error disparando Webhook Wazend post-guardado", err);
        }
      }

    } catch (dbErr) {
      this.logger.error(`Error guardando transaccional: ${dbErr}`);
      throw new BadRequestException(
        'Fallo al guardar análisis en Base de Datos: ' + dbErr.message,
      );
    }

    return { results, interpretation };
  }
}
