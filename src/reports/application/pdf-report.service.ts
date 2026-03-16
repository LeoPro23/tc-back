import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface PdfReportData {
    reportId: string;
    date: string;
    operatorName: string;
    operatorEmail: string;
    fieldName: string;
    isInfected: boolean;
    primaryTargetPest: string | null;
    maxConfidence: number | null;
    bugDensity: number;
    generalSummary: string | null;
    generalRecommendation: string | null;
    recommendedProduct: string | null;
    operativeGuide: string | null;
    biosecurityProtocol: string | null;
    phenologicalState: string | null;
    soilQuality: string | null;
    currentClimate: string | null;
    images: Array<{
        filename: string;
        detections: Array<{
            pest: string;
            confidence: number;
            model: string;
        }>;
        imageRecommendation: string | null;
        recommendedProduct: string | null;
        biosecurityProtocol: string | null;
    }>;
}

@Injectable()
export class PdfReportService {
    private readonly logger = new Logger(PdfReportService.name);

    async generateReport(data: PdfReportData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50,
                    info: {
                        Title: `PlagaCode - Reporte Fitosanitario ${data.reportId}`,
                        Author: 'PlagaCode AI',
                        Subject: 'Reporte de Análisis Fitosanitario',
                    },
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.buildDocument(doc, data);

                doc.end();
            } catch (error) {
                this.logger.error('Error generando PDF:', error);
                reject(error);
            }
        });
    }

    private buildDocument(doc: any, data: PdfReportData): void {
        const green = '#00994D';
        const red = '#CC0033';
        const dark = '#1a1a1a';
        const gray = '#666666';
        const lightGray = '#999999';

        // ── Header ──
        doc.rect(0, 0, doc.page.width, 100).fill(dark);

        doc.fontSize(24).font('Helvetica-Bold').fillColor('#ffffff')
            .text('PLAGACODE', 50, 30, { continued: true })
            .fillColor(green).text(' AI', { continued: false });

        doc.fontSize(8).fillColor('#cccccc').font('Helvetica')
            .text('Reporte Integral de Análisis Fitosanitario', 50, 60);

        doc.fontSize(8).fillColor('#cccccc')
            .text(`ID: ${data.reportId}`, 400, 35, { align: 'right' })
            .text(data.date, 400, 50, { align: 'right' });

        // Status badge
        const statusText = data.isInfected ? 'INFECCIÓN DETECTADA' : 'CULTIVO SALUDABLE';
        const statusColor = data.isInfected ? red : green;
        doc.roundedRect(400, 65, 145, 18, 3).fill(statusColor);
        doc.fontSize(7).fillColor('#ffffff').font('Helvetica-Bold')
            .text(statusText, 400, 70, { width: 145, align: 'center' });

        let y = 120;

        // ── Información General ──
        y = this.drawSectionTitle(doc, 'INFORMACIÓN GENERAL', y, green);

        doc.fontSize(9).font('Helvetica-Bold').fillColor(dark)
            .text('Operador:', 50, y);
        doc.font('Helvetica').fillColor(gray)
            .text(`${data.operatorName} (${data.operatorEmail})`, 130, y);
        y += 18;

        doc.fontSize(9).font('Helvetica-Bold').fillColor(dark)
            .text('Lote:', 50, y);
        doc.font('Helvetica').fillColor(gray)
            .text(data.fieldName, 130, y);
        y += 25;

        // ── Métricas Clave ──
        y = this.drawSectionTitle(doc, 'MÉTRICAS DEL ANÁLISIS', y, green);
        y = this.drawMetricsRow(doc, y, [
            { label: 'Plaga Principal', value: data.primaryTargetPest || 'Ninguna', color: data.isInfected ? red : green },
            { label: 'Confianza Máx.', value: data.maxConfidence ? `${(data.maxConfidence * 100).toFixed(1)}%` : 'N/A', color: dark },
            { label: 'Detecciones', value: String(data.bugDensity), color: data.bugDensity > 0 ? red : green },
            { label: 'Imágenes', value: String(data.images.length), color: dark },
        ]);
        y += 10;

        // ── Contexto Agronómico ──
        if (data.phenologicalState || data.soilQuality || data.currentClimate) {
            y = this.checkPageBreak(doc, y, 80);
            y = this.drawSectionTitle(doc, 'CONTEXTO AGRONÓMICO', y, green);

            if (data.phenologicalState) {
                y = this.drawKeyValue(doc, y, 'Estado Fenológico', data.phenologicalState);
            }
            if (data.soilQuality) {
                y = this.drawKeyValue(doc, y, 'Calidad del Suelo', data.soilQuality);
            }
            if (data.currentClimate) {
                y = this.drawKeyValue(doc, y, 'Clima Actual', data.currentClimate);
            }
            y += 10;
        }

        // ── Diagnóstico General ──
        if (data.generalSummary) {
            y = this.checkPageBreak(doc, y, 120);
            y = this.drawSectionTitle(doc, 'DIAGNÓSTICO GENERAL DEL LOTE', y, green);

            doc.roundedRect(50, y, doc.page.width - 100, 2, 1).fill(green);
            y += 8;

            doc.fontSize(9).font('Helvetica').fillColor(dark);
            const summaryHeight = doc.heightOfString(data.generalSummary, {
                width: doc.page.width - 120,
            });
            doc.text(data.generalSummary, 60, y, { width: doc.page.width - 120 });
            y += summaryHeight + 15;
        }

        // ── Recomendación General ──
        if (data.generalRecommendation) {
            y = this.checkPageBreak(doc, y, 80);
            y = this.drawSectionTitle(doc, 'RECOMENDACIÓN GENERAL', y, green);
            y = this.drawWrappedText(doc, y, data.generalRecommendation);
        }

        // ── Prescripción Agronómica ──
        y = this.checkPageBreak(doc, y, 100);
        y = this.drawSectionTitle(doc, 'PRESCRIPCIÓN AGRONÓMICA PRINCIPAL', y, green);

        if (data.recommendedProduct) {
            y = this.drawKeyValue(doc, y, 'Producto Recomendado', data.recommendedProduct);
        }
        if (data.operativeGuide) {
            y = this.drawKeyValue(doc, y, 'Guía Operativa', data.operativeGuide);
        }
        y += 5;

        // ── Protocolo de Bioseguridad ──
        if (data.biosecurityProtocol) {
            y = this.checkPageBreak(doc, y, 80);
            y = this.drawSectionTitle(doc, 'PROTOCOLO DE BIOSEGURIDAD', y, red);

            doc.roundedRect(50, y, doc.page.width - 100, 2, 1).fill(red);
            y += 8;

            doc.fontSize(9).font('Helvetica-Oblique').fillColor(dark);
            const bsHeight = doc.heightOfString(data.biosecurityProtocol, {
                width: doc.page.width - 120,
            });
            doc.text(data.biosecurityProtocol, 60, y, { width: doc.page.width - 120 });
            y += bsHeight + 15;
        }

        // ── Diagnóstico por Imagen ──
        if (data.images.length > 0) {
            y = this.checkPageBreak(doc, y, 60);
            y = this.drawSectionTitle(doc, 'DIAGNÓSTICO POR IMAGEN', y, green);

            for (const img of data.images) {
                y = this.checkPageBreak(doc, y, 70);

                doc.roundedRect(50, y, doc.page.width - 100, 0.5, 0).fill('#e0e0e0');
                y += 6;

                doc.fontSize(8).font('Helvetica-Bold').fillColor(dark)
                    .text(img.filename, 55, y);
                y += 14;

                if (img.detections.length > 0) {
                    for (const det of img.detections) {
                        doc.fontSize(8).font('Helvetica').fillColor(gray);
                        doc.text(`• ${det.pest} — ${(det.confidence * 100).toFixed(1)}% (${det.model})`, 65, y);
                        y += 12;
                    }
                } else {
                    doc.fontSize(8).font('Helvetica').fillColor(green)
                        .text('Sin plagas detectadas', 65, y);
                    y += 12;
                }

                if (img.imageRecommendation) {
                    doc.fontSize(8).font('Helvetica-Oblique').fillColor(lightGray)
                        .text(`Recomendación: ${img.imageRecommendation}`, 65, y, {
                            width: doc.page.width - 140,
                        });
                    y += doc.heightOfString(`Recomendación: ${img.imageRecommendation}`, {
                        width: doc.page.width - 140,
                    }) + 4;
                }

                if (img.recommendedProduct) {
                    doc.fontSize(8).font('Helvetica').fillColor(lightGray)
                        .text(`Producto: ${img.recommendedProduct}`, 65, y);
                    y += 14;
                }

                y += 4;
            }
        }

        // ── Footer ──
        y = this.checkPageBreak(doc, y, 40);
        doc.roundedRect(50, y, doc.page.width - 100, 0.5, 0).fill('#e0e0e0');
        y += 12;

        doc.fontSize(7).font('Helvetica').fillColor(lightGray)
            .text('Generado por PlagaCode Core v4.3.0-LTS — Agricultura de Precisión AI', 50, y, {
                align: 'center',
                width: doc.page.width - 100,
            });
    }

    private drawSectionTitle(
        doc: any,
        title: string,
        y: number,
        color: string,
    ): number {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(color)
            .text(title, 50, y);
        return y + 20;
    }

    private drawKeyValue(
        doc: any,
        y: number,
        key: string,
        value: string,
    ): number {
        const dark = '#1a1a1a';
        const gray = '#666666';

        doc.fontSize(8).font('Helvetica-Bold').fillColor(dark)
            .text(`${key}:`, 60, y);

        const valY = y + 12;
        doc.fontSize(9).font('Helvetica').fillColor(gray);
        const valHeight = doc.heightOfString(value, { width: doc.page.width - 140 });
        doc.text(value, 70, valY, { width: doc.page.width - 140 });

        return valY + valHeight + 8;
    }

    private drawWrappedText(
        doc: any,
        y: number,
        text: string,
    ): number {
        doc.fontSize(9).font('Helvetica').fillColor('#1a1a1a');
        const h = doc.heightOfString(text, { width: doc.page.width - 120 });
        doc.text(text, 60, y, { width: doc.page.width - 120 });
        return y + h + 15;
    }

    private drawMetricsRow(
        doc: any,
        y: number,
        metrics: Array<{ label: string; value: string; color: string }>,
    ): number {
        const boxWidth = (doc.page.width - 100 - 15 * (metrics.length - 1)) / metrics.length;
        let x = 50;

        for (const metric of metrics) {
            doc.roundedRect(x, y, boxWidth, 45, 4).fill('#f5f5f5');

            doc.fontSize(7).font('Helvetica').fillColor('#999999')
                .text(metric.label, x + 8, y + 8, { width: boxWidth - 16 });

            doc.fontSize(12).font('Helvetica-Bold').fillColor(metric.color)
                .text(metric.value, x + 8, y + 22, { width: boxWidth - 16 });

            x += boxWidth + 15;
        }

        return y + 55;
    }

    private checkPageBreak(doc: any, y: number, needed: number): number {
        if (y + needed > doc.page.height - 60) {
            doc.addPage();
            return 50;
        }
        return y;
    }
}
