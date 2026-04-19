import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
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

    // Helper para leer/escribir datos JSON
    const getFilePath = (name: string) => path.join(dataDir, `${name}.json`);

    const readData = async (name: string, defaultValue: any = []) => {
        try {
            const content = await fs.readFile(getFilePath(name), 'utf-8');
            return JSON.parse(content);
        } catch {
            return defaultValue;
        }
    };

    const writeData = async (name: string, data: any) => {
        await fs.writeFile(getFilePath(name), JSON.stringify(data, null, 2));
    };

    // --- API ROUTES ---

    // Health / Status
    app.get('/api/health', (req, res) => {
        res.json({ database: 'connected', server: 'ok' }); // Simulamos conectado
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

    // Data - Generic API
    const entities = ['products', 'stock', 'movements', 'locations', 'users'];

    entities.forEach(entity => {
        app.get(`/api/${entity}`, async (req, res) => {
            const data = await readData(entity, entity === 'users' ? [] : []);
            res.json(data);
        });

        app.post(`/api/${entity}`, async (req, res) => {
            const newItem = req.body;
            const currentData = await readData(entity, []);
            
            // Si es un array, asumimos que queremos reemplazar todo (valla para bulk manual)
            // Pero si es un objeto, lo añadimos o actualizamos
            if (Array.isArray(newItem)) {
                await writeData(entity, newItem);
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
                await writeData(entity, updatedData);
            }
            res.json({ success: true });
        });
    });

    // Stock Update Special
    app.post('/api/stock/update', async (req, res) => {
        const { productId, locationId, quantityChange } = req.body;
        const stockData = await readData('stock', []);
        
        const index = stockData.findIndex((s: any) => s.productId === productId && s.locationId === locationId);
        if (index > -1) {
            stockData[index].quantity += Number(quantityChange);
        } else if (quantityChange > 0) {
            stockData.push({ productId, locationId, quantity: Number(quantityChange) });
        }
        
        await writeData('stock', stockData);
        res.json({ success: true });
    });

    // Bulk Import for Initial Inventory
    app.post('/api/bulk-import', async (req, res) => {
        const { products, stock, movements } = req.body;
        
        if (products) await writeData('products', products);
        if (stock) await writeData('stock', stock);
        if (movements) {
            const currentMovements = await readData('movements', []);
            await writeData('movements', [...movements, ...currentMovements].slice(0, 1000)); // Limitar historial
        }
        
        res.json({ success: true });
    });

    // Clear Data
    app.post('/api/clear', async (req, res) => {
        const { entity } = req.body;
        if (entity && entities.includes(entity)) {
            await writeData(entity, []);
        } else {
            for (const ent of entities) {
                await writeData(ent, ent === 'users' ? [] : []);
            }
        }
        res.json({ success: true });
    });

    // Vite Integration
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${port}`);
    });
}

startServer().catch(console.error);
