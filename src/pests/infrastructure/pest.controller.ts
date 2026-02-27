import { BadRequestException, Controller, Post, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';

@Controller('pests')
export class PestController {
    constructor(private readonly analyzePestUseCase: AnalyzePestUseCase) { }

    @Post('analyze')
    @UseInterceptors(FileInterceptor('file'))
    async analyze(@UploadedFile() file: Express.Multer.File) {
        if (!file || !file.mimetype?.startsWith('image/')) {
            throw new BadRequestException('Se requiere un archivo de imagen válido');
        }

        return this.analyzePestUseCase.execute(file.buffer, file.originalname, file.mimetype);
    }

    @Post('analyze/batch')
    @UseInterceptors(FilesInterceptor('files'))
    async analyzeBatch(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Se requiere al menos una imagen');
        }

        const images = files.map((file) => ({
            buffer: file.buffer,
            filename: file.originalname,
            mimeType: file.mimetype,
        }));

        return this.analyzePestUseCase.executeBatch(images);
    }
}
