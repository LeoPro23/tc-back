import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT a.id_analisis_campo_campana, a.date, a.is_infected, a.plaga_principal, fc.id_campana FROM analysis_field_campaign a LEFT JOIN field_campaigns fc ON a.id_campo_campana = fc.id_campo_campana LIMIT 10;');
  console.log("Analysis items:", res.rows);
  
  const camp = await client.query('SELECT id_campana, "isActive", "startDate", "endDate" FROM campaigns LIMIT 5;');
  console.log("Campaigns:", camp.rows);
  
  await client.end();
}
run().catch(console.error);
