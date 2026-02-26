import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegisterUseCase } from '../application/register.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { GetProfileUseCase } from '../application/get-profile.use-case';
import { UpdateProfileUseCase } from '../application/update-profile.use-case';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { Toggle2FaUseCase } from '../application/toggle-2fa.use-case';
import { UserRepositoryImpl } from './user.repository.impl';
import { IUserRepository } from '../domain/user.repository.interface';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { UserOrmEntity } from './user.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'tomatocode-secret-fallback',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
    Toggle2FaUseCase,
    JwtStrategy,
    {
      provide: IUserRepository,
      useClass: UserRepositoryImpl,
    },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthModule { }
