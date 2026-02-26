import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../domain/user.repository.interface';

@Injectable()
export class Toggle2FaUseCase {
    constructor(
        @Inject(IUserRepository)
        private readonly userRepository: IUserRepository,
    ) { }

    async execute(userId: string, isEnabled: boolean): Promise<void> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await this.userRepository.update(userId, { isTwoFactorEnabled: isEnabled });
    }
}
