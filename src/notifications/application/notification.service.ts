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
    ): Promise<void> {
        const webhookUrl = process.env.WEBHOOK_URL;

        if (!webhookUrl) {
            this.logger.warn('WEBHOOK_URL no está configurada. No se enviará notificación.');
            return;
        }

        // Asegurarse de quitar símbolos como + de ambos lados si existieran.
        const rawCountry = phoneCountry.replace(/\D/g, '');
        const rawNumber = phoneNumber.replace(/\D/g, '');
        const fullPhone = `${rawCountry}${rawNumber}`;

        if (!rawCountry || !rawNumber) {
            this.logger.warn(`Número inválido para notificación: ${phoneCountry} ${phoneNumber}`);
            return;
        }

        const payload = {
            phone: fullPhone,
            message,
        };

        try {
            this.logger.log(`Enviando notificación al teléfono: ${fullPhone} (N8N webhook)`);
            // No devolvemos await final al usuario en general para no bloquear, el catchError logea en consola si falla asincrónicamente
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
