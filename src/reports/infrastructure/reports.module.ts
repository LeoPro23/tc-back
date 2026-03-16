import { Module } from '@nestjs/common';
import { PdfReportService } from '../application/pdf-report.service';
import { StorageModule } from '../../storage/infrastructure/storage.module';

@Module({
    imports: [StorageModule],
    providers: [PdfReportService],
    exports: [PdfReportService],
})
export class ReportsModule { }
