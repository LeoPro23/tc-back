import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../domain/user.repository.interface';
import { User } from '../domain/user.entity';

export class UpdateProfileDto {
  email?: string;
  name?: string;
  farmName?: string;
  phoneCountry?: string;
  phoneNumber?: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string, data: UpdateProfileDto): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing) {
        throw new Error('Email already in use');
      }
    }

    return await this.userRepository.update(userId, {
      ...(data.email && { email: data.email }),
      ...(data.name && { name: data.name }),
      ...(data.farmName !== undefined && { farmName: data.farmName }),
      ...(data.phoneCountry !== undefined && {
        phoneCountry: data.phoneCountry,
      }),
      ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
    });
  }
}
