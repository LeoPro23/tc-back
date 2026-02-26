import { BadRequestException, Controller, Post, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';

@Controller('pests')
export class PestController {
    constructor(private readonly analyzePestUseCase: AnalyzePestUseCase) { }

    @Post('analyze')
    @UseInterceptors(FileInterceptor('file'))
    async analyze(@UploadedFile() file: Express.Multer.File) {
        return this.analyzePestUseCase.execute(file.buffer, file.originalname);
    }

    @Post('analyze/batch')
    @UseInterceptors(FilesInterceptor('files'))
    async analyzeBatch(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one image file is required');
        }

        const images = files.map((file) => ({
            buffer: file.buffer,
            filename: file.originalname,
        }));

        const results = await this.analyzePestUseCase.executeBatch(images);
        return { results };
    }
}
