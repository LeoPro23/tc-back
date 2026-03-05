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
import { AnalysisFieldCampaignOrmEntity } from '../../analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { ModelResultOrmEntity } from '../../model-results/infrastructure/model-result.orm-entity';

@Entity('attached_images')
export class AttachedImageOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'id_imagen_adjuntada' })
    id: string;

    @ManyToOne(
        () => AnalysisFieldCampaignOrmEntity,
        (analysis) => analysis.attachedImages,
        { nullable: false, onDelete: 'CASCADE' },
    )
    @JoinColumn({ name: 'id_analisis_campo_campana' })
    analysis: AnalysisFieldCampaignOrmEntity;

    @Column({ name: 'url_or_filepath' })
    url: string;

    @Column({ name: 'file_name' })
    fileName: string;

    @Column({ type: 'int', nullable: true })
    height: number | null;

    @Column({ type: 'int', nullable: true })
    width: number | null;

    @Column({ name: 'recomendacion_imagen', type: 'text', nullable: true })
    imageRecommendation: string | null;

    @Column({ name: 'producto_recomendado', type: 'varchar', nullable: true })
    recommendedProduct: string | null;

    @Column({ name: 'guia_operativa', type: 'text', nullable: true })
    operativeGuide: string | null;

    @Column({ name: 'protocolo_bioseguridad', type: 'text', nullable: true })
    biosecurityProtocol: string | null;

    @OneToMany(() => ModelResultOrmEntity, (result) => result.image)
    modelResults: ModelResultOrmEntity[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;
}
