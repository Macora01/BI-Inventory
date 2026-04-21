import pg from 'pg';
import 'dotenv/config';

async function checkDb() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log('--- Locations ---');
        const locs = await pool.query('SELECT * FROM locations');
        console.table(locs.rows);

        console.log('--- Stock for BI6606CL ---');
        const stock = await pool.query('SELECT * FROM stock WHERE "productId" = $1', ['BI6606CL']);
        console.table(stock.rows);

        console.log('--- Recent Movements for BI6606CL ---');
        const movs = await pool.query('SELECT * FROM movements WHERE "productId" = $1 ORDER BY timestamp DESC LIMIT 10', ['BI6606CL']);
        console.table(movs.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkDb();
