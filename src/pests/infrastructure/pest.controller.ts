import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnalyzePestUseCase } from '../application/analyze-pest.use-case';

@Controller('pests')
export class PestController {
    constructor(private readonly analyzePestUseCase: AnalyzePestUseCase) { }

    @Post('analyze')
    @UseInterceptors(FileInterceptor('file'))
    async analyze(@UploadedFile() file: Express.Multer.File) {
        return this.analyzePestUseCase.execute(file.buffer, file.originalname);
    }
}
