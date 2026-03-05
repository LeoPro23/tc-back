import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository } from '../domain/user.repository.interface';
import { IUserSessionRepository } from '../domain/user-session.repository.interface';

export interface LoginDto {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  otpCode?: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(IUserSessionRepository)
    private readonly userSessionRepository: IUserSessionRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.isTwoFactorEnabled) {
      if (!dto.otpCode) {
        throw new UnauthorizedException('2FA_REQUIRED');
      }

      const speakeasy = require('speakeasy');
      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: dto.otpCode,
        window: 2,
      });

      if (!isValid) {
        throw new UnauthorizedException(
          'El código 2FA es incorrecto o ha expirado',
        );
      }
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    await this.userSessionRepository.create({
      userId: user.id,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      token: accessToken,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
