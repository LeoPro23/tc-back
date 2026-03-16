import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(private readonly httpService: HttpService) { }

    async notifyWhatsapp(
        phoneCountry: string,
        phoneNumber: string,
        message: string,
        pdfUrl?: string,
        pdfFilename?: string,
    ): Promise<void> {
        const webhookUrl = process.env.WEBHOOK_URL;

        if (!webhookUrl) {
            this.logger.warn('WEBHOOK_URL no está configurada. No se enviará notificación.');
            return;
        }

        const rawCountry = phoneCountry.replace(/\D/g, '');
        const rawNumber = phoneNumber.replace(/\D/g, '');
        const fullPhone = `${rawCountry}${rawNumber}`;

        if (!rawCountry || !rawNumber) {
            this.logger.warn(`Número inválido para notificación: ${phoneCountry} ${phoneNumber}`);
            return;
        }

        const payload: Record<string, string> = {
            phone: fullPhone,
            message,
        };

        if (pdfUrl) {
            payload.pdfUrl = pdfUrl;
        }
        if (pdfFilename) {
            payload.pdfFilename = pdfFilename;
        }

        try {
            this.logger.log(
                `Enviando notificación al teléfono: ${fullPhone} (N8N webhook)${pdfUrl ? ' + PDF: ' + pdfUrl : ''}`,
            );
            await firstValueFrom(
                this.httpService.post(webhookUrl, payload).pipe(
                    catchError((error) => {
                        this.logger.error(`Error enviando webhook: ${error.message} - Data: ${JSON.stringify(error.response?.data)}`);
                        throw error;
                    }),
                ),
            );
            this.logger.log('Webhook notificado exitosamente.');
        } catch (e) {
            this.logger.error('Excepción general enviando webhook', e);
        }
    }
}
