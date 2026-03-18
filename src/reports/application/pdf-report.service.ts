import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import sharp = require('sharp');

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
        buffer?: Buffer;
        detections: Array<{
            pest: string;
            confidence: number;
            model: string;
            box?: number[];
        }>;
        imageRecommendation: string | null;
        recommendedProduct: string | null;
        biosecurityProtocol: string | null;
    }>;
}

// ── Color palette (dark cyber theme) ─────────────────────────────────────────
const C = {
    bg:          '#0a0a0a',
    surface:     '#111111',
    surfaceAlt:  '#161616',
    border:      '#1e1e1e',
    green:       '#00ff9d',
    greenDim:    '#00994D',
    red:         '#ff003c',
    redDim:      '#991224',
    orange:      '#f97316',
    blue:        '#60a5fa',
    white:       '#ffffff',
    textPrimary: '#f0f0f0',
    textMuted:   '#888888',
    textFaint:   '#444444',
};

@Injectable()
export class PdfReportService {
    private readonly logger = new Logger(PdfReportService.name);

    async generateReport(data: PdfReportData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 0,
                    info: {
                        Title: `PlagaCode — Reporte Fitosanitario ${data.reportId}`,
                        Author: 'PlagaCode AI',
                        Subject: 'Reporte de Análisis Fitosanitario',
                    },
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.buildDocument(doc, data)
                  .then(() => doc.end())
                  .catch(err => {
                      this.logger.error('Error en buildDocument', err);
                      reject(err);
                  });
            } catch (error) {
                this.logger.error('Error generando PDF:', error);
                reject(error);
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Fills the whole page background */
    private fillBackground(doc: any): void {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);

        // Subtle grid lines
        doc.opacity(0.04);
        const gridSize = 30;
        for (let x = 0; x < doc.page.width; x += gridSize) {
            doc.moveTo(x, 0).lineTo(x, doc.page.height).stroke(C.green);
        }
        for (let y = 0; y < doc.page.height; y += gridSize) {
            doc.moveTo(0, y).lineTo(doc.page.width, y).stroke(C.green);
        }
        doc.opacity(1);
    }

    /** Checks remaining page space and adds a new page if needed */
    private checkPageBreak(doc: any, y: number, needed: number): number {
        if (y + needed > doc.page.height - 70) {
            doc.addPage();
            this.fillBackground(doc);
            return 50;
        }
        return y;
    }

    /** Section header with left-side color bar */
    private drawSection(doc: any, title: string, y: number, color = C.green): number {
        doc.save();
        // Accent bar
        doc.rect(48, y, 3, 14).fill(color);
        // Title text
        doc.fontSize(7).font('Helvetica-Bold').fillColor(color)
            .text(title.toUpperCase(), 58, y + 2, { characterSpacing: 1.5 });
        doc.restore();
        return y + 22;
    }

    /** Rounded card background */
    private drawCard(doc: any, x: number, y: number, w: number, h: number, color = C.surface): void {
        doc.roundedRect(x, y, w, h, 6).fill(color);
        doc.roundedRect(x, y, w, h, 6).stroke(C.border).lineWidth(0.5);
    }

    /** KPI mini-card */
    private drawKPI(
        doc: any, x: number, y: number, w: number,
        label: string, value: string, valueColor: string
    ): void {
        this.drawCard(doc, x, y, w, 48, C.surface);
        doc.fontSize(6).font('Helvetica').fillColor(C.textFaint)
            .text(label.toUpperCase(), x + 10, y + 10, { width: w - 20, characterSpacing: 0.5 });
        doc.fontSize(14).font('Helvetica-Bold').fillColor(valueColor)
            .text(value, x + 10, y + 22, { width: w - 20 });
    }

