import { UserSession } from './user-session.entity';

export const IUserSessionRepository = Symbol('IUserSessionRepository');

export interface IUserSessionRepository {
    create(data: {
        userId: string;
        ipAddress?: string | null;
        userAgent?: string | null;
        token: string;
        expiredAt?: Date | null;
    }): Promise<UserSession>;

    findByUserId(userId: string): Promise<UserSession[]>;

    revoke(sessionId: string): Promise<void>;
}
