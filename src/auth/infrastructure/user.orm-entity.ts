import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserSessionOrmEntity } from './user-session.orm-entity';

@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column()
  name: string;

  @Column({ default: 'user' })
  role: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'farm_name', nullable: true, type: 'varchar' })
  farmName: string | null;

  @Column({ name: 'is_two_factor_enabled', default: false })
  isTwoFactorEnabled: boolean;

  @Column({
    name: 'two_factor_secret',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  twoFactorSecret: string | null;

  @Column({ name: 'phone_country', nullable: true, type: 'varchar' })
  phoneCountry: string | null;

  @Column({ name: 'phone_number', nullable: true, type: 'varchar' })
  phoneNumber: string | null;

  @OneToMany(() => UserSessionOrmEntity, (session) => session.user)
  sessions: UserSessionOrmEntity[];
}
