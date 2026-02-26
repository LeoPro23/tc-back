export class UserSession {
    constructor(
        public readonly userSessionId: string,
        public readonly userId: string,
        public readonly ipAddress: string | null,
        public readonly userAgent: string | null,
        public readonly token: string,
        public readonly expiredAt: Date | null,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly deletedAt: Date | null,
    ) { }
}
