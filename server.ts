import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import multer from 'multer';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection pool (initialized lazily)
let pool: any = null;

function getPool() {
    if (!pool && process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            // Agregar un pequeño timeout para no dejar colgada la app
            connectionTimeoutMillis: 5000,
        });
    }
    return pool;
}

let isPgActive = false;
let dbInitError: string | null = null;

async function initDb() {
    console.log('--- Database Initialization ---');
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
        console.warn('DATABASE_URL is not defined in environment variables.');
        dbInitError = 'La variable de entorno DATABASE_URL no fue detectada.';
        return false;
    }

    try {
        const currentPool = getPool();
        if (!currentPool) return false;

        const client = await currentPool.connect();
        try {
            console.log('Connected to PostgreSQL. Initializing tables...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS products (
                    id_venta TEXT PRIMARY KEY,
                    id_fabrica TEXT,
                    description TEXT,
                    price NUMERIC,
                    cost NUMERIC,
                    image TEXT,
                    "minStock" NUMERIC DEFAULT 2
                );
                
                -- Migraciones para products
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='factory_id') THEN
                        ALTER TABLE products RENAME COLUMN factory_id TO id_fabrica;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image_url') THEN
                        ALTER TABLE products RENAME COLUMN image_url TO image;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='minStock') THEN
                        ALTER TABLE products ADD COLUMN "minStock" NUMERIC DEFAULT 2;
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS locations (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    type TEXT
                );

                -- Migraciones para locations
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='type') THEN
                        ALTER TABLE locations ADD COLUMN type TEXT DEFAULT 'FIXED_STORE_PERMANENT';
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS stock (
                    "productId" TEXT REFERENCES products(id_venta),
                    "locationId" TEXT REFERENCES locations(id),
                    quantity NUMERIC,
                    PRIMARY KEY ("productId", "locationId")
                );

                -- Migraciones para stock
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock' AND column_name='product_id') THEN
                        ALTER TABLE stock RENAME COLUMN product_id TO "productId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock' AND column_name='location_id') THEN
                        ALTER TABLE stock RENAME COLUMN location_id TO "locationId";
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );

                CREATE TABLE IF NOT EXISTS factory_images (
                    factory_id TEXT PRIMARY KEY,
                    image_data TEXT
                );

                CREATE TABLE IF NOT EXISTS movements (
                    id TEXT PRIMARY KEY,
                    "productId" TEXT,
                    "fromLocationId" TEXT,
                    "toLocationId" TEXT,
                    quantity NUMERIC,
                    type TEXT,
                    reason TEXT,
                    timestamp TEXT,
                    "relatedFile" TEXT,
                    price NUMERIC,
                    cost NUMERIC
                );

                -- Migraciones para movements
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='product_id') THEN
                        ALTER TABLE movements RENAME COLUMN product_id TO "productId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='from_location_id') THEN
                        ALTER TABLE movements RENAME COLUMN from_location_id TO "fromLocationId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='to_location_id') THEN
                        ALTER TABLE movements RENAME COLUMN to_location_id TO "toLocationId";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='date') THEN
                        ALTER TABLE movements RENAME COLUMN date TO timestamp;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='relatedFile') THEN
                        ALTER TABLE movements ADD COLUMN "relatedFile" TEXT;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='price') THEN
                        ALTER TABLE movements ADD COLUMN price NUMERIC;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movements' AND column_name='cost') THEN
                        ALTER TABLE movements ADD COLUMN cost NUMERIC;
                    END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE,
                    password TEXT,
                    role TEXT
                );
            `);
            console.log('PostgreSQL Tables initialized successfully');

            // Asegurar que exista la Bodega Central (BODCEN/BODCENT) para las importaciones masivas
            const bodcenCheck = await client.query("SELECT id FROM locations WHERE id IN ('BODCEN', 'BODCENT') OR name ILIKE '%Bodega%' OR name ILIKE '%Central%' LIMIT 1");
            if (bodcenCheck.rows.length === 0) {
                await client.query("INSERT INTO locations (id, name, type) VALUES ('BODCENT', 'Bodega Central', 'FIXED_STORE_PERMANENT')");
                console.log('Location "Bodega Central" (BODCENT) enforced.');
            }

            isPgActive = true;
            return true;
        } finally {
            client.release();
        }
    } catch (err: any) {
        console.error('CRITICAL: Failed to connect to PostgreSQL database.');
        console.error('Error message:', err.message);
        dbInitError = err.message;
        return false;
    }
}

async function startServer() {
    await initDb();
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
        let status = 'disconnected';
        let engine = isPgActive ? 'postgresql' : 'json';
        let error = null;

        if (isPgActive) {
            try {
                const currentPool = getPool();
                if (currentPool) {
                    await currentPool.query('SELECT 1');
                    status = 'connected';
                }
            } catch (err: any) {
                status = 'error';
                error = err.message;
            }
        } else {
            // Si PG no está activo, estamos en modo JSON
            status = 'connected'; 
            error = dbInitError || 'PostgreSQL no está activo (Modo Backup JSON)';
        }

        res.json({ 
            status, 
            database: isPgActive && status === 'connected' ? 'connected' : 'disconnected',
            engine,
            error,
            server: 'ok' 
        });
    });

    // Bulk Import for Initial Inventory (Moved UP to avoid shadowing by /api/:entity)
    app.post('/api/bulk-import', async (req, res) => {
        const { products, stock, movements } = req.body;
        const currentPool = getPool();
        
        if (isPgActive && currentPool) {
            try {
                await currentPool.query('BEGIN');
                if (products) {
                    for (const p of products) {
                        const keys = Object.keys(p);
                        const quotedKeys = keys.map(k => `"${k}"`).join(',');
                        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                        const updates = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
                        await currentPool.query(`INSERT INTO products (${quotedKeys}) VALUES (${placeholders}) ON CONFLICT (id_venta) DO UPDATE SET ${updates}`, Object.values(p));
                    }
                }
                if (stock) {
                    for (const s of stock) {
                        await currentPool.query(`INSERT INTO stock ("productId", "locationId", quantity) VALUES ($1, $2, $3) ON CONFLICT ("productId", "locationId") DO UPDATE SET quantity = $3`, [s.productId, s.locationId, s.quantity]);
                    }
                }
                if (movements) {
                    for (const m of movements) {
                        const pk = m.id || `mov-${Date.now()}-${Math.random()}`;
                        const keys = Object.keys(m);
                        const quotedKeys = keys.map(k => `"${k}"`).join(',');
                        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                        await currentPool.query(`INSERT INTO movements (${quotedKeys}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, Object.values(m));
                    }
                }
                await currentPool.query('COMMIT');
                res.json({ success: true });
            } catch (err: any) {
                await currentPool.query('ROLLBACK').catch(() => {});
                res.status(500).json({ error: err.message });
            }
        } else {
            if (products) await writeDataJson('products', products);
            if (stock) await writeDataJson('stock', stock);
            if (movements) await writeDataJson('movements', movements);
            res.json({ success: true });
        }
    });

    // Bulk Movements and Stock Update (Atomic)
    app.post('/api/movements/bulk', async (req, res) => {
        const { movements, stockAdjustments } = req.body;
        const currentPool = getPool();
        
        if (isPgActive && currentPool) {
            try {
                await currentPool.query('BEGIN');
                
                // 1. Insertar todos los movimientos
                for (const m of movements) {
                    const id = m.id || `mov-${Date.now()}-${Math.random()}`;
                    const keys = Object.keys(m);
                    const quotedKeys = keys.map(k => `"${k}"`).join(',');
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                    await currentPool.query(`INSERT INTO movements (${quotedKeys}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, Object.values(m));
                }
                
                // 2. Actualizar stocks de forma relativa
                for (const sa of stockAdjustments) {
                    await currentPool.query(`
                        INSERT INTO stock ("productId", "locationId", quantity)
                        VALUES ($1, $2, $3)
                        ON CONFLICT ("productId", "locationId")
                        DO UPDATE SET quantity = stock.quantity + $3
                    `, [sa.productId, sa.locationId, sa.quantityChange]);
                }
                
                await currentPool.query('COMMIT');
                res.json({ success: true, count: movements.length });
            } catch (err: any) {
                await currentPool.query('ROLLBACK').catch(() => {});
                console.error('Error in bulk movements:', err);
                res.status(500).json({ error: err.message });
            }
        } else {
            // Fallback JSON mode
            const movementsData = await readDataJson('movements', []);
            const stockData = await readDataJson('stock', []);
            
            for (const m of movements) {
                movementsData.unshift({ ...m, timestamp: m.timestamp || new Date().toISOString() });
            }
            
            for (const sa of stockAdjustments) {
                const idx = stockData.findIndex((s: any) => s.productId === sa.productId && s.locationId === sa.locationId);
                if (idx > -1) {
                    stockData[idx].quantity = Number(stockData[idx].quantity) + Number(sa.quantityChange);
                } else {
                    stockData.push({ productId: sa.productId, locationId: sa.locationId, quantity: sa.quantityChange });
                }
            }
            
            await writeDataJson('movements', movementsData);
            await writeDataJson('stock', stockData);
            res.json({ success: true, count: movements.length });
        }
    });

    // Stock Update Special (Moved UP)
    app.post('/api/stock/update', async (req, res) => {
        const { productId, locationId, quantityChange } = req.body;
        const currentPool = getPool();
        
        if (isPgActive && currentPool) {
            try {
                await currentPool.query(`
                    INSERT INTO stock ("productId", "locationId", quantity)
                    VALUES ($1, $2, $3)
                    ON CONFLICT ("productId", "locationId")
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

    // Logo
    app.get('/api/logo', async (req, res) => {
        try {
            // Priority: DB
            const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['logo']);
            if (result.rows.length > 0) {
                const base64 = result.rows[0].value;
                const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const content = matches[2];
                    const img = Buffer.from(content, 'base64');
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Length': img.length
                    });
                    return res.end(img);
                }
            }

            const logoPath = path.join(uploadsDir, 'logo.png');
            await fs.access(logoPath);
            res.sendFile(logoPath);
        } catch {
            try {
                const publicLogoPath = path.join(process.cwd(), 'public', 'logo.png');
                await fs.access(publicLogoPath);
                res.sendFile(publicLogoPath);
            } catch {
                res.status(404).json({ error: 'Logo not found' });
            }
        }
    });

    // Endpoint para obtener la configuración del logo (usado por el frontend)
    app.get('/api/settings/logo', async (req, res) => {
        try {
            // Primero verificamos en DB
            const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['logo']);
            if (result.rows.length > 0) {
                return res.json({ logo: '/api/logo' });
            }

            // Fallback a archivos
            const uploadsLogo = path.join(uploadsDir, 'logo.png');
            const publicLogo = path.join(process.cwd(), 'public', 'logo.png');
            
            try {
                await fs.access(uploadsLogo);
                return res.json({ logo: '/api/logo' });
            } catch {
                try {
                    await fs.access(publicLogo);
                    return res.json({ logo: '/api/logo' });
                } catch {
                    return res.json({ logo: null });
                }
            }
        } catch (err) {
            res.json({ logo: null });
        }
    });

    // Servir archivos estáticos de uploads
    app.use('/uploads', express.static(uploadsDir));
    app.use('/uploads/products', express.static(productsDir));

    // Upload Logo/Images
    app.post('/api/upload', upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const type = req.query.type;
        const factoryId = req.query.factoryId as string;
        
        try {
            // Persistir en base de datos para evitar pérdida en redecloys
            const fileData = await fs.readFile(req.file.path);
            const base64 = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;
            
            if (type === 'logo') {
                await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['logo', base64]);
            } else if (type === 'product' && factoryId) {
                await pool.query('INSERT INTO factory_images (factory_id, image_data) VALUES ($1, $2) ON CONFLICT (factory_id) DO UPDATE SET image_data = $2', [factoryId, base64]);
            }
            
            res.json({ success: true, file: req.file });
        } catch (err: any) {
            console.error('Upload persistence error:', err);
            // Fallback: responder éxito aunque falle la DB (el archivo físico existe temporalmente)
            res.json({ success: true, file: req.file, Warning: 'DB Persistence failed' });
        }
    });

    // Product Images
    app.get('/api/products/:factoryId/image', async (req, res) => {
        const { factoryId } = req.params;

        try {
            // Prioridad: DB
            const result = await pool.query('SELECT image_data FROM factory_images WHERE factory_id = $1', [factoryId]);
            if (result.rows.length > 0) {
                const base64 = result.rows[0].image_data;
                const matches = base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const content = matches[2];
                    const img = Buffer.from(content, 'base64');
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Length': img.length
                    });
                    return res.end(img);
                }
            }
        } catch (err) {
            console.error('DB fetch error for image:', err);
        }

        const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
        
        for (const ext of extensions) {
            const imgPath = path.join(productsDir, `${factoryId}${ext}`);
            try {
                await fs.access(imgPath);
                return res.sendFile(imgPath);
            } catch {
                continue;
            }
        }
        res.status(404).send('Image not found');
    });

    // Bulk Image Upload
    app.post('/api/products/images/bulk', upload.array('files', 100), async (req, res) => {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const stats = { success: 0, failed: 0 };

        for (const file of files) {
            try {
                const originalName = file.originalname;
                const factoryId = path.parse(originalName).name.trim();
                
                // Persistir en DB
                const fileData = await fs.readFile(file.path);
                const base64 = `data:${file.mimetype};base64,${fileData.toString('base64')}`;
                await pool.query('INSERT INTO factory_images (factory_id, image_data) VALUES ($1, $2) ON CONFLICT (factory_id) DO UPDATE SET image_data = $2', [factoryId, base64]);
                
                stats.success++;
            } catch (err) {
                console.error('Error processing bulk file:', err);
                stats.failed++;
            }
        }

        res.json({ success: true, stats });
    });

    // --- GENERIC API IMPLEMENTATION ---

    const entities = ['products', 'stock', 'movements', 'locations', 'users'];

    app.get('/api/:entity', async (req, res) => {
        const { entity } = req.params;
        if (!entities.includes(entity)) return res.status(404).json({ error: 'Invalid entity' });

        if (isPgActive) {
            try {
                const currentPool = getPool();
                const result = await currentPool.query(`SELECT * FROM ${entity}`);
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

        const currentPool = getPool();
        if (isPgActive && currentPool) {
            try {
                if (Array.isArray(newItem)) {
                    // Bulk replace for simple entities
                    await currentPool.query('BEGIN');
                    await currentPool.query(`DELETE FROM ${entity}`);
                    for (const item of newItem) {
                        const keys = Object.keys(item);
                        const values = Object.values(item);
                        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                        await currentPool.query(`INSERT INTO ${entity} (${keys.join(',')}) VALUES (${placeholders})`, values);
                    }
                    await currentPool.query('COMMIT');
                } else {
                    const keys = Object.keys(newItem);
                    const values = Object.values(newItem);
                    const quotedKeys = keys.map(k => `"${k}"`).join(',');
                    const idField = entity === 'products' ? 'id_venta' : 'id';
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
                    const updates = keys.map((k, i) => `"${k}" = $${i + 1}`).join(',');
                    
                    await currentPool.query(`
                        INSERT INTO ${entity} (${quotedKeys}) 
                        VALUES (${placeholders}) 
                        ON CONFLICT ("${idField}") DO UPDATE SET ${updates}`, values);
                }
                res.json({ success: true });
            } catch (err: any) {
                await currentPool.query('ROLLBACK').catch(() => {});
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
