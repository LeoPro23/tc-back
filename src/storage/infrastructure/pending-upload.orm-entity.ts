import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('pending_uploads')
export class PendingUploadOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'local_filename' })
  localFilename: string;

  @Column({ name: 'local_url' })
  localUrl: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ default: false })
  synced: boolean;

  @Column({ name: 'minio_url', nullable: true })
  minioUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
