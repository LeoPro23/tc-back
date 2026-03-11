import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnalysisCommentService } from '../application/analysis-comment.service';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';

@Controller('analysis-comments')
export class AnalysisCommentController {
  constructor(
    private readonly analysisCommentService: AnalysisCommentService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post(':analysisId')
  @UseInterceptors(FileInterceptor('audio'))
  async addComment(
    @Request() req,
    @Param('analysisId') analysisId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo de audio es requerido');
    }

    const userId = req.user.userId;

    // Disparamos el proceso asíncrono y no esperamos a que termine
    this.analysisCommentService.processCommentAsync(
      userId,
      analysisId,
      file,
    ).catch(err => {
      // Un logger atrapará el error dentro del servicio, pero por seguridad general lo cacheamos aquí también
      console.error('Excepción no controlada procesando comentario asíncrono:', err);
    });

    return {
      message: 'Comentario recibido, procesando en segundo plano. Recibirá los resultados en WhatsApp.',
    };
  }
}
