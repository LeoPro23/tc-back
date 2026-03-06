import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Req,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';

@Controller('pests')
export class PestController {
  constructor(private readonly analyzePestUseCase: AnalyzePestUseCase) { }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file'))
  async analyze(@UploadedFile() file: Express.Multer.File) {
    if (!file || !file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Se requiere un archivo de imagen válido');
    }

    return this.analyzePestUseCase.execute(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  // PASO 3 (BACKEND CONTROLLER): Puerta de entrada segura de la petición
  // Este controlador está protegido por JwtAuthGuard que verifica el Token.
  // Se usa FilesInterceptor para atrapar los archivos binarios (imágenes) del multipart.
  @UseGuards(JwtAuthGuard)
  @Post('analyze/batch')
  @UseInterceptors(FilesInterceptor('files'))
  async analyzeBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('fieldCampaignId') fieldCampaignId: string,
    @Body('phenologicalState') phenologicalState: string,
    @Body('soilQuality') soilQuality: string,
    @Body('currentClimate') currentClimate: string,
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Se requiere al menos una imagen');
    }

    const images = files.map((file) => ({
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
    }));

    const userId = req.user?.userId || req.user?.sub;
    if (!userId) {
      throw new BadRequestException(
        'Usuario no identificado o sin sesion activa',
      );
    }
    if (!fieldCampaignId) {
      throw new BadRequestException(
        'Se requiere el ID de inscripción de Campo en la Campaña (fieldCampaignId)',
      );
    }

    const agronomicContext = {
      phenologicalState: phenologicalState || null,
      soilQuality: soilQuality || null,
      currentClimate: currentClimate || null,
    };

    // PASO 4 (BACKEND CONTROLLER): Delegación al Caso de Uso
    // Una vez validados superficialmente los parámetros (validando IDs y formatos básicos),
    // el controlador envía todo en crudo a la lógica de negocio profunda en AnalyzePestUseCase.
    return this.analyzePestUseCase.executeBatch(
      images,
      userId,
      fieldCampaignId,
      agronomicContext,
    );
  }
}
