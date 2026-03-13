
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AnalysisFieldCampaignOrmEntity } from './src/analysis-field-campaigns/infrastructure/analysis-field-campaign.orm-entity';
import { FieldCampaignOrmEntity } from './src/field-campaigns/infrastructure/field-campaign.orm-entity';
import { CampaignOrmEntity } from './src/campaigns/infrastructure/campaign.orm-entity';
import { FieldOrmEntity } from './src/fields/infrastructure/field.orm-entity';
import { UserOrmEntity } from './src/auth/infrastructure/user.orm-entity';

dotenv.config();

async function test() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [AnalysisFieldCampaignOrmEntity, FieldCampaignOrmEntity, CampaignOrmEntity, FieldOrmEntity, UserOrmEntity],
    synchronize: false,
  });

  try {
    await AppDataSource.initialize();
    console.log('Connected to DB');

    console.log('Finding active campaign...');
    const campaignRepo = AppDataSource.getRepository(CampaignOrmEntity);
    const activeCampaign = await campaignRepo.findOne({ where: { isActive: true } });
    
    if (!activeCampaign) {
      console.log('No active campaign found');
      return;
    }
    const campaignId = activeCampaign.id;
    console.log('Using campaignId:', campaignId);
    
    const targetPest = 'tuta_absoluta';

    const repo = AppDataSource.getRepository(AnalysisFieldCampaignOrmEntity);

    console.log('Running query...');
    const result = await repo.createQueryBuilder('analysis')
      .innerJoin('analysis.fieldCampaign', 'fc')
      .innerJoin('fc.campaign', 'campaign')
      .innerJoin('fc.field', 'field')
      .where('campaign.id = :campaignId', { campaignId })
      .andWhere('analysis.primaryTargetPest = :pest', { pest: targetPest })
      .select('field.name', 'fieldName')
      .addSelect('SUM(analysis.bugDensity)', 'totalDensity')
      .groupBy('field.name')
      .orderBy('totalDensity', 'DESC') // Pruebo sin comillas primero
      .limit(4)
      .getRawMany();

    console.log('Result:', result);
  } catch (error) {
    console.error('Error during query:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

test();
