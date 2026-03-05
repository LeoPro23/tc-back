import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import sharp from 'sharp';

export interface ImageVerificationDecision {
    isValid: boolean;
    reason: string;
}

@Injectable()
export class ImageVerificationService {
    private readonly logger = new Logger(ImageVerificationService.name);
    private readonly openRouterApiKey = process.env.OPENROUTER_API_KEY ?? '';
    private readonly openRouterBaseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
    private readonly openRouterModel = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.0-flash-lite-001';
    private openRouterClient: OpenAI | null = null;

    // Umbrales de calidad de imagen
    private readonly MIN_BRIGHTNESS = 15;   // Muy oscura
    private readonly MAX_BRIGHTNESS = 240;  // Sobreexpuesta
    private readonly MAX_SATURATION = 220;  // Hipersaturada

    async verifyImage(imageBuffer: Buffer, mimeType: string): Promise<ImageVerificationDecision> {
        if (!mimeType?.startsWith('image/')) {
            return {
                isValid: false,
                reason: `Tipo MIME no soportado: ${mimeType || 'desconocido'}`,
            };
        }

        // Pre-validación de calidad de imagen (brillo y saturación)
        const qualityCheck = await this.checkImageQuality(imageBuffer);
        if (!qualityCheck.isValid) {
            return qualityCheck;
        }

        if (!this.openRouterApiKey) {
            throw new InternalServerErrorException('OPENROUTER_API_KEY is not configured');
        }

        const dataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        const client = this.getOpenRouterClient();

        try {
            const response = await client.chat.completions.create({
                model: this.openRouterModel,
                temperature: 0,
                max_tokens: 120,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content:
                            // VALIDACIÓN DE NEGOCIO Y DOMINIO: a) Etiqueta de Clase (Contexto)
                            // La imagen debe contener evidencia visual compatible con inspección (hoja, tallo, fruto).
                            // Si el pre-clasificador neuronal descarta el contexto, se rechaza y no se ejecuta la detección YOLO.
                            'Eres un verificador agrícola de imágenes. Decide si la imagen es apta para análisis de plagas. ' +
                            'Acepta únicamente hojas/plantas/trampas o escenas de inspección, incluyendo ' +
                            'textura de hoja en primer plano, galerías serpenteantes/minas, mosca blanca, minadores y plagas similares. ' +
                            'Rechaza objetos no relacionados como muebles, personas, autos, mascotas, electrónicos, edificios, etc. ' +
                            'Responde SOLO JSON estricto: {"is_valid": boolean, "reason": string}. ' +
                            'El campo "reason" debe estar en español.',
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text:
                                    '¿Esta imagen es apta para análisis de plagas? ' +
                                    'Devuelve JSON estricto con claves is_valid y reason (en español).',
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: dataUri,
                                },
                            },
                        ] as any,
                    },
                ],
            });

            const rawContent = response.choices?.[0]?.message?.content;
            return this.parseDecision(rawContent);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`OpenRouter verification request failed: ${message}`);
            throw new InternalServerErrorException('Failed to verify image with OpenRouter');
        }
    }

    /**
     * Pre-validación de calidad de imagen.
     * Analiza brillo (luminancia) y saturación promedio mediante estadísticas de canal HSL.
     * Rechaza imágenes extremadamente oscuras, sobreexpuestas o hipersaturadas.
     */
    private async checkImageQuality(imageBuffer: Buffer): Promise<ImageVerificationDecision> {
        try {
            // Redimensionar a tamaño pequeño para cálculo rápido de estadísticas
            const { data, info } = await sharp(imageBuffer)
                .resize(64, 64, { fit: 'cover' })
                .raw()
                .toBuffer({ resolveWithObject: true });

            const pixelCount = info.width * info.height;
            const channels = info.channels; // 3 (RGB) o 4 (RGBA)
            let totalBrightness = 0;
            let totalSaturation = 0;

            for (let i = 0; i < pixelCount; i++) {
                const offset = i * channels;
                const r = data[offset] / 255;
                const g = data[offset + 1] / 255;
                const b = data[offset + 2] / 255;

                // Luminancia percibida (ITU-R BT.601)
                const brightness = (0.299 * r + 0.587 * g + 0.114 * b) * 255;
                totalBrightness += brightness;

                // Saturación HSL
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const l = (max + min) / 2;
                let saturation = 0;
                if (max !== min) {
                    saturation = l > 0.5
                        ? (max - min) / (2 - max - min)
                        : (max - min) / (max + min);
                }
                totalSaturation += saturation * 255;
            }

            const avgBrightness = totalBrightness / pixelCount;
            const avgSaturation = totalSaturation / pixelCount;

            this.logger.debug(`Calidad de imagen - Brillo: ${avgBrightness.toFixed(1)}, Saturación: ${avgSaturation.toFixed(1)}`);

            if (avgBrightness < this.MIN_BRIGHTNESS) {
                return {
                    isValid: false,
                    reason: `Imagen extremadamente oscura (brillo promedio: ${avgBrightness.toFixed(0)}/255). Imposible distinguir texturas o patógenos. Capture la imagen con mejor iluminación.`,
                };
            }

            if (avgBrightness > this.MAX_BRIGHTNESS) {
                return {
                    isValid: false,
                    reason: `Imagen sobreexpuesta o quemada (brillo promedio: ${avgBrightness.toFixed(0)}/255). Los detalles del tejido vegetal se pierden. Reduzca la exposición o evite luz directa.`,
                };
            }

            if (avgSaturation > this.MAX_SATURATION) {
                return {
                    isValid: false,
                    reason: `Imagen con saturación extrema (saturación promedio: ${avgSaturation.toFixed(0)}/255). Los colores distorsionados impiden una detección fiable. Use la cámara sin filtros de color.`,
                };
            }

            return { isValid: true, reason: 'Calidad de imagen aceptable' };
        } catch (error) {
            this.logger.warn(`No se pudo analizar calidad de imagen: ${error.message}. Continuando con verificación LLM.`);
            return { isValid: true, reason: 'No se pudo verificar calidad, se acepta por defecto' };
        }
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
            throw new InternalServerErrorException('OPENROUTER_BASE_URL is not configured');
        }

        if (baseUrl.startsWith('sk-or-v1-')) {
            throw new InternalServerErrorException(
                'OPENROUTER_BASE_URL is misconfigured. Expected https://openrouter.ai/api/v1',
            );
        }

        let parsed: URL;
        try {
            parsed = new URL(baseUrl);
        } catch {
            throw new InternalServerErrorException(
                'OPENROUTER_BASE_URL is invalid. Expected https://openrouter.ai/api/v1',
            );
        }

        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new InternalServerErrorException('OPENROUTER_BASE_URL must use http or https');
        }

        return baseUrl.replace(/\/$/, '');
    }

    private parseDecision(rawContent: unknown): ImageVerificationDecision {
        if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
            throw new InternalServerErrorException('Empty verification response from OpenRouter');
        }

        const content = rawContent.trim();
        const jsonCandidate = content.startsWith('{')
            ? content
            : content.match(/\{[\s\S]*\}/)?.[0];

        if (!jsonCandidate) {
            throw new InternalServerErrorException('Invalid verification format from OpenRouter');
        }

        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
        } catch {
            throw new InternalServerErrorException('Failed to parse OpenRouter verification JSON');
        }

        const isValid = this.parseBoolean(parsed.is_valid ?? parsed.isValid ?? parsed.valid);
        const reason = typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
            ? parsed.reason.trim()
            : (isValid ? 'imagen aprobada para análisis de plagas' : 'imagen rechazada por no corresponder al dominio');

        return {
            isValid,
            reason,
        };
    }

    private parseBoolean(value: unknown): boolean {
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', 'yes', 'si', 'sí', 'valid', 'relevant', '1'].includes(normalized)) {
                return true;
            }
            if (['false', 'no', 'invalid', 'irrelevant', '0'].includes(normalized)) {
                return false;
            }
        }

        throw new InternalServerErrorException('Invalid boolean value in verification response');
    }
}
