import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from '../domain/user-session.entity';
import { IUserSessionRepository } from '../domain/user-session.repository.interface';
import { UserSessionOrmEntity } from './user-session.orm-entity';

@Injectable()
export class UserSessionRepositoryImpl implements IUserSessionRepository {
  constructor(
    @InjectRepository(UserSessionOrmEntity)
    private readonly repo: Repository<UserSessionOrmEntity>,
  ) {}

  private toDomain(orm: UserSessionOrmEntity): UserSession {
    return new UserSession(
      orm.userSessionId,
      orm.userId,
      orm.ipAddress,
      orm.userAgent,
      orm.token,
      orm.expiredAt,
      orm.createdAt,
      orm.updatedAt,
      orm.deletedAt,
    );
  }

  async create(data: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    token: string;
    expiredAt?: Date | null;
  }): Promise<UserSession> {
    const orm = this.repo.create({
      userId: data.userId,
      ipAddress: data.ipAddress ?? undefined,
      userAgent: data.userAgent ?? undefined,
      token: data.token,
      expiredAt: data.expiredAt ?? undefined,
    });
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async findByUserId(userId: string): Promise<UserSession[]> {
    const orms = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return orms.map((orm) => this.toDomain(orm));
  }

  async revoke(sessionId: string): Promise<void> {
    await this.repo.softDelete({ userSessionId: sessionId });
  }
}
