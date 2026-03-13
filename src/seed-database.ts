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
const TARGET_USER_ID = '15de33f5-8b63-4211-a4dc-76cf35aa8583';
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

        // Distribuir los ~8 análisis uniformemente a lo largo de 20 semanas
        const weekStep = Math.floor(20 / ANALYSES_PER_SERIES); // cada ~2.5 semanas

        for (let i = 0; i < ANALYSES_PER_SERIES; i++) {
          if (totalAnalyses >= MAX_ANALYSES) break;

          const w = i * weekStep + randInt(0, 1); // semana relativa con jitter
          const analysisDate = new Date(campaign.startDate);
          analysisDate.setDate(analysisDate.getDate() + w * 7 + randInt(0, 4));

          if (analysisDate > new Date()) continue;

          // ── Curva Biológica ──
          let infectionChance: number;
          let bugDensity: number;

          if (w < 4) {
            infectionChance = 0.2;
            bugDensity = randInt(0, 2);
          } else if (w < 8) {
            infectionChance = 0.6;
            bugDensity = randInt(3, 8);
          } else if (w < 14) {
            infectionChance = 0.9;
            bugDensity = randInt(8, 20);
          } else {
            infectionChance = 0.25;
            bugDensity = randInt(0, 3);
          }

          const infected = coin(infectionChance) && bugDensity > 0;
          // CADA análisis detecta una plaga aleatoria (no fija por lote)
          // Esto genera datos variados en el radar multi-plaga
          const activePest = infected ? pick(PESTS) : null;
          const maxConf = infected ? randFloat(0.72, 0.98) : null;
          const phenoIdx = Math.min(Math.floor(w / 4), PHENOLOGICAL_STATES.length - 1);
          const product = infected ? pick(PRODUCTS) : null;

          // ── Análisis Maestro ──
          const analysis = analysisRepo.create({
            fieldCampaign: fc,
            date: analysisDate,
            generalSummary: infected
              ? `Se detectaron ${bugDensity} focos de ${activePest}. Severidad: ${bugDensity > 10 ? 'ALTA' : bugDensity > 4 ? 'MEDIA' : 'BAJA'}.`
              : 'Monitoreo sin hallazgos significativos. Lote saludable.',
            generalRecommendation: infected
              ? `Aplicar ${product} en dosis de choque. Repetir a los 7 días si la presión persiste.`
              : 'Mantener monitoreo semanal estándar.',
            recommendedProduct: product,
            operativeGuide: infected
              ? '1. Preparar mezcla 2ml/L. 2. Aplicar antes de las 9 AM. 3. Cubrir envés de hojas. 4. Reingreso 24h.'
              : null,
            biosecurityProtocol: infected
              ? 'EPP completo: máscara carbón activo, guantes nitrilo, lentes protección.'
              : null,
            phenologicalState: PHENOLOGICAL_STATES[phenoIdx],
            soilQuality: pick(SOIL_QUALITIES),
            currentClimate: pick(CLIMATES),
            isInfected: infected,
            primaryTargetPest: activePest,
            maxConfidence: maxConf,
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
