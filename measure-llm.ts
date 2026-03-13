import { config } from 'dotenv';
config();

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { AnalysisInterpretationService } from './src/pests/application/analysis-interpretation.service';
import { ImageVerificationService } from './src/pests/application/image-verification.service';
import { PestAnalysisResult } from './src/pests/domain/pest.entity';
import { FastApiPestRepositoryImpl } from './src/pests/infrastructure/fastapi-pest.repository.impl';

type AgronomicContext = {
  phenologicalState: string | null;
  soilQuality: string | null;
  currentClimate: string | null;
};

type LoadedImage = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

type ParsedArgs = {
  imagePaths: string[];
  agronomicContext: AgronomicContext;
  showHelp: boolean;
};

type ImageMeasurement = {
  filename: string;
  verificationMs: number;
  mlMs: number | null;
  reachedMlService: boolean;
  verifiedByGuard: boolean;
  verifiedByMl: boolean | null;
  detections: number;
  reason: string | null;
};

const DEFAULT_CONTEXT: AgronomicContext = {
  phenologicalState: 'Desarrollo vegetativo / Pre-floracion',
  soilQuality: 'Franco arenoso, buen drenaje',
  currentClimate: 'Temperaturas elevadas (28C - 32C), clima seco',
};

function printUsage() {
  console.log('Uso: npx ts-node measure-llm.ts [opciones] <imagen1> <imagen2> ...');
  console.log('');
  console.log('Opciones:');
  console.log('  --fenologia <texto>   Estado fenologico del lote');
  console.log('  --suelo <texto>       Descripcion del suelo');
  console.log('  --clima <texto>       Descripcion del clima');
  console.log('  --help, -h            Muestra esta ayuda');
  console.log('');
  console.log('Ejemplo:');
  console.log(
    '  npx ts-node measure-llm.ts --fenologia "Floracion" "C:\\imagenes\\hoja-1.jpg" "C:\\imagenes\\hoja-2.png"',
  );
}

function parseArgs(argv: string[]): ParsedArgs {
  const agronomicContext: AgronomicContext = { ...DEFAULT_CONTEXT };
  const imagePaths: string[] = [];

  const requireValue = (flag: string, value: string | undefined): string => {
    if (!value || value.startsWith('--')) {
      throw new Error(`La opcion ${flag} requiere un valor.`);
    }

    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      return { imagePaths: [], agronomicContext, showHelp: true };
    }

    if (arg === '--fenologia') {
      agronomicContext.phenologicalState = requireValue(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--suelo') {
      agronomicContext.soilQuality = requireValue(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--clima') {
      agronomicContext.currentClimate = requireValue(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    imagePaths.push(path.resolve(arg));
  }

  return {
    imagePaths,
    agronomicContext,
    showHelp: false,
  };
}

function inferMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    default:
      throw new Error(
        `No se pudo inferir el MIME type para "${filePath}". Usa jpg, jpeg, png, webp, gif o bmp.`,
      );
  }
}

async function loadImages(imagePaths: string[]): Promise<LoadedImage[]> {
  return Promise.all(
    imagePaths.map(async (imagePath) => ({
      filename: path.basename(imagePath),
      mimeType: inferMimeType(imagePath),
      buffer: await readFile(imagePath),
    })),
  );
}

function roundMs(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(2));
}

