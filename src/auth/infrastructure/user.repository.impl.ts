import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/user.entity';
import { IUserRepository } from '../domain/user.repository.interface';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class UserRepositoryImpl implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  private toDomain(orm: UserOrmEntity): User {
    return new User(
      orm.id,
      orm.email,
      orm.passwordHash,
      orm.name,
      orm.role,
      orm.createdAt,
      orm.farmName,
      orm.isTwoFactorEnabled,
      orm.twoFactorSecret,
      orm.phoneCountry,
      orm.phoneNumber,
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.repo.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'passwordHash',
        'name',
        'role',
        'createdAt',
        'farmName',
        'isTwoFactorEnabled',
        'twoFactorSecret',
        'phoneCountry',
        'phoneNumber',
      ],
    });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.repo.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'passwordHash',
        'name',
        'role',
        'createdAt',
        'farmName',
        'isTwoFactorEnabled',
        'twoFactorSecret',
        'phoneCountry',
        'phoneNumber',
      ],
    });
    if (!orm) return null;
    return this.toDomain(orm);
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: string;
  }): Promise<User> {
    const orm = this.repo.create({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role ?? 'user',
    });
    const saved = await this.repo.save(orm);
    return this.toDomain(saved);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.repo.update(id, {
      ...(data.email && { email: data.email }),
      ...(data.passwordHash && { passwordHash: data.passwordHash }),
      ...(data.name && { name: data.name }),
      ...(data.role && { role: data.role }),
      ...(data.farmName !== undefined && { farmName: data.farmName }),
      ...(data.isTwoFactorEnabled !== undefined && {
        isTwoFactorEnabled: data.isTwoFactorEnabled,
      }),
      ...(data.twoFactorSecret !== undefined && {
        twoFactorSecret: data.twoFactorSecret,
      }),
      ...(data.phoneCountry !== undefined && {
        phoneCountry: data.phoneCountry,
      }),
      ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
    });
    const updated = await this.findById(id);
    if (!updated) throw new Error('User not found after update');
    return updated;
  }
}
