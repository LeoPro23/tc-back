import { Injectable, Inject, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { IUserRepository } from '../domain/user.repository.interface';

@Injectable()
export class Generate2FaSecretUseCase {
    constructor(
        @Inject(IUserRepository)
        private readonly userRepository: IUserRepository,
    ) { }

    async execute(userId: string) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        const secret = speakeasy.generateSecret({
            name: `TomatoCode:${user.email}`,
        });

        await this.userRepository.update(userId, {
            twoFactorSecret: secret.base32,
        });

        try {
            if (!secret.otpauth_url) {
                throw new InternalServerErrorException('Error generando URL de autenticación');
            }
            const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

            return {
                secret: secret.base32,
                qrCode: qrCodeDataUrl,
            };
        } catch (error) {
            throw new InternalServerErrorException('Error generando código QR');
        }
    }
}
