import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import OpenAI from 'openai';
import { MinioService } from '../../storage/infrastructure/minio.service';
import { NotificationService } from '../../notifications/application/notification.service';
import { AnalysisFieldCampaignOrmEntity } from '../../analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { AnalysisCommentOrmEntity } from '../infrastructure/analysis-comment.orm-entity';
import { UserOrmEntity } from '../../auth/infrastructure/user.orm-entity';

@Injectable()
export class AnalysisCommentService {
  private readonly logger = new Logger(AnalysisCommentService.name);
  private openRouterClient: OpenAI | null = null;
  private readonly openRouterApiKey = process.env.OPENROUTER_API_KEY ?? '';
  private readonly openRouterBaseUrl =
    process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
  private readonly audioToTextModel =
    process.env.OPENROUTER_AUDIOTOTEXT_MODEL ?? 'google/gemini-1.5-flash';
  // Reutilizamos el modelo de interpretación para el diagnóstico (o el conversacional rápido)
  private readonly interpretationModel =
    process.env.OPENROUTER_INTERPRETATION_MODEL ?? 'openai/gpt-4o-mini';

  constructor(
    private readonly entityManager: EntityManager,
    private readonly minioService: MinioService,
    private readonly notificationService: NotificationService,
  ) {}

  async processCommentAsync(
    userId: string,
    analysisId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    try {
      this.logger.log(`Procesando comentario asíncrono para análisis ${analysisId}...`);

      // 1. Validar que el análisis existe y pertenece al usuario
      const analysis = await this.entityManager.findOne(AnalysisFieldCampaignOrmEntity, {
        where: { id: analysisId },
        relations: ['fieldCampaign', 'fieldCampaign.campaign', 'fieldCampaign.campaign.user'],
      });

      if (!analysis) {
        throw new BadRequestException('Análisis no encontrado');
      }

      if (analysis.fieldCampaign.campaign.user.id !== userId) {
        throw new BadRequestException('El análisis no pertenece a este usuario');
      }

      // 2. Subir el audio a MinIO
      const uploaded = await this.minioService.uploadImage(
        file.buffer,
        file.originalname || 'audio_comment.webm',
        file.mimetype || 'audio/webm',
      );
      const audioUrl = uploaded.url;

      // 3. Transcribir Audio (STT) enviándolo en Base64
      const audioBase64 = file.buffer.toString('base64');
      const transcription = await this.transcribeAudio(audioBase64, file.mimetype || 'audio/webm');

      // 4. Generar Diagnóstico y Tratamiento usando el LLM
      const generalSummary = analysis.generalSummary || 'Sin resumen previo';
      const { diagnosis, treatment } = await this.generateDiagnosisAndTreatment(
        transcription,
        generalSummary,
      );

      // 5. Guardar Entidad referenciando al análisis
      const comment = this.entityManager.create(AnalysisCommentOrmEntity, {
        analysisFieldCampaign: analysis,
        audioUrl,
        transcription,
        diagnosis,
        treatment,
      });

      await this.entityManager.save(comment);
      this.logger.log(`Comentario guardado exitosamente para análisis ${analysisId}. Audio URL: ${audioUrl}`);

      // 6. Notificar por WhatsApp
      const user = await this.entityManager.findOne(UserOrmEntity, {
        where: { id: userId },
      });

      if (user && user.phoneCountry && user.phoneNumber) {
        const msg = `🔬 *Re-evaluación médica completada*\n\n` +
          `*Su comentario:* "${transcription}"\n\n` +
          `*Diagnóstico IA:* ${diagnosis}\n\n` +
          `*Tratamiento IA sugerido:* ${treatment}`;

        await this.notificationService.notifyWhatsapp(
          user.phoneCountry,
          user.phoneNumber,
          msg,
        ).catch(err => {
            this.logger.error(`Error enviando WhatsApp del comentario: ${err.message}`);
        });
      }
    } catch (error) {
      this.logger.error(`Error procesando comentario asincrónico: ${error.message}`, error.stack);
    }
  }

  private getOpenRouterClient(): OpenAI {
    if (this.openRouterClient) return this.openRouterClient;
    this.openRouterClient = new OpenAI({
      apiKey: this.openRouterApiKey,
      baseURL: this.openRouterBaseUrl,
    });
    return this.openRouterClient;
  }

  private async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    if (!this.openRouterApiKey) {
      this.logger.warn('No hay OPENROUTER_API_KEY. Ignorando transcripción real.');
      return "Transcripción de prueba activada por falta de credenciales.";
    }

    try {
      // Usamos el formato Data URI que OpenRouter decodifica
      const audioDataUri = `data:${mimeType};base64,${audioBase64}`;
      const client = this.getOpenRouterClient();
      
      const response = await client.chat.completions.create({
        model: this.audioToTextModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe el siguiente audio exactamente como se escucha. Solo responde con la transcripción directa del audio sin notas ni acotaciones.',
              },
              {
                type: 'image_url', // Compatibilidad soportada en Openrouter para Base64 Multi Modal
                image_url: {
                  url: audioDataUri,
                },
              },
            ] as any, // Hacemos cast a any porque las librerías pueden no tener audio tipado aún
          },
        ],
      });

      const transcription = response.choices[0]?.message?.content?.trim();
      return transcription || 'No se logró transcribir el audio.';
    } catch (e) {
      this.logger.error('Excepción al transcribir el audio con OpenRouter:', e.message);
      return `(Error en transcripción multimodelo: ${e.message})`;
    }
  }

  private async generateDiagnosisAndTreatment(
    transcription: string,
    generalSummary: string,
  ): Promise<{ diagnosis: string; treatment: string }> {
    if (!this.openRouterApiKey) {
      return {
        diagnosis: "Posible enfermedad criptogámica detectada.",
        treatment: "Se recomienda aplicar fungicida sistémico genérico.",
      };
    }

    try {
      const client = this.getOpenRouterClient();
      const response = await client.chat.completions.create({
        model: this.interpretationModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres un fitopatólogo experto. El agricultor enviará la transcripción de su nota de voz (sus comentarios visuales de la plaga o cultivo) y el Resumen Inicial del análisis.\n' +
              'Tu tarea es dar un nuevo diagnóstico y tratamiento complementario a la luz de esta nueva información humana.\n' +
              'Debes responder SÓLO con un JSON estricto con este esquema exacto:\n' +
              '{\n' +
              '  "diagnosis": "string",\n' +
              '  "treatment": "string"\n' +
              '}\n' +
              'El texto debe ser claro, resolutivo y fácil de aplicar por un agricultor. NO devuelvas texto fuera del JSON.',
          },
          {
            role: 'user',
            content: `Comentario/Transcripción del agricultor: "${transcription}"\n\nResumen Inicial del análisis: "${generalSummary}"\n\nGenera el JSON final.`,
          },
        ],
      });

      const raw = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      return {
        diagnosis: parsed.diagnosis || 'Revisión en sitio requerida.',
        treatment: parsed.treatment || 'Consulte al técnico de la zona con urgencia.',
      };
    } catch (e) {
      this.logger.error('Fallo la generación del diagnóstico y tratamiento:', e.message);
      return {
        diagnosis: "Error en IA al diagnosticar",
        treatment: "N/A",
      };
    }
  }
}
