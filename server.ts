import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import multer from 'multer';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database initialization
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function initDb() {
    if (!process.env.DATABASE_URL) {
        console.warn('DATABASE_URL not set, falling back to JSON files mode (not recommended for production).');
        return false;
    }

    try {
        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS products (
                    id_venta TEXT PRIMARY KEY,
                    description TEXT,
                    factory_id TEXT,
                    category TEXT,
                    price NUMERIC,
                    cost NUMERIC,
                    image_url TEXT
                );
                CREATE TABLE IF NOT EXISTS locations (
                    id TEXT PRIMARY KEY,
                    name TEXT
                );
                CREATE TABLE IF NOT EXISTS stock (
                    product_id TEXT REFERENCES products(id_venta),
                    location_id TEXT REFERENCES locations(id),
                    quantity NUMERIC,
                    PRIMARY KEY (product_id, location_id)
                );
                CREATE TABLE IF NOT EXISTS movements (
                    id TEXT PRIMARY KEY,
                    product_id TEXT,
                    from_location_id TEXT,
                    to_location_id TEXT,
                    quantity NUMERIC,
                    type TEXT,
                    reason TEXT,
                    date TEXT
                );
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password TEXT,
                    role TEXT
                );
            `);
            console.log('PostgreSQL Tables initialized successfully');
            return true;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Failed to connect to PostgreSQL:', err);
        return false;
    }
}

async function startServer() {
    const isPgActive = await initDb();
    const app = express();
    const port = 3000;

    app.use(express.json({ limit: '50mb' }));

    // Configuración de almacenamiento para archivos subidos
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const productsDir = path.join(uploadsDir, 'products');
    const dataDir = path.join(process.cwd(), 'data');

    // Asegurar que los directorios existan
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(productsDir, { recursive: true });
    await fs.mkdir(dataDir, { recursive: true });

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const type = req.query.type;
            if (type === 'product') return cb(null, productsDir);
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            const type = req.query.type;
            if (type === 'logo') return cb(null, 'logo.png');
            if (type === 'product') {
                const factoryId = req.query.factoryId;
                return cb(null, `${factoryId}.jpg`);
            }
            cb(null, file.originalname);
        }
    });

    const upload = multer({ storage });

    // Helper para leer/escribir datos JSON (Fallback)
    const getFilePath = (name: string) => path.join(dataDir, `${name}.json`);

    const readDataJson = async (name: string, defaultValue: any = []) => {
        try {
            const content = await fs.readFile(getFilePath(name), 'utf-8');
            return JSON.parse(content);
        } catch {
            return defaultValue;
        }
    };

    const writeDataJson = async (name: string, data: any) => {
        await fs.writeFile(getFilePath(name), JSON.stringify(data, null, 2));
    };

    // --- API ROUTES ---

    // Health / Status
    app.get('/api/health', async (req, res) => {
        let dbStatus = 'disconnected';
        if (isPgActive) {
            try {
                await pool.query('SELECT 1');
                dbStatus = 'connected (PostgreSQL)';
            } catch {
                dbStatus = 'error (PostgreSQL)';
            }
        } else {
            dbStatus = 'connected (Local JSON)';
        }
        res.json({ database: dbStatus, server: 'ok' });
    });

    // Logo
    app.get('/api/logo', async (req, res) => {
        try {
            const logoPath = path.join(uploadsDir, 'logo.png');
            await fs.access(logoPath);
            res.sendFile(logoPath);
        } catch {
            res.status(404).json({ error: 'Logo not found' });
        }
    });

    // Upload Logo/Images
    app.post('/api/upload', upload.single('file'), (req, res) => {
        res.json({ success: true, file: req.file });
    });

    // Product Images
    app.get('/api/products/:factoryId/image', async (req, res) => {
        const { factoryId } = req.params;
        const imgPath = path.join(productsDir, `${factoryId}.jpg`);
        try {
            await fs.access(imgPath);
            res.sendFile(imgPath);
        } catch {
            res.status(404).send('Image not found');
        }
    });

    // --- GENERIC API IMPLEMENTATION ---

    const entities = ['products', 'stock', 'movements', 'locations', 'users'];

    app.get('/api/:entity', async (req, res) => {
        const { entity } = req.params;
        if (!entities.includes(entity)) return res.status(404).json({ error: 'Invalid entity' });

        if (isPgActive) {
            try {
                const result = await pool.query(`SELECT * FROM ${entity}`);
                // Map snake_case to camelCase for some fields if needed
                const rows = result.rows.map(row => {
                    const mapped: any = { ...row };
                    if (row.id_venta) mapped.id_venta = row.id_venta; // Ya está así
                    return mapped;
                });
                return res.json(rows);
            } catch (err: any) {
                return res.status(500).json({ error: err.message });
            }
        } else {
            const data = await readDataJson(entity);
            res.json(data);
        }
    });

    app.post('/api/:entity', async (req, res) => {
        const { entity } = req.params;
        const newItem = req.body;
        if (!entities.includes(entity)) return res.status(404).json({ error: 'Invalid entity' });

        if (isPgActive) {
            try {
                if (Array.isArray(newItem)) {
                    // Bulk replace for simple entities
                    await pool.query('BEGIN');
                    await pool.query(`DELETE FROM ${entity}`);
                    for (const item of newItem) {
                        const keys = Object.keys(item);
                        const values = Object.values(item);
                        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                        await pool.query(`INSERT INTO ${entity} (${keys.join(',')}) VALUES (${placeholders})`, values);
                    }
                    await pool.query('COMMIT');
                } else {
                    const keys = Object.keys(newItem);
                    const values = Object.values(newItem);
                    const idField = entity === 'products' ? 'id_venta' : 'id';
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                    const updates = keys.map((k, i) => `${k} = $${i + 1}`).join(',');
                    
                    await pool.query(`
                        INSERT INTO ${entity} (${keys.join(',')}) 
                        VALUES (${placeholders}) 
                        ON CONFLICT (${idField}) DO UPDATE SET ${updates}`, values);
                }
                res.json({ success: true });
            } catch (err: any) {
                await pool.query('ROLLBACK').catch(() => {});
                res.status(500).json({ error: err.message });
            }
        } else {
            const currentData = await readDataJson(entity, []);
            if (Array.isArray(newItem)) {
                await writeDataJson(entity, newItem);
            } else {
                let updatedData;
                const idField = entity === 'products' ? 'id_venta' : 'id';
                const index = currentData.findIndex((item: any) => item[idField] === newItem[idField]);
                if (index > -1) {
                    updatedData = [...currentData];
                    updatedData[index] = { ...updatedData[index], ...newItem };
                } else {
                    updatedData = [...currentData, newItem];
                }
                await writeDataJson(entity, updatedData);
            }
            res.json({ success: true });
        }
    });

    // Stock Update Special
    app.post('/api/stock/update', async (req, res) => {
        const { productId, locationId, quantityChange } = req.body;
        
        if (isPgActive) {
            try {
                await pool.query(`
                    INSERT INTO stock (product_id, location_id, quantity)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (product_id, location_id)
                    DO UPDATE SET quantity = stock.quantity + $3
                `, [productId, locationId, quantityChange]);
                res.json({ success: true });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        } else {
            const stockData = await readDataJson('stock', []);
            const index = stockData.findIndex((s: any) => s.productId === productId && s.locationId === locationId);
            if (index > -1) {
                stockData[index].quantity += Number(quantityChange);
            } else if (quantityChange > 0) {
                stockData.push({ productId, locationId, quantity: Number(quantityChange) });
            }
            await writeDataJson('stock', stockData);
            res.json({ success: true });
        }
    });

    // Bulk Import for Initial Inventory
    app.post('/api/bulk-import', async (req, res) => {
        const { products, stock, movements } = req.body;
        
        if (isPgActive) {
            try {
                await pool.query('BEGIN');
                if (products) {
                    for (const p of products) {
                        const keys = Object.keys(p);
                        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                        const updates = keys.map((k, i) => `${k} = $${i + 1}`).join(',');
                        await pool.query(`INSERT INTO products (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT (id_venta) DO UPDATE SET ${updates}`, Object.values(p));
                    }
                }
                if (stock) {
                    for (const s of stock) {
                        await pool.query(`INSERT INTO stock (product_id, location_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = $3`, [s.productId, s.locationId, s.quantity]);
                    }
                }
                if (movements) {
                    for (const m of movements) {
                        // Snake case mapping for movements if needed or use same keys
                        const pk = m.id || `mov-${Date.now()}-${Math.random()}`;
                        await pool.query(`INSERT INTO movements (id, product_id, from_location_id, to_location_id, quantity, type, reason, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`, [pk, m.productId, m.fromLocationId, m.toLocationId, m.quantity, m.type, m.reason, m.date]);
                    }
                }
                await pool.query('COMMIT');
                res.json({ success: true });
            } catch (err: any) {
                await pool.query('ROLLBACK').catch(() => {});
                res.status(500).json({ error: err.message });
            }
        } else {
            if (products) await writeDataJson('products', products);
            if (stock) await writeDataJson('stock', stock);
            if (movements) {
                const currentMovements = await readDataJson('movements', []);
                await writeDataJson('movements', [...movements, ...currentMovements].slice(0, 1000));
            }
            res.json({ success: true });
        }
    });

    // Clear Data
    app.post('/api/clear', async (req, res) => {
        const { entity } = req.body;
        if (isPgActive) {
            try {
                if (entity && entities.includes(entity)) {
                    await pool.query(`DELETE FROM ${entity}`);
                } else {
                    for (const ent of entities) {
                        await pool.query(`DELETE FROM ${ent}`);
                    }
                }
                res.json({ success: true });
            } catch (err: any) {
                res.status(500).json({ error: err.message });
            }
        } else {
            if (entity && entities.includes(entity)) {
                await writeDataJson(entity, []);
            } else {
                for (const ent of entities) {
                    await writeDataJson(ent, ent === 'users' ? [] : []);
                }
            }
            res.json({ success: true });
        }
    });

    // Vite Integration
    if (process.env.NODE_ENV !== 'production') {
        const { createServer } = await import('vite');
        const vite = await createServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${port}`);
    });
}

startServer().catch(console.error);
