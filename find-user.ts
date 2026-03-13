
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '.env') });

const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [],
});

async function find() {
    try {
        await ds.initialize();
        const res = await ds.query('SELECT id, email FROM public.users WHERE email = $1', ['diego@test.com']);
        if (res.length > 0) {
            console.log('--- FOUND ---');
            console.log(`ID: ${res[0].id}`);
            console.log('--- END ---');
        } else {
            console.log('User not found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await ds.destroy();
    }
}
find();
