import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { FieldCampaignOrmEntity } from '../../field-campaigns/infrastructure/field-campaign.orm-entity';
import { AttachedImageOrmEntity } from '../../attached-images/infrastructure/attached-image.orm-entity';

@Entity('analysis_field_campaign')
export class AnalysisFieldCampaignOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'id_analisis_campo_campana' })
    id: string;

    @ManyToOne(
        () => FieldCampaignOrmEntity,
        (fc) => fc.analyses,
        { nullable: false, onDelete: 'CASCADE' },
    )
    @JoinColumn({ name: 'id_campo_campana' })
    fieldCampaign: FieldCampaignOrmEntity;

    @Column({ type: 'timestamp' })
    date: Date;

    @Column({ name: 'resumen_general_lote', type: 'text', nullable: true })
    generalSummary: string | null;

    @Column({ name: 'recomendacion_general', type: 'text', nullable: true })
    generalRecommendation: string | null;

    @Column({ name: 'producto_recomendado', type: 'varchar', nullable: true })
    recommendedProduct: string | null;

    @Column({ name: 'guia_operativa', type: 'text', nullable: true })
    operativeGuide: string | null;

    @Column({ name: 'protocolo_bioseguridad', type: 'text', nullable: true })
    biosecurityProtocol: string | null;

    @Column({ name: 'estado_fenologico', type: 'varchar', nullable: true })
    phenologicalState: string | null;

    @Column({ name: 'calidad_suelo', type: 'text', nullable: true })
    soilQuality: string | null;

    @Column({ name: 'clima_actual', type: 'text', nullable: true })
    currentClimate: string | null;

    @OneToMany(() => AttachedImageOrmEntity, (image) => image.analysis)
    attachedImages: AttachedImageOrmEntity[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;
}
