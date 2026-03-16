import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// ── ORM Entities ──────────────────────────────────────────────
import { UserOrmEntity } from './auth/infrastructure/user.orm-entity';
import { UserSessionOrmEntity } from './auth/infrastructure/user-session.orm-entity';
import { CampaignOrmEntity } from './campaigns/infrastructure/campaign.orm-entity';
import { FieldOrmEntity } from './fields/infrastructure/field.orm-entity';
import { FieldCampaignOrmEntity } from './field-campaigns/infrastructure/field-campaign.orm-entity';
import { AnalysisFieldCampaignOrmEntity } from './analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { AttachedImageOrmEntity } from './attached-images/infrastructure/attached-image.orm-entity';
import { ModelOrmEntity } from './models/infrastructure/model.orm-entity';
import { ModelResultOrmEntity } from './model-results/infrastructure/model-result.orm-entity';
import { AnalysisCommentOrmEntity } from './analysis-comments/infrastructure/analysis-comment.orm-entity';

dotenv.config();

// ── CONFIGURACIÓN ─────────────────────────────────────────────
const TARGET_USER_ID = 'e730f6df-a5d4-4ae4-9c00-b392509ec08f';
const MAX_ANALYSES   = 100; // Límite total de registros de análisis

// ── DataSource (standalone, misma config que database.module.ts) ─
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [
    UserOrmEntity,
    UserSessionOrmEntity,
    CampaignOrmEntity,
    FieldOrmEntity,
    FieldCampaignOrmEntity,
    AnalysisFieldCampaignOrmEntity,
    AttachedImageOrmEntity,
    ModelOrmEntity,
    ModelResultOrmEntity,
    AnalysisCommentOrmEntity,
  ],
  synchronize: false,
});

// ── Helpers ───────────────────────────────────────────────────
const PESTS = ['tuta_absoluta', 'minador', 'mosca_blanca'];

const PHENOLOGICAL_STATES = [
  'Germinación', 'Desarrollo Vegetativo', 'Floración',
  'Cuajado de Fruto', 'Fructificación', 'Maduración',
];

const SOIL_QUALITIES = [
  'Humedad Óptima 60%', 'Suelo Seco 30%', 'Saturado 85%',
  'Franco-Arcilloso pH 6.5', 'Franco-Arenoso pH 7.0',
];

const CLIMATES = [
  'Soleado 32°C', 'Parcialmente Nublado 25°C', 'Lluvioso 18°C',
  'Nublado 22°C', 'Viento Moderado 28°C',
];

const PRODUCTS = [
  'Acaricida Abamectina 1.8%', 'Insecticida Imidacloprid',
  'BioControl Beauveria Bassiana', 'Extracto de Neem',
  'Deltametrina 2.5 EC', 'Spinosad 480 SC',
];

// Nombres reales de los archivos .pt en ml-service/models/
const YOLO_MODEL_NAMES = [
  'yolov8m_v2_best',
  'yolov8m_v2_last',
  'yolo26n',
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);
const randFloat = (min: number, max: number) => +(Math.random() * (max - min) + min).toFixed(4);
const coin = (chance = 0.5) => Math.random() < chance;

