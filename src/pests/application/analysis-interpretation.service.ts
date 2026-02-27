import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
    AgronomicRecommendation,
    BatchInterpretation,
    PerImageInterpretation,
    PestAnalysisResult,
} from '../domain/pest.entity';

interface RawPerImageInterpretation {
    filename?: unknown;
    target_pest?: unknown;
    targetPest?: unknown;
    recipe?: {
        product?: unknown;
        dose?: unknown;
        method?: unknown;
    };
    biosecurity?: {
        status?: unknown;
        protocol?: unknown;
    };
}

@Injectable()
export class AnalysisInterpretationService {
    private readonly logger = new Logger(AnalysisInterpretationService.name);
    private readonly openRouterApiKey = process.env.OPENROUTER_API_KEY ?? '';
    private readonly openRouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    private readonly openRouterInterpretationModel =
        process.env.OPENROUTER_INTERPRETATION_MODEL ?? 'openai/gpt-4o-mini';
    private openRouterClient: OpenAI | null = null;

    async interpretBatch(results: PestAnalysisResult[]): Promise<BatchInterpretation> {
        if (results.length === 0) {
            return {
                generalSummary: 'No se recibieron imágenes para interpretar.',
                perImage: [],
            };
        }

        if (!this.openRouterApiKey) {
            this.logger.warn(
                'OPENROUTER_API_KEY is not configured. Falling back to deterministic interpretation.',
            );
            return this.buildFallbackInterpretation(results);
        }

        try {
            const response = await this.getOpenRouterClient().chat.completions.create({
                model: this.openRouterInterpretationModel,
                temperature: 0.2,
                max_tokens: 1200,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content:
                            'Eres un agrónomo especializado en plagas de tomate. ' +
                            'Recibirás resultados estructurados de detección (ya procesados) y debes devolver ' +
                            'una interpretación ejecutiva para UI de monitoreo agrícola. ' +
                            'Responde SOLO JSON estricto con este esquema exacto:\n' +
                            '{\n' +
                            '  "general_summary": string,\n' +
                            '  "per_image": [\n' +
                            '    {\n' +
                            '      "filename": string,\n' +
                            '      "target_pest": string,\n' +
                            '      "recipe": { "product": string, "dose": string, "method": string },\n' +
                            '      "biosecurity": { "status": string, "protocol": string }\n' +
                            '    }\n' +
                            '  ]\n' +
                            '}\n' +
                            'El texto debe estar en español técnico claro. ' +
                            'Si la imagen está rechazada por verificación, usa estado RECHAZADA y receta no aplicable.',
                    },
                    {
                        role: 'user',
                        content:
                            'Interpreta este lote para interfaz agrícola:\n' +
                            JSON.stringify(this.toPromptPayload(results)),
                    },
                ],
            });

