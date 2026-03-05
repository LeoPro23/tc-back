import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import { IUserRepository } from '../domain/user.repository.interface';

@Injectable()
export class Verify2FaUseCase {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string, otpCode: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException('El secreto 2FA no ha sido generado');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: otpCode,
      window: 2, // Allow a bit of time margin
    });

    if (!isValid) {
      throw new BadRequestException(
        'El código de verificación es inválido o ha expirado',
      );
    }

    // Enable 2FA on successful verification
    await this.userRepository.update(userId, { isTwoFactorEnabled: true });

    return true;
  }
}
