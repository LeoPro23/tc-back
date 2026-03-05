import {
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { CampaignOrmEntity } from '../../campaigns/infrastructure/campaign.orm-entity';
import { FieldOrmEntity } from '../../fields/infrastructure/field.orm-entity';
import { AnalysisFieldCampaignOrmEntity } from '../../analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';

@Entity('field_campaigns')
export class FieldCampaignOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'id_campo_campana' })
    id: string;

    @ManyToOne(() => FieldOrmEntity, (field) => field.fieldCampaigns, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'id_campo' })
    field: FieldOrmEntity;

    @ManyToOne(
        () => CampaignOrmEntity,
        (campaign) => campaign.fieldCampaigns,
        { nullable: false, onDelete: 'CASCADE' },
    )
    @JoinColumn({ name: 'id_campana' })
    campaign: CampaignOrmEntity;

    @OneToMany(
        () => AnalysisFieldCampaignOrmEntity,
        (analysis) => analysis.fieldCampaign,
    )
    analyses: AnalysisFieldCampaignOrmEntity[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;
}
