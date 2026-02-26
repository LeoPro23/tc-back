import { Injectable, Inject } from '@nestjs/common';
import { IUserSessionRepository } from '../domain/user-session.repository.interface';
import { UserSession } from '../domain/user-session.entity';

@Injectable()
export class GetDevicesUseCase {
    constructor(
        @Inject(IUserSessionRepository)
        private readonly userSessionRepository: IUserSessionRepository,
    ) { }

    async execute(userId: string): Promise<UserSession[]> {
        return await this.userSessionRepository.findByUserId(userId);
    }
}
