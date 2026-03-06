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

        // PASO 7.1 (NOTIFICACIONES - COMPOSICIÓN DEL WEBHOOK)
        // Se formatea el teléfono (ej. 51987654321) y el cuerpo del mensaje markdown
        // para dárselo en bandeja de plata al Endpoint de WhatsApp (n8n o Evolution API).
        const payload = {
            phone: fullPhone,
            message,
        };

        try {
            this.logger.log(`Enviando notificación al teléfono: ${fullPhone} (N8N webhook)`);
            // PASO 7.2 (NOTIFICACIONES - LANZAMIENTO ASÍNCRONO SIN BLOQUEO)
            // Disparamos la petición POST. Nota que se maneja asincrónicamente y se captura
            // silenciosamente cualquier caída (catchError). 
            // Si WhatsApp se cae, la API de todas formas devolverá 200 OK al frontend 
            // para que el agricultor vea sus resultados sin interrupciones.
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
