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

@Entity('campaigns')
export class CampaignOrmEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id_campana' })
  id: string;

  @Column({ name: 'fecha_inicio', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'fecha_fin', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'userId', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserOrmEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserOrmEntity;

  @OneToMany(
    () => FieldCampaignOrmEntity,
    (fieldCampaign) => fieldCampaign.campaign,
  )
  fieldCampaigns: FieldCampaignOrmEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
