import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../domain/user.repository.interface';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
  ) { }

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      farmName: user.farmName,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
    };
  }
}
