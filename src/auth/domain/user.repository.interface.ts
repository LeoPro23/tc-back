import { User } from './user.entity';

export const IUserRepository = Symbol('IUserRepository');

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: string;
  }): Promise<User>;
}
