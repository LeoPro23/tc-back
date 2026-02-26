import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RegisterUseCase } from '../application/register.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { GetProfileUseCase } from '../application/get-profile.use-case';
import { UpdateProfileUseCase, UpdateProfileDto } from '../application/update-profile.use-case';
import { ChangePasswordUseCase, ChangePasswordDto } from '../application/change-password.use-case';
import { Toggle2FaUseCase } from '../application/toggle-2fa.use-case';
import { JwtAuthGuard } from './jwt-auth.guard';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly toggle2FaUseCase: Toggle2FaUseCase,
  ) { }

  @Post('register')
  register(@Body() dto: RegisterBody) {
    return this.registerUseCase.execute(dto);
  }

  @Post('login')
  login(@Body() dto: LoginBody) {
    return this.loginUseCase.execute(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: Record<string, Record<string, string>>) {
    return this.getProfileUseCase.execute(req['user']['userId']);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @Request() req: Record<string, Record<string, string>>,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.updateProfileUseCase.execute(req['user']['userId'], dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Request() req: Record<string, Record<string, string>>,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.changePasswordUseCase.execute(req['user']['userId'], dto);
  }

  @Post('2fa/toggle')
  @UseGuards(JwtAuthGuard)
  toggle2Fa(
    @Request() req: Record<string, Record<string, string>>,
    @Body() dto: { isEnabled: boolean },
  ) {
    return this.toggle2FaUseCase.execute(req['user']['userId'], dto.isEnabled);
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  getDevices(@Request() req: any) {
    // Retorna dispositivos mockeados, inyectando la información del agente de usuario actual como uno de ellos
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    return [
      { id: '1', name: 'Dispositivo Actual', os: userAgent, lastActive: new Date().toISOString() }
    ];
  }
}
