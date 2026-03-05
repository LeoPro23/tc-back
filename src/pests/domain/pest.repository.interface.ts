import { PestAnalysisResult } from './pest.entity';

export interface IPestRepository {
  analyzeImage(
    imageBuffer: Buffer,
    filename: string,
  ): Promise<PestAnalysisResult>;
}

export const IPestRepository = Symbol('IPestRepository');
