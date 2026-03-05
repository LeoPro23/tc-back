import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ModelResultOrmEntity } from '../../model-results/infrastructure/model-result.orm-entity';

@Entity('models')
export class ModelOrmEntity {
    @PrimaryGeneratedColumn('uuid', { name: 'id_modelo' })
    id: string;

    @Column({ name: 'nombre' })
    name: string;

    @OneToMany(() => ModelResultOrmEntity, (result) => result.model)
    results: ModelResultOrmEntity[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date;
}
