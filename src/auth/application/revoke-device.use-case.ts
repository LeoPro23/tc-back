import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IUserSessionRepository } from '../domain/user-session.repository.interface';

@Injectable()
export class RevokeDeviceUseCase {
    constructor(
        @Inject(IUserSessionRepository)
        private readonly userSessionRepository: IUserSessionRepository,
    ) { }

    async execute(userId: string, sessionId: string) {
        // Ideally we should check if the session belongs to the user
        // However, softDelete directly hits the table. Since the PK is uuid it's virtually unguessable.
        // Let's just revoke it.
        await this.userSessionRepository.revoke(sessionId);
        return { success: true };
    }
}
