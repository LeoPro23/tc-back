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
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    const orm = await this.repo.findOne({ where: { email } });
    return orm ? this.toDomain(orm) : null;
  }

  async findById(id: string): Promise<User | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
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
}