            const rawContent = response.choices?.[0]?.message?.content;
            const parsed = this.parseRawResponse(rawContent);
            return this.mergeWithFallback(parsed, results);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`OpenRouter interpretation request failed: ${message}`);
            return this.buildFallbackInterpretation(results);
        }
    }

    private toPromptPayload(results: PestAnalysisResult[]) {
        return results.map((result) => ({
            filename: result.filename,
            verified: result.verified,
            verificationReason: result.verificationReason,
            models: result.models,
            detections: result.detections.map((detection) => ({
                pest: detection.className,
                confidencePercent:
                    detection.confidence <= 1
                        ? Math.round(detection.confidence * 100)
                        : Math.round(detection.confidence),
                model: detection.model,
            })),
        }));
    }

    private mergeWithFallback(
        parsed: { generalSummary: string; perImage: RawPerImageInterpretation[] },
        results: PestAnalysisResult[],
    ): BatchInterpretation {
        const fallback = this.buildFallbackInterpretation(results);
        const perImageByFilename = new Map<string, RawPerImageInterpretation>();

        parsed.perImage.forEach((item) => {
            const key = this.normalizeFilename(item.filename);
            if (key) {
                perImageByFilename.set(key, item);
            }
        });

        const mergedPerImage = results.map((result, index) => {
            const base = fallback.perImage[index];
            const byFilename = perImageByFilename.get(this.normalizeFilename(result.filename) ?? '');
            const byIndex = parsed.perImage[index];
            const candidate = byFilename ?? byIndex;

            if (!candidate) {
                return base;
            }

            return {
                filename: result.filename,
                targetPest: this.asText(candidate.target_pest ?? candidate.targetPest, base.targetPest),
                recipe: {
                    product: this.asText(candidate.recipe?.product, base.recipe.product),
                    dose: this.asText(candidate.recipe?.dose, base.recipe.dose),
                    method: this.asText(candidate.recipe?.method, base.recipe.method),
                },
                biosecurityStatus: this.normalizeStatus(
                    this.asText(candidate.biosecurity?.status, base.biosecurityStatus),
                ),
                biosecurityProtocol: this.asText(
                    candidate.biosecurity?.protocol,
                    base.biosecurityProtocol,
                ),
            } satisfies PerImageInterpretation;
        });

        return {
            generalSummary: this.asText(parsed.generalSummary, fallback.generalSummary),
            perImage: mergedPerImage,
        };
    }

    private parseRawResponse(rawContent: unknown): { generalSummary: string; perImage: RawPerImageInterpretation[] } {
        if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
            throw new Error('Empty interpretation response');
        }

        const content = rawContent.trim();
        const jsonCandidate = content.startsWith('{')
            ? content
            : content.match(/\{[\s\S]*\}/)?.[0];

        if (!jsonCandidate) {
            throw new Error('No JSON block found in interpretation response');
        }

        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
        } catch {
            throw new Error('Failed to parse interpretation JSON');
        }

        const generalSummary = this.asText(
            parsed.general_summary ?? parsed.generalSummary,
            'Se completó el análisis del lote.',
        );

        const perImageRaw = Array.isArray(parsed.per_image)
            ? (parsed.per_image as RawPerImageInterpretation[])
            : Array.isArray(parsed.perImage)
                ? (parsed.perImage as RawPerImageInterpretation[])
                : [];

        return {
            generalSummary,
            perImage: perImageRaw,
        };
    }

    private buildFallbackInterpretation(results: PestAnalysisResult[]): BatchInterpretation {
        const rejectedCount = results.filter((result) => !result.verified).length;
        const positiveCount = results.filter(
            (result) => result.verified && result.detections.length > 0,
        ).length;

        const generalSummary = rejectedCount > 0
            ? `Lote procesado: ${positiveCount} imágenes con hallazgos y ${rejectedCount} rechazadas por verificación.`
            : `Lote procesado: ${positiveCount} imágenes con hallazgos y ${
                results.length - positiveCount
            } sin detecciones de plaga.`;

        return {
            generalSummary,
            perImage: results.map((result) => this.buildFallbackPerImage(result)),
        };
    }

    private buildFallbackPerImage(result: PestAnalysisResult): PerImageInterpretation {
        if (!result.verified) {
            return {
                filename: result.filename,
                targetPest: 'No aplicable',
                recipe: {
                    product: 'No aplica',
                    dose: 'No aplica',
                    method:
                        result.verificationReason ??
                        'Imagen fuera del dominio de inspección agrícola para tomate.',
                },
                biosecurityStatus: 'RECHAZADA',
                biosecurityProtocol:
                    result.verificationReason ??
                    'Solicitar captura válida de hoja, planta o trampa relacionada con tomate.',
            };
        }

        if (result.detections.length === 0) {
            return {
                filename: result.filename,
                targetPest: 'Sin plaga detectada',
                recipe: {
                    product: 'Monitoreo preventivo',
                    dose: 'No aplica',
                    method: 'Mantener monitoreo semanal y continuar buenas prácticas agronómicas.',
                },
                biosecurityStatus: 'LIMPIO',
                biosecurityProtocol:
                    'No se requieren medidas correctivas inmediatas. Continuar vigilancia de rutina.',
            };
        }

        const topDetection = [...result.detections].sort(
            (left, right) => right.confidence - left.confidence,
        )[0];
        const confidencePercent = topDetection.confidence <= 1
            ? Math.round(topDetection.confidence * 100)
            : Math.round(topDetection.confidence);
        const riskStatus = confidencePercent >= 70 ? 'ALTA PRIORIDAD' : 'VIGILANCIA';

        return {
            filename: result.filename,
            targetPest: topDetection.className,
            recipe: {
                product: `Tratamiento focal para ${topDetection.className}`,
                dose: 'Aplicar según etiqueta técnica del producto seleccionado',
                method:
                    'Aplicación dirigida sobre focos detectados, reforzando monitoreo y saneamiento del cultivo.',
            },
            biosecurityStatus: riskStatus,
            biosecurityProtocol:
                'Aislar focos activos, retirar tejido comprometido y repetir inspección en 48-72 horas.',
        };
    }

    private getOpenRouterClient(): OpenAI {
        if (this.openRouterClient) {
            return this.openRouterClient;
        }

        this.openRouterClient = new OpenAI({
            apiKey: this.openRouterApiKey,
            baseURL: this.getValidatedBaseUrl(),
        });

        return this.openRouterClient;
    }

    private getValidatedBaseUrl(): string {
        const baseUrl = (this.openRouterBaseUrl ?? '').trim();
        if (!baseUrl) {
            throw new Error('OPENROUTER_BASE_URL is not configured');
        }

        if (baseUrl.startsWith('sk-or-v1-')) {
            throw new Error('OPENROUTER_BASE_URL is misconfigured');
        }

        const parsed = new URL(baseUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('OPENROUTER_BASE_URL must use http or https');
        }

        return baseUrl.replace(/\/$/, '');
    }

    private normalizeFilename(value: unknown): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.trim().toLowerCase();
        return normalized.length > 0 ? normalized : null;
    }

    private normalizeStatus(status: string): string {
        const normalized = status.trim().toUpperCase();
        if (normalized.length === 0) {
            return 'LIMPIO';
        }

        return normalized;
    }

    private asText(value: unknown, fallback: string): string {
        if (typeof value !== 'string') {
            return fallback;
        }

        const sanitized = value.trim();
        return sanitized.length > 0 ? sanitized : fallback;
    }
}
