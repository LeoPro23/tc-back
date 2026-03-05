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
import { ModelOrmEntity } from '../../models/infrastructure/model.orm-entity';
import { AttachedImageOrmEntity } from '../../attached-images/infrastructure/attached-image.orm-entity';

@Entity('model_results')
export class ModelResultOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'id_resultado_modelo' })
    id: string;

    @ManyToOne(() => ModelOrmEntity, (model) => model.results, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'id_modelo' })
    model: ModelOrmEntity;

    @ManyToOne(() => AttachedImageOrmEntity, (image) => image.modelResults, {
        nullable: false,
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'id_imagen_adjuntada' })
    image: AttachedImageOrmEntity;

    @Column({ name: 'diagnostico' })
    diagnosis: string;

    @Column({ type: 'float', name: 'precision' })
    confidence: number;

    @Column({ type: 'jsonb', name: 'bounding_box' })
    boundingBox: any;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;
}
