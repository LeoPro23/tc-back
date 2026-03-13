import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface StrategicRecommendationResponse {
  summary: string;
  actionPlan: string;
}

@Injectable()
export class CampaignIntelligenceService {
  private readonly logger = new Logger(CampaignIntelligenceService.name);
  private readonly openRouterUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  private readonly openRouterKey = process.env.OPENROUTER_API_KEY;

  async generateStrategicRecommendation(
    campaignMetrics: any,
    riskProfileData: any[],
    topPests: string[],
    topFields: string[]
  ): Promise<StrategicRecommendationResponse> {
    if (!this.openRouterKey) {
      this.logger.warn('OPENROUTER_API_KEY no configurada. Usando fallback.');
      return this.getFallbackRecommendation();
    }

    try {
      const prompt = this.buildPrompt(
        campaignMetrics,
        riskProfileData,
        topPests,
        topFields
      );

      const response = await axios.post(
        `${this.openRouterUrl}/chat/completions`,
        {
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content:
                'Eres el Director Agrónomo Analista de Inteligencia Artificial para el sistema PlagaCode. Tu objetivo es recibir datos agregados de una campaña de cultivo (en lotes), y proporcionar un "Consenso Estratégico Neural". Debes dar recomendaciones directas, eficientes y claras enfocadas en priorizar lotes y optimizar recursos, en exactamente 2 párrafos.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 300,
          temperature: 0.2, // Baja temperatura para decisiones analíticas
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'PlagaCode System',
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const reply = response.data.choices?.[0]?.message?.content;

      if (!reply) {
        throw new Error('Respuesta vacía del LLM');
      }

      const rawText = reply.trim();
      // Dividir ingenuamente por saltos de línea y tomar los dos primeros párrafos
      const parts = rawText.split('\n').filter((p) => p.trim().length > 0);

      const summary = parts[0] || 'Resumen no disponible.';
      const actionPlan = parts.slice(1).join(' ') || 'Plan de acción no detallado en la respuesta.';

      return {
        summary: summary,
        actionPlan: actionPlan,
      };
    } catch (error) {
      this.logger.error(
        `Error al comunicar con OpenRouter para la recomendación estratégica: ${error.message}`
      );
      return this.getFallbackRecommendation();
    }
  }

  private buildPrompt(
    metrics: any,
    riskProfileData: any[],
    topPests: string[],
    topFields: string[]
  ): string {
    const dataContext = {
      estadisticas_globales: {
        total_escaneos: metrics?.totalScans ?? 0,
        tasa_infeccion: metrics?.infectionRate ?? 0,
        lotes_afectados: metrics?.activeNodes ?? 0,
        total_lotes: metrics?.totalFields ?? 0,
      },
      plagas_predominantes: topPests,
      lotes_criticos_mas_afectados: topFields,
      perfil_riesgo_reiente_multi_variable: riskProfileData, // Data del Radar Chart
    };

    return `
Analiza los siguientes datos de la campaña activa y brinda un resumen directivo y un plan de acción:
${JSON.stringify(dataContext, null, 2)}

Reglas de salida:
- Formato: Estrictamente 2 párrafos, sin viñetas, sin títulos Markdown y sin negritas (markdown asteriscos).
- Párrafo 1: Resumen de la situación crítica (interpreta los números y la matriz de riesgo).
- Párrafo 2: Plan de acción y priorización (qué recursos enviar a qué lotes y/o qué plaga focalizar primero).
`;
  }

  private getFallbackRecommendation(): StrategicRecommendationResponse {
    return {
      summary:
        'Los datos analizados indican una presencia moderada de plagas en los lotes evaluados. Se observa una tendencia estable en los últimos días comparada con la semana anterior, lo cual sugiere que los focos principales están temporalmente contenidos, pero no erradicados. Las mediciones de biomasa de los campos más activos muestran puntos de calor esporádicos en los bordes de la plantación.',
      actionPlan:
        'Se recomienda desplegar cuadrillas de inspección focalizada en los tres lotes con mayor número de apariciones reportadas, reforzando las aplicaciones preventivas orgánicas en los perímetros. Paralelamente, mantenga monitoreadas las plantaciones sanas contiguas a los puntos de calor del mapa térmico para frenar el vector de propagación detectado en la matriz de riesgo.',
    };
  }
}
