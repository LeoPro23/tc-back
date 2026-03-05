import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../domain/user.repository.interface';
import * as bcrypt from 'bcrypt';

export class ChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string, data: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(
      data.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new Error('Contraseña actual incorrecta');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(data.newPassword, salt);

    await this.userRepository.update(userId, { passwordHash: newHash });
  }
}
