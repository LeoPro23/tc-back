import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { UserOrmEntity } from './user.orm-entity';

@Entity({ name: 'user_sessions' })
export class UserSessionOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'user_session_id' })
    userSessionId: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'ip_address', length: 45, nullable: true })
    ipAddress: string;

    @Column({ name: 'user_agent', length: 255, nullable: true })
    userAgent: string;

    @Column({ type: 'text' })
    token: string;

    @Column({ name: 'expired_at', type: 'timestamp', nullable: true })
    expiredAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', nullable: true })
    deletedAt: Date;

    @ManyToOne(() => UserOrmEntity, (user) => user.sessions, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'user_id' })
    user: UserOrmEntity;
}