// ══════════════════════════════════════════════════════════════
//  MAIN SEED
// ══════════════════════════════════════════════════════════════
async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Conexión a PostgreSQL establecida.\n');

  const userRepo     = AppDataSource.getRepository(UserOrmEntity);
  const campaignRepo = AppDataSource.getRepository(CampaignOrmEntity);
  const fieldRepo    = AppDataSource.getRepository(FieldOrmEntity);
  const fcRepo       = AppDataSource.getRepository(FieldCampaignOrmEntity);
  const analysisRepo = AppDataSource.getRepository(AnalysisFieldCampaignOrmEntity);
  const imageRepo    = AppDataSource.getRepository(AttachedImageOrmEntity);
  const modelRepo    = AppDataSource.getRepository(ModelOrmEntity);
  const resultRepo   = AppDataSource.getRepository(ModelResultOrmEntity);
  const commentRepo  = AppDataSource.getRepository(AnalysisCommentOrmEntity);

  try {
    // ─── 1. VERIFICAR USUARIO ────────────────────────────────
    const masterUser = await userRepo.findOne({ where: { id: TARGET_USER_ID } });
    if (!masterUser) {
      console.error(`❌ No se encontró el usuario con ID: ${TARGET_USER_ID}`);
      return;
    }
    console.log(`👨‍🌾 Usuario: ${masterUser.name} (${masterUser.email})\n`);

    // ─── 2. MODELOS DE IA (YOLO) ─────────────────────────────
    const modelsInDb: ModelOrmEntity[] = [];
    for (const modelName of YOLO_MODEL_NAMES) {
      let model = await modelRepo.findOne({ where: { name: modelName } });
      if (!model) {
        model = modelRepo.create({ name: modelName });
        model = await modelRepo.save(model);
        console.log(`   🆕 Modelo IA creado: ${modelName}`);
      }
      modelsInDb.push(model);
    }
    console.log(`🤖 Modelos IA: ${modelsInDb.map(m => m.name).join(', ')}\n`);

    // ─── 3. LOTES (FIELDS) ───────────────────────────────────
    const fieldDefs = [
      { name: 'Lote Norte - Alpha', location: '-12.046374, -77.042793', irrigationType: 'Goteo' },
      { name: 'Lote Sur - Beta',    location: '-12.048201, -77.044511', irrigationType: 'Aspersión' },
      { name: 'Invernadero Central', location: '-12.047100, -77.043200', irrigationType: 'Goteo' },
      { name: 'Lote Este - Delta',  location: '-12.045800, -77.041900', irrigationType: 'Gravedad' },
    ];

    const fields: FieldOrmEntity[] = [];
    for (const fd of fieldDefs) {
      let field = await fieldRepo.findOne({ where: { name: fd.name, userId: masterUser.id } });
      if (!field) {
        field = fieldRepo.create({
          name: fd.name,
          location: fd.location,
          irrigationType: fd.irrigationType,
          userId: masterUser.id,
        });
        field = await fieldRepo.save(field);
        console.log(`   🆕 Lote creado: ${fd.name}`);
      }
      fields.push(field);
    }
    console.log(`🌱 Lotes: ${fields.length}\n`);

    // ─── 4. CAMPAÑAS ─────────────────────────────────────────
    const campaignDefs = [
      { start: '2024-02-01', end: '2024-07-31', active: false, label: '2024-S1' },
      { start: '2025-03-01', end: '2025-08-31', active: false, label: '2025-S1' },
      { start: '2026-01-15', end: '2026-06-30', active: true,  label: '2026 (Activa)' },
    ];

    const campaigns: CampaignOrmEntity[] = [];
    for (const cd of campaignDefs) {
      const campaign = campaignRepo.create({
        startDate: new Date(cd.start),
        endDate: new Date(cd.end),
        isActive: cd.active,
        userId: masterUser.id,
      });
      const saved = await campaignRepo.save(campaign);
      campaigns.push(saved);
      console.log(`   📅 Campaña ${cd.label} → ${saved.id.substring(0, 8)}`);

      // Vincular lotes
      for (const field of fields) {
        const fc = fcRepo.create({ campaign: saved, field });
        await fcRepo.save(fc);
      }
    }
    console.log(`📅 Campañas: ${campaigns.length}\n`);

    // ─── 5. ANÁLISIS MASIVOS (máx ~100) ──────────────────────
    let totalAnalyses  = 0;
    let totalImages    = 0;
    let totalResults   = 0;
    let totalComments  = 0;

    // Distribuir ~100 análisis entre 3 campañas × 4 lotes = 12 series
    // ~8 análisis por serie (8 × 12 = 96 ≈ 100)
    const ANALYSES_PER_SERIES = 8;

    for (const campaign of campaigns) {
      if (totalAnalyses >= MAX_ANALYSES) break;

      const fieldCampaigns = await fcRepo.find({
        where: { campaign: { id: campaign.id } },
        relations: ['field'],
      });

      console.log(`── Campaña ${campaign.id.substring(0, 8)} (${campaign.isActive ? 'ACTIVA' : 'Histórica'}) ──`);

      for (const fc of fieldCampaigns) {
        if (totalAnalyses >= MAX_ANALYSES) break;

        // --- Estado de Simulación por Lote ---
        // Inicializamos densidades para cada plaga en este lote específico
        const lotState: Record<string, number> = {
          'tuta_absoluta': randFloat(0, 2),
          'mosca_blanca': randFloat(0, 2),
          'minador': randFloat(0, 2)
        };
        let lastTreatedPest: string | null = null;
        let treatmentCountdown = 0;

        // Distribuir los ~8 análisis a lo largo de 20 semanas
        const totalWeeks = 20;
        const weekStep = totalWeeks / ANALYSES_PER_SERIES;

        for (let i = 0; i < ANALYSES_PER_SERIES; i++) {
          if (totalAnalyses >= MAX_ANALYSES) break;

          const w = i * weekStep + randFloat(-0.5, 0.5); // con jitter decimal
          const analysisDate = new Date(campaign.startDate);
          analysisDate.setDate(analysisDate.getDate() + Math.round(w * 7));

          if (analysisDate > new Date()) continue;

          // 1. Evolución Biológica de las plagas en el lote
          PESTS.forEach(p => {
            if (lastTreatedPest === p && treatmentCountdown > 0) {
              // Efecto del veneno: reducción drástica (70-90%)
              lotState[p] *= randFloat(0.1, 0.3);
            } else {
              // Crecimiento natural (más agresivo para ver números más altos)
              const growthFactor = lotState[p] > 1 ? randFloat(1.3, 2.0) : randFloat(0.8, 3.0);
              lotState[p] *= growthFactor;
            }
            // Ruido ambiental (brotes aleatorios más fuertes)
            if (coin(0.15)) lotState[p] += randInt(5, 12);
            
            // Cap al máximo razonable para la gráfica (0 a 25+)
            if (lotState[p] > 35) lotState[p] = randFloat(25, 35);
          });

          if (treatmentCountdown > 0) treatmentCountdown--;

          // 2. Determinar plaga predominante hoy
          const sortedPests = [...PESTS].sort((a, b) => lotState[b] - lotState[a]);
          const activePest = sortedPests[0];
          const bugDensity = Math.floor(lotState[activePest]);
          
          const infected = bugDensity > 2; // Umbral de detección visual
          const product = infected && bugDensity > 10 ? pick(PRODUCTS) : null;

          if (product) {
            lastTreatedPest = activePest;
            treatmentCountdown = 2; // El veneno dura ~2 análisis
          }

          const maxConf = infected ? randFloat(0.72, 0.98) : null;
          const phenoIdx = Math.min(Math.floor(w / 4), PHENOLOGICAL_STATES.length - 1);

          // ── Análisis Maestro ──
          const analysis = analysisRepo.create({
            fieldCampaign: fc,
            date: analysisDate,
            generalSummary: infected
              ? `Se detectó alta presión de ${activePest} (${bugDensity} focos). ${treatmentCountdown > 0 ? 'La población está bajando tras aplicación.' : 'Se observa expansión activa.'}`
              : 'Lote estable. Presión de plagas por debajo del umbral económico.',
            generalRecommendation: product
              ? `Aplicación urgente de ${product}. Se recomienda rotar ingrediente activo en 15 días.`
              : 'Continuar monitoreo preventivo bi-semanal.',
            recommendedProduct: product,
            operativeGuide: product
              ? '1. Calibrar boquillas. 2. Presión constante 40psi. 3. Mojado total. 4. Uso de coadyuvante.'
              : null,
            biosecurityProtocol: product
              ? 'Nivel de protección 3: traje impermeable, máscara doble filtro.'
              : null,
            phenologicalState: PHENOLOGICAL_STATES[phenoIdx],
            soilQuality: pick(SOIL_QUALITIES),
            currentClimate: pick(CLIMATES),
            isInfected: infected,
            primaryTargetPest: activePest,
            maxConfidence: maxConf,
            bugDensity: bugDensity,
          });
          const savedAnalysis = await analysisRepo.save(analysis);
          totalAnalyses++;

          // ── 1 Imagen por análisis ──
          const img = imageRepo.create({
            analysis: savedAnalysis,
            url: `https://storage.techcrop.demo/analysis/${savedAnalysis.id}/photo.jpg`,
            fileName: `cam_${fc.field.name.replace(/\s/g, '_')}_w${w}.jpg`,
            height: 1080,
            width: 1920,
            imageRecommendation: infected
              ? `Presencia de ${activePest} en densidad ${bugDensity > 5 ? 'alta' : 'baja'} sobre hoja.`
              : null,
            recommendedProduct: product,
          });
          const savedImg = await imageRepo.save(img);
          totalImages++;

          // ── 3 Modelos YOLO procesan la imagen ──
          // En producción, cada modelo genera 1 ModelResult POR DETECCIÓN individual
          // diagnosis = className (etiqueta cruda: tuta_absoluta, minador, mosca_blanca)
          // boundingBox = [x1, y1, x2, y2] (array plano de 4 coordenadas)
          for (const model of modelsInDb) {
            const isOldModel = model.name.includes('yolo26');
            const isLastModel = model.name.includes('last');

            // Número de detecciones que este modelo encontraría
            const detections = infected ? randInt(1, Math.min(bugDensity, 5)) : 0;

            for (let d = 0; d < detections; d++) {
              // Simular diferencias de precisión entre modelos
              let confidence: number;
              const base = randFloat(0.72, 0.97);
              if (isOldModel) confidence = Math.max(0.3, base - randFloat(0.1, 0.2));
              else if (isLastModel) confidence = Math.max(0.4, base - randFloat(0.02, 0.08));
              else confidence = base; // best = mejor

              // Plaga detectada = la misma que primaryTargetPest del análisis padre
              const detectedPest = activePest!;

              // boundingBox = [x1, y1, x2, y2] (formato real del ML service)
              const x1 = randFloat(50, 800);
              const y1 = randFloat(50, 500);
              const box = [x1, y1, x1 + randFloat(40, 200), y1 + randFloat(40, 150)];

              const modelResult = resultRepo.create({
                model,
                image: savedImg,
                diagnosis: detectedPest,   // etiqueta cruda, igual que det.className
                confidence: +confidence.toFixed(4),
                boundingBox: box,           // [x1, y1, x2, y2] formato real
              });
              await resultRepo.save(modelResult);
              totalResults++;
            }
          }

          // ── Comentario de voz (25%) ──
          if (coin(0.25)) {
            const comment = commentRepo.create({
              analysisFieldCampaign: savedAnalysis,
              audioUrl: `https://storage.techcrop.demo/audio/${savedAnalysis.id}/voice.webm`,
              transcription: infected
                ? `Observo ${activePest} en hojas nuevas. Densidad ${bugDensity > 10 ? 'alta, intervención urgente' : 'moderada, monitorear en 3 días'}.`
                : 'Lote sano, sin signos visibles de plagas.',
              diagnosis: infected ? `${activePest} nivel ${bugDensity > 10 ? 'severo' : 'leve-moderado'}` : 'Sin hallazgos',
              treatment: infected ? `Aplicar ${product} según ficha técnica.` : null,
            });
            await commentRepo.save(comment);
            totalComments++;
          }
        }
        process.stdout.write(`   ✔ ${fc.field.name} → ${totalAnalyses} análisis acumulados\n`);
      }
    }

    // ── Resumen ──
    console.log('\n══════════════════════════════════════════');
    console.log('🎉 SEEDING COMPLETADO');
    console.log('══════════════════════════════════════════');
    console.log(`   👨‍🌾 Usuario:       ${masterUser.name} (${TARGET_USER_ID.substring(0, 8)})`);
    console.log(`   📅 Campañas:      ${campaigns.length}`);
    console.log(`   🌱 Lotes:         ${fields.length}`);
    console.log(`   🤖 Modelos IA:    ${modelsInDb.length}`);
    console.log(`   🧬 Análisis:      ${totalAnalyses}`);
    console.log(`   📸 Imágenes:      ${totalImages}`);
    console.log(`   🎯 Model Results: ${totalResults} (${totalImages} imgs × ${modelsInDb.length} modelos)`);
    console.log(`   🎙️  Comentarios:   ${totalComments}`);
    console.log('══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
  } finally {
    await AppDataSource.destroy();
    console.log('🔌 Conexión cerrada.');
  }
}

seed();
