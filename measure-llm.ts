import { config } from 'dotenv';
config();

import { AnalysisInterpretationService } from './src/pests/application/analysis-interpretation.service';
import { PestAnalysisResult, PestDetection } from './src/pests/domain/pest.entity';

async function main() {
  console.log('Inicializando servicio de interpretación (Métricas Reales)...');
  const service = new AnalysisInterpretationService();
  
  // Caso de prueba con datos reales basados en el modelo YOLO actual del proyecto:
  // Clases reales soportadas: 'minador', 'mosca_blanca', 'tuta_absoluta'
  const detection1 = new PestDetection(
    [120, 150, 400, 450], // box realístico
    0.92,                 // confidence (92% de seguridad)
    'tuta_absoluta',      // className (Dato Real)
    2,                    // classId (Dato Real)
    'yolo26n'             // model (Dato Real)
  );

  const detection2 = new PestDetection(
    [50, 60, 100, 110],   // box realístico
    0.88,                 // confidence (88% de seguridad)
    'mosca_blanca',       // className (Dato Real)
    1,                    // classId (Dato Real)
    'yolo26n'             // model (Dato Real)
  );

  const result1 = new PestAnalysisResult(
    'evidencia_campo_lote_A_1.jpg', // filename
    [detection1, detection2],       // detections multiples en 1 hoja
    ['yolo26n'],                    // models
    true,                           // verified
    null                            // verificationReason
  );

  const mockResults = [result1];

  // Contexto agronómico general para tomates
  const agronomicContext = {
    phenologicalState: 'Desarrollo vegetativo / Pre-floración',
    soilQuality: 'Franco arenoso, buen drenaje',
    currentClimate: 'Temperaturas elevadas (28°C - 32°C), clima seco'
  };

  console.log('Enviando datos reales de "Tuta absoluta" y "Mosca blanca" para medir la latencia del LLM...');
  const startTime = Date.now();
  
  try {
    const interpretation = await service.interpretBatch(mockResults, agronomicContext);
    const endTime = Date.now();
    const latencyMs = endTime - startTime;
    
    console.log('\n======================================================');
    console.log(`⏱️ TIEMPO DE RESPUESTA DEL LLM: ${latencyMs} ms (${(latencyMs / 1000).toFixed(2)} segundos)`);
    console.log('======================================================\n');
    
    console.log('▶ Resumen generado:\n', interpretation.generalSummary);
    console.log('\n▶ Recomendación general:\n', interpretation.generalRecommendation);
    console.log('\n▶ Protocolo de Bioseguridad:\n', interpretation.generalBiosecurityProtocol);
    
    console.log('\n▶ Análisis particular por imagen (1):');
    console.log(' - Plaga Objetivo:', interpretation.perImage[0].targetPest);
    console.log(' - Recomendación Imagen:', interpretation.perImage[0].imageRecommendation);
    console.log(' - Receta (Producto):', interpretation.perImage[0].recipe.product);

  } catch (error) {
    console.error('Error durante la llamada al LLM:', error);
  }
}

main();