async function main() {
  const { imagePaths, agronomicContext, showHelp } = parseArgs(
    process.argv.slice(2),
  );

  if (showHelp) {
    printUsage();
    return;
  }

  if (imagePaths.length === 0) {
    printUsage();
    throw new Error('Debes indicar al menos una imagen real para medir el flujo.');
  }

  console.log('Inicializando medicion real de /analysis/ ...');
  console.log(`- Imagenes recibidas: ${imagePaths.length}`);
  console.log(
    `- OPENROUTER_API_KEY configurada: ${process.env.OPENROUTER_API_KEY ? 'si' : 'no'}`,
  );
  console.log(
    `- ML_SERVICE_URL: ${process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8001'}`,
  );
  console.log('- Contexto agronomico:', agronomicContext);

  const images = await loadImages(imagePaths);
  const imageVerificationService = new ImageVerificationService();
  const pestRepository = new FastApiPestRepositoryImpl();
  const interpretationService = new AnalysisInterpretationService();

  const results: PestAnalysisResult[] = [];
  const measurements: ImageMeasurement[] = [];

  let verificationTotalMs = 0;
  let mlTotalMs = 0;
  let firstMlRequestStartedAt: number | null = null;

  const batchStartedAt = performance.now();

  for (const image of images) {
    console.log(`\nProcesando ${image.filename}...`);

    const verificationStartedAt = performance.now();
    const decision = await imageVerificationService.verifyImage(
      image.buffer,
      image.mimeType,
    );
    const verificationMs = performance.now() - verificationStartedAt;
    verificationTotalMs += verificationMs;

    if (!decision.isValid) {
      results.push(
        new PestAnalysisResult(image.filename, [], [], false, decision.reason),
      );
      measurements.push({
        filename: image.filename,
        verificationMs,
        mlMs: null,
        reachedMlService: false,
        verifiedByGuard: false,
        verifiedByMl: null,
        detections: 0,
        reason: decision.reason,
      });

      console.log(
        `- Rechazada antes de /predict (${roundMs(verificationMs)} ms): ${decision.reason}`,
      );
      continue;
    }

    const mlStartedAt = performance.now();
    if (firstMlRequestStartedAt === null) {
      firstMlRequestStartedAt = mlStartedAt;
    }

    const result = await pestRepository.analyzeImage(
      image.buffer,
      image.filename,
    );
    const mlMs = performance.now() - mlStartedAt;
    mlTotalMs += mlMs;
    results.push(result);

    measurements.push({
      filename: image.filename,
      verificationMs,
      mlMs,
      reachedMlService: true,
      verifiedByGuard: true,
      verifiedByMl: result.verified,
      detections: result.detections.length,
      reason: result.verificationReason,
    });

    console.log(`- Verificacion previa: ${roundMs(verificationMs)} ms`);
    console.log(`- ML /predict: ${roundMs(mlMs)} ms`);
    console.log(
      `- Resultado ML: verified=${result.verified} detections=${result.detections.length}`,
    );
  }

  const llmStartedAt = performance.now();
  const interpretation = await interpretationService.interpretBatch(
    results,
    agronomicContext,
  );
  const llmFinishedAt = performance.now();
  const llmMs = llmFinishedAt - llmStartedAt;

  const batchStartToRecommendationsMs = llmFinishedAt - batchStartedAt;
  const firstMlRequestToRecommendationsMs =
    firstMlRequestStartedAt === null
      ? null
      : llmFinishedAt - firstMlRequestStartedAt;

  console.log('\n======================================================');
  console.log('MEDICION DE TIEMPOS');
  console.log('======================================================');
  console.log(
    `Tiempo total lote -> recomendaciones: ${roundMs(batchStartToRecommendationsMs)} ms`,
  );
  console.log(
    `Tiempo acumulado verificacion: ${roundMs(verificationTotalMs)} ms`,
  );
  console.log(`Tiempo acumulado ML (/predict): ${roundMs(mlTotalMs)} ms`);
  console.log(`Tiempo LLM (interpretBatch): ${roundMs(llmMs)} ms`);

  if (firstMlRequestToRecommendationsMs === null) {
    console.log(
      'Tiempo desde la primera llamada a ML hasta recomendaciones: no aplica (ninguna imagen llego a /predict).',
    );
  } else {
    // Esta es la ventana exacta pedida: desde el primer envio al ML hasta que vuelve el LLM.
    console.log(
      `Tiempo primer /predict -> recomendaciones LLM: ${roundMs(firstMlRequestToRecommendationsMs)} ms`,
    );
  }

  console.log('\nDetalle por imagen:');
  console.table(
    measurements.map((measurement) => ({
      archivo: measurement.filename,
      verificacionMs: roundMs(measurement.verificationMs),
      mlMs: roundMs(measurement.mlMs),
      llegaAlMl: measurement.reachedMlService ? 'si' : 'no',
      pasaGuardia: measurement.verifiedByGuard ? 'si' : 'no',
      verifiedMl:
        measurement.verifiedByMl === null
          ? 'n/a'
          : measurement.verifiedByMl
            ? 'si'
            : 'no',
      detecciones: measurement.detections,
      motivo: measurement.reason ?? '',
    })),
  );

  console.log('\nResumen generado:\n', interpretation.generalSummary);
  console.log('\nRecomendacion general:\n', interpretation.generalRecommendation);
  console.log(
    '\nProtocolo de bioseguridad:\n',
    interpretation.generalBiosecurityProtocol,
  );

  const firstImageInterpretation = interpretation.perImage[0];
  if (firstImageInterpretation) {
    console.log('\nPrimer analisis por imagen:');
    console.log(' - Archivo:', firstImageInterpretation.filename);
    console.log(' - Plaga objetivo:', firstImageInterpretation.targetPest);
    console.log(
      ' - Recomendacion imagen:',
      firstImageInterpretation.imageRecommendation,
    );
    console.log(' - Producto:', firstImageInterpretation.recipe.product);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('\nFallo la medicion:', message);
  process.exitCode = 1;
});
