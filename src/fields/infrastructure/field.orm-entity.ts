import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../auth/infrastructure/user.orm-entity';
import { FieldCampaignOrmEntity } from '../../field-campaigns/infrastructure/field-campaign.orm-entity';

@Entity('fields')
export class FieldOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'id_campo' })
    id: string;

    @Column({ name: 'nombre_campo' })
    name: string;

    @Column({ name: 'ubicacion_geografica', nullable: true, type: 'varchar' })
    location: string | null;

    @Column({ name: 'userId', type: 'uuid' })
    userId: string;

    @ManyToOne(() => UserOrmEntity, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: UserOrmEntity;

    @OneToMany(
        () => FieldCampaignOrmEntity,
        (fieldCampaign) => fieldCampaign.field,
    )
    fieldCampaigns: FieldCampaignOrmEntity[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;
}