    /** Text field with label above */
    private drawField(doc: any, x: number, y: number, w: number, label: string, value: string): number {
        doc.fontSize(6).font('Helvetica').fillColor(C.textFaint)
            .text(label.toUpperCase(), x, y, { characterSpacing: 0.5 });
        y += 10;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.textPrimary)
            .text(value, x, y, { width: w });
        return y + doc.heightOfString(value, { width: w }) + 10;
    }

    /** Wrapped paragraph */
    private drawParagraph(doc: any, x: number, y: number, w: number, text: string, color = C.textPrimary): number {
        doc.fontSize(8).font('Helvetica').fillColor(color);
        const h = doc.heightOfString(text, { width: w });
        doc.text(text, x, y, { width: w });
        return y + h + 8;
    }

    // ── Main builder ──────────────────────────────────────────────────────────

    private async buildDocument(doc: any, data: PdfReportData): Promise<void> {
        const W = doc.page.width;
        const pad = 48;
        const innerW = W - pad * 2;

        this.fillBackground(doc);

        // ══ HEADER ══════════════════════════════════════════════════════════
        // Header bar
        doc.rect(0, 0, W, 90).fill(C.surface);
        doc.rect(0, 90, W, 1).fill(C.border);

        // Corner accent top-left
        doc.rect(pad, 12, 24, 2).fill(C.green);
        doc.rect(pad, 12, 2, 24).fill(C.green);
        // Corner accent top-right
        doc.rect(W - pad - 24, 12, 24, 2).fill(C.green);
        doc.rect(W - pad - 2, 12, 2, 24).fill(C.green);

        // Logo text
        doc.fontSize(26).font('Helvetica-Bold').fillColor(C.white)
            .text('PLAGA', pad + 8, 24, { continued: true })
            .fillColor(C.green).text('CODE');

        doc.fontSize(7).font('Helvetica').fillColor(C.green)
            .text('Reporte Integral de Análisis Fitosanitario', pad + 8, 55, { characterSpacing: 1 });

        // Status badge (right side)
        const badgeColor = data.isInfected ? C.red : C.green;
        const badgeText = data.isInfected ? 'INFECCION DETECTADA' : 'CULTIVO SALUDABLE';
        doc.roundedRect(W - pad - 130, 18, 130, 18, 4)
            .fillAndStroke(data.isInfected ? '#200010' : '#001a0d', badgeColor);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(badgeColor)
            .text(badgeText, W - pad - 130, 24, { width: 130, align: 'center' });

        // Report ID & Date
        doc.fontSize(6.5).font('Helvetica').fillColor(C.textFaint)
            .text(`ID: ${data.reportId}`, W - pad - 130, 44, { width: 130, align: 'right' })
            .text(data.date, W - pad - 130, 54, { width: 130, align: 'right' });

        let y = 108;

        // ══ STATUS BAR (operator + field) ═══════════════════════════════════
        this.drawCard(doc, pad, y, innerW, 36, C.surfaceAlt);

        const colW = innerW / 3;
        // Operator
        doc.fontSize(6).font('Helvetica').fillColor(C.textFaint)
            .text('OPERADOR', pad + 12, y + 8, { characterSpacing: 0.5 });
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.textPrimary)
            .text(`${data.operatorName}`, pad + 12, y + 18);
        doc.fontSize(6.5).font('Helvetica').fillColor(C.textMuted)
            .text(data.operatorEmail, pad + 12, y + 28);
        // Field
        doc.fontSize(6).font('Helvetica').fillColor(C.textFaint)
            .text('LOTE / CAMPO', pad + colW, y + 8, { characterSpacing: 0.5 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.textPrimary)
            .text(data.fieldName, pad + colW, y + 18);
        // Status
        doc.fontSize(6).font('Helvetica').fillColor(C.textFaint)
            .text('ESTADO BIOSEGURIDAD', pad + colW * 2, y + 8, { characterSpacing: 0.5 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(badgeColor)
            .text(badgeText, pad + colW * 2, y + 18);

        y += 50;

        // ══ KPI METRICS ══════════════════════════════════════════════════════
        const kpiW = (innerW - 12) / 4;
        const metrics = [
            { label: 'Plaga Principal', value: data.primaryTargetPest || 'NINGUNA', color: data.isInfected ? C.red : C.green },
            { label: 'Confianza Max', value: data.maxConfidence ? `${(data.maxConfidence * 100).toFixed(1)}%` : 'N/A', color: C.textPrimary },
            { label: 'Detecciones', value: String(data.bugDensity), color: data.bugDensity > 0 ? C.red : C.green },
            { label: 'Imagenes', value: String(data.images.length), color: C.blue },
        ];
        metrics.forEach((m, i) => {
            this.drawKPI(doc, pad + i * (kpiW + 4), y, kpiW, m.label, m.value, m.color);
        });
        y += 62;

        // ══ CONTEXTO AGRONÓMICO ══════════════════════════════════════════════
        if (data.phenologicalState || data.soilQuality || data.currentClimate) {
            y = this.checkPageBreak(doc, y, 90);
            y = this.drawSection(doc, 'Contexto Agronómico del Lote', y);

            this.drawCard(doc, pad, y, innerW, 54, C.surfaceAlt);
            let cx = pad + 12;
            const cw = (innerW - 36) / 3;

            if (data.phenologicalState) {
                doc.fontSize(6).font('Helvetica').fillColor('#34d399').text('ESTADO FENOLOGICO', cx, y + 8, { characterSpacing: 0.5 });
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.textPrimary).text(data.phenologicalState, cx, y + 18, { width: cw });
                cx += cw + 12;
            }
            if (data.soilQuality) {
                doc.fontSize(6).font('Helvetica').fillColor('#fbbf24').text('CALIDAD DEL SUELO', cx, y + 8, { characterSpacing: 0.5 });
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.textPrimary).text(data.soilQuality, cx, y + 18, { width: cw });
                cx += cw + 12;
            }
            if (data.currentClimate) {
                doc.fontSize(6).font('Helvetica').fillColor('#60a5fa').text('CLIMA ACTUAL', cx, y + 8, { characterSpacing: 0.5 });
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.textPrimary).text(data.currentClimate, cx, y + 18, { width: cw });
            }
            y += 68;
        }

        // ══ DIAGNÓSTICO GENERAL ══════════════════════════════════════════════
        if (data.generalSummary) {
            y = this.checkPageBreak(doc, y, 100);
            y = this.drawSection(doc, 'Diagnóstico General del Lote', y);

            const sumH = doc.heightOfString(data.generalSummary, { width: innerW - 24 });
            this.drawCard(doc, pad, y, innerW, sumH + 24, '#0d1a0f');
            doc.rect(pad, y, 2, sumH + 24).fill(C.green);
            doc.fontSize(8.5).font('Helvetica').fillColor(C.textPrimary)
                .text(data.generalSummary, pad + 14, y + 12, { width: innerW - 24 });
            y += sumH + 36;
        }

        // ══ RECOMENDACIÓN GENERAL ═════════════════════════════════════════════
        if (data.generalRecommendation) {
            y = this.checkPageBreak(doc, y, 80);
            y = this.drawSection(doc, 'Recomendación General', y);
            y = this.drawParagraph(doc, pad + 8, y, innerW - 8, data.generalRecommendation, C.textMuted);
            y += 6;
        }

        // ══ PRESCRIPCIÓN AGRONÓMICA ═══════════════════════════════════════════
        y = this.checkPageBreak(doc, y, 100);
        y = this.drawSection(doc, 'Prescripción Agronómica Principal', y);

        if (data.recommendedProduct || data.operativeGuide) {
            const rxW = data.recommendedProduct && data.operativeGuide ? (innerW - 8) / 2 : innerW;

            if (data.recommendedProduct) {
                const rh = doc.heightOfString(data.recommendedProduct, { width: rxW - 20 }) + 36;
                this.drawCard(doc, pad, y, rxW, rh, C.surfaceAlt);
                doc.fontSize(6).font('Helvetica').fillColor(C.textFaint).text('PRODUCTO RECOMENDADO', pad + 10, y + 10, { characterSpacing: 0.5 });
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.white)
                    .text(data.recommendedProduct, pad + 10, y + 22, { width: rxW - 20 });
                if (data.operativeGuide) {
                    const ogH = doc.heightOfString(data.operativeGuide, { width: rxW - 20 }) + 36;
                    this.drawCard(doc, pad + rxW + 8, y, rxW, Math.max(rh, ogH), C.surfaceAlt);
                    doc.fontSize(6).font('Helvetica').fillColor(C.textFaint).text('GUIA OPERATIVA', pad + rxW + 18, y + 10, { characterSpacing: 0.5 });
                    doc.fontSize(8).font('Helvetica-Oblique').fillColor(C.textMuted)
                        .text(data.operativeGuide, pad + rxW + 18, y + 22, { width: rxW - 20 });
                    y += Math.max(rh, ogH) + 12;
                } else {
                    y += rh + 12;
                }
            } else if (data.operativeGuide) {
                const ogH = doc.heightOfString(data.operativeGuide, { width: rxW - 20 }) + 36;
                this.drawCard(doc, pad, y, rxW, ogH, C.surfaceAlt);
                doc.fontSize(6).font('Helvetica').fillColor(C.textFaint).text('GUIA OPERATIVA', pad + 10, y + 10, { characterSpacing: 0.5 });
                doc.fontSize(8).font('Helvetica-Oblique').fillColor(C.textMuted)
                    .text(data.operativeGuide, pad + 10, y + 22, { width: rxW - 20 });
                y += ogH + 12;
            }
        }

        // ══ BIOSEGURIDAD ═════════════════════════════════════════════════════
        if (data.biosecurityProtocol) {
            y = this.checkPageBreak(doc, y, 80);
            y = this.drawSection(doc, 'Protocolo de Bioseguridad del Lote', y, C.red);

            const bsH = doc.heightOfString(data.biosecurityProtocol, { width: innerW - 24 });
            this.drawCard(doc, pad, y, innerW, bsH + 26, '#1a0008');
            doc.rect(pad, y, 2, bsH + 26).fill(C.red);
            doc.fontSize(8).font('Helvetica-Oblique').fillColor(C.textMuted)
                .text(data.biosecurityProtocol, pad + 14, y + 13, { width: innerW - 24 });
            y += bsH + 40;
        }

        // ══ DIAGNÓSTICO POR IMAGEN ════════════════════════════════════════════
        if (data.images.length > 0) {
            y = this.checkPageBreak(doc, y, 60);
            y = this.drawSection(doc, 'Diagnóstico por Imagen', y);

            for (const img of data.images) {
                const infectedImg = img.detections.length > 0;
                const lineColor = infectedImg ? C.redDim : C.greenDim;

                // Estimate card height
                let textH = 24 + img.detections.length * 13;
                if (img.imageRecommendation) {
                    textH += doc.heightOfString(img.imageRecommendation, { width: innerW - 100 }) + 20;
                }
                if (img.recommendedProduct) textH += 20;
                
                const hasImage = !!img.buffer;
                let imgW = 0;
                let imgH = 0;
                let validImageBuffer = img.buffer;
                
                if (hasImage) {
                    try {
                        // Ensure PDFKit compatibility by unconditionally converting to high-res PNG or JPG via sharp
                        validImageBuffer = await sharp(img.buffer)
                          .jpeg({ quality: 90 })
                          .toBuffer();
                          
                        // Maximize image size to mirror the frontend "canvas" feel
                        const maxImgW = innerW - 24; 
                        const maxImgH = 300; // Much larger vertical room, like a hero image
                        
                        const pmImg = doc.openImage(validImageBuffer);
                        const scale = Math.min(maxImgW / pmImg.width, maxImgH / pmImg.height);
                        imgW = pmImg.width * scale;
                        imgH = pmImg.height * scale;
                    } catch (e) {
                         // Fallback if image buffering fails
                        imgW = 0;
                        imgH = 0;
                        this.logger.error('Error processing image buffer with sharp in PDFKit:', e);
                    }
                }

                const cardH = Math.max(textH, imgW > 0 ? imgH + textH + 40 : 50);

                y = this.checkPageBreak(doc, y, cardH + 10);

                this.drawCard(doc, pad, y, innerW, cardH, C.surfaceAlt);
                doc.rect(pad, y, 2, cardH).fill(lineColor);

                // Title
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.textPrimary)
                    .text(img.filename, pad + 12, y + 9, { continued: true })
                    .font('Helvetica').font('Helvetica-Bold').fillColor(lineColor)
                    .text(`  ${infectedImg ? 'INFECCION' : 'LIMPIA'}`, { continued: false });

                // Draw the actual image layout (Image FIRST, centered, then text below it)
                let textX = pad + 12;
                let iy = y + 22;

                if (imgW > 0 && imgH > 0 && validImageBuffer) {
                    // Center image horizontally inside card
                    const imgX = pad + (innerW - imgW) / 2;
                    const imgY = y + 20; // Some top padding after title
                    
                    doc.image(validImageBuffer, imgX, imgY, { width: imgW, height: imgH });
                    
                    // Draw bounding boxes OVER the image!
                    if (img.detections.length > 0) {
                        try {
                            const pmImg = doc.openImage(validImageBuffer);
                            for (const det of img.detections) {
                                if (det.box && det.box.length === 4) {
                                    const [x1, y1, x2, y2] = det.box;
                                    // Scale original coordinates to PDF drawn coordinates
                                    const bX = imgX + (x1 / pmImg.width) * imgW;
                                    const bY = imgY + (y1 / pmImg.height) * imgH;
                                    const bW = ((x2 - x1) / pmImg.width) * imgW;
                                    const bH = ((y2 - y1) / pmImg.height) * imgH;
                                    
                                    doc.rect(bX, bY, bW, bH).lineWidth(1.5).stroke(C.red);

                                    // HUD Corners
                                    const cw = 6; // corner length
                                    doc.lineWidth(2).strokeColor(C.white);
                                    doc.moveTo(bX - 1, bY + cw).lineTo(bX - 1, bY - 1).lineTo(bX + cw, bY - 1).stroke();
                                    doc.moveTo(bX + bW - cw, bY - 1).lineTo(bX + bW + 1, bY - 1).lineTo(bX + bW + 1, bY + cw).stroke();
                                    doc.moveTo(bX - 1, bY + bH - cw).lineTo(bX - 1, bY + bH + 1).lineTo(bX + cw, bY + bH + 1).stroke();
                                    doc.moveTo(bX + bW - cw, bY + bH + 1).lineTo(bX + bW + 1, bY + bH + 1).lineTo(bX + bW + 1, bY + bH - cw).stroke();

                                    // Pest Label Tag
                                    const tagH = 12;
                                    const tagW = doc.widthOfString(det.pest.toUpperCase(), { font: 'Helvetica-Bold', size: 6.5 }) + 10;
                                    doc.roundedRect(bX - 1, bY - tagH - 2, tagW, tagH, 2).fill(C.red);
                                    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(C.white)
                                       .text(det.pest.toUpperCase(), bX + 4, bY - tagH + 1.5);
                                }
                            }
                        } catch(e) {}
                    }

                    // Push text rendering down BELOW the image
                    iy = imgY + imgH + 16;
                }

                if (img.detections.length > 0) {
                    for (const det of img.detections) {
                        const confPct = det.confidence <= 1 ? (det.confidence * 100).toFixed(1) : det.confidence.toFixed(1);
                        doc.fontSize(7.5).font('Helvetica').fillColor(C.red)
                            .text('▸ ', textX + 6, iy, { continued: true })
                            .fillColor(C.textPrimary).text(`${det.pest}`, { continued: true })
                            .fillColor(C.textMuted).text(`  —  ${confPct}%`, { continued: true })
                            .fillColor(C.textFaint).text(`  (${det.model})`);
                        iy += 13;
                    }
                } else {
                    doc.fontSize(7.5).font('Helvetica').fillColor(C.green)
                        .text('✓ Sin plagas detectadas', textX + 6, iy);
                    iy += 13;
                }

                if (img.imageRecommendation) {
                    iy += 4;
                    doc.fontSize(7).font('Helvetica').fillColor(C.textFaint)
                        .text('Recomendación:  ', textX + 6, iy, { continued: true })
                        .fillColor(C.textMuted).text(img.imageRecommendation, { width: innerW - 30 });
                    iy += doc.heightOfString(img.imageRecommendation, { width: innerW - 30 }) + 6;
                }

                if (img.recommendedProduct) {
                    doc.fontSize(7).font('Helvetica').fillColor(C.textFaint)
                        .text('Producto:  ', textX + 6, iy, { continued: true })
                        .fillColor(C.greenDim).text(img.recommendedProduct);
                    iy += 14;
                }

                y += cardH + 8;
            }
        }

        // ══ FOOTER ════════════════════════════════════════════════════════════
        y = this.checkPageBreak(doc, y, 50);

        // Separator
        doc.rect(pad, y, innerW, 0.5).fill(C.border);
        y += 12;

        // Green dot + text
        doc.circle(pad + 5, y + 4, 3).fill(C.green);
        doc.fontSize(6.5).font('Helvetica').fillColor(C.textFaint)
            .text('Verified by PlagaCode Core v4.3.0-LTS', pad + 14, y + 1)
            .text('Agricultura de Precision AI', pad + 14, y + 10);

        // Corner accent bottom-right
        doc.rect(W - pad - 24, y + 4, 24, 1).fill(C.green).opacity(0.3);
        doc.rect(W - pad - 1, y, 1, 18).fill(C.green).opacity(0.3);
        doc.opacity(1);
    }
}
