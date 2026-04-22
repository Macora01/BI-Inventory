import pg from 'pg';
import 'dotenv/config';

async function findDuplicates() {
    const pool = new pg.Pool({ 
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000 
    });
    try {
        console.log('Connecting to database...');
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT * FROM locations');
            console.log('--- All Locations ---');
            console.table(res.rows);

            const stockRes = await client.query('SELECT * FROM stock WHERE "productId" = $1', ['BI6606CL']);
            console.log('--- Stock for BI6606CL ---');
            console.table(stockRes.rows);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error connecting to DB:', err);
    } finally {
        await pool.end();
    }
}

findDuplicates();
