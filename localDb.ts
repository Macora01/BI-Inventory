
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class LocalDB {
    private getFilePath(table: string) {
        return path.join(DATA_DIR, `${table}.json`);
    }

    private readTable(table: string): any[] {
        const filePath = this.getFilePath(table);
        if (!fs.existsSync(filePath)) return [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (e) {
            console.error(`Error reading table ${table}:`, e);
            return [];
        }
    }

    private writeTable(table: string, data: any[]) {
        const filePath = this.getFilePath(table);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    async query(text: string, params: any[] = []): Promise<{ rows: any[], rowCount: number }> {
        const lowerText = text.toLowerCase().trim();
        
        // Simulación muy básica de consultas SQL para persistencia local
        if (lowerText.startsWith('select')) {
            if (lowerText.includes('from products')) {
                let rows = this.readTable('products');
                // Mapeo de nombres de columnas si es necesario
                if (lowerText.includes('min_stock as "minstock"')) {
                    rows = rows.map(p => ({ ...p, minStock: p.min_stock }));
                }
                return { rows, rowCount: rows.length };
            }
            if (lowerText.includes('from locations')) {
                const rows = this.readTable('locations');
                return { rows, rowCount: rows.length };
            }
            if (lowerText.includes('from stock')) {
                let rows = this.readTable('stock');
                rows = rows.map(s => ({ ...s, productId: s.productid || s.productId, locationId: s.locationid || s.locationId }));
                return { rows, rowCount: rows.length };
            }
            if (lowerText.includes('from movements')) {
                const rows = this.readTable('movements');
                return { rows: rows.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), rowCount: rows.length };
            }
            if (lowerText.includes('from users')) {
                const rows = this.readTable('users');
                return { rows, rowCount: rows.length };
            }
            if (lowerText.includes('from settings')) {
                const rows = this.readTable('settings');
                const key = params[0];
                const filtered = key ? rows.filter(r => r.key === key) : rows;
                return { rows: filtered, rowCount: filtered.length };
            }
        }

        if (lowerText.startsWith('insert into products') || lowerText.includes('on conflict (id_venta)')) {
            const [id_venta, id_fabrica, description, price, cost, min_stock, image] = params;
            let products = this.readTable('products');
            const index = products.findIndex(p => p.id_venta === id_venta);
            const newProduct = { id_venta, id_fabrica, description, price, cost, min_stock, image };
            if (index >= 0) products[index] = { ...products[index], ...newProduct };
            else products.push(newProduct);
            this.writeTable('products', products);
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('update products')) {
            if (lowerText.includes('set id_fabrica')) {
                const [id_fabrica, description, price, cost, minStock, image, id] = params;
                let products = this.readTable('products');
                const index = products.findIndex(p => p.id_venta === id);
                if (index >= 0) {
                    products[index] = { ...products[index], id_fabrica, description, price, cost, min_stock: minStock, image };
                    this.writeTable('products', products);
                    return { rows: [], rowCount: 1 };
                }
            } else {
                // Caso de actualización de solo imagen por factoryId
                const [image, factoryId] = params;
                let products = this.readTable('products');
                const index = products.findIndex(p => p.id_fabrica === factoryId);
                if (index >= 0) {
                    products[index].image = image;
                    this.writeTable('products', products);
                    return { rows: [], rowCount: 1 };
                }
            }
            return { rows: [], rowCount: 0 };
        }

        if (lowerText.startsWith('insert into settings')) {
            const [key, value] = params;
            let settings = this.readTable('settings');
            const index = settings.findIndex(s => s.key === key);
            if (index >= 0) settings[index].value = value;
            else settings.push({ key, value });
            this.writeTable('settings', settings);
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('insert into locations')) {
            const [id, name, type] = params;
            let locations = this.readTable('locations');
            const index = locations.findIndex(l => l.id === id);
            const newLoc = { id, name, type };
            if (index >= 0) locations[index] = newLoc;
            else locations.push(newLoc);
            this.writeTable('locations', locations);
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('insert into stock') || lowerText.includes('on conflict (productid, locationid)')) {
            const [productId, locationId, quantity] = params;
            let stock = this.readTable('stock');
            const index = stock.findIndex(s => s.productId === productId && s.locationId === locationId);
            const newStock = { productId, locationId, quantity };
            if (index >= 0) stock[index] = newStock;
            else stock.push(newStock);
            this.writeTable('stock', stock);
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('insert into movements')) {
            const [id, productId, quantity, type, fromLocationId, toLocationId, timestamp, relatedFile, price, cost] = params;
            let movements = this.readTable('movements');
            movements.push({ id, productId, quantity, type, fromLocationId, toLocationId, timestamp, relatedFile, price, cost });
            this.writeTable('movements', movements);
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('insert into users')) {
            const [id, username, password, role] = params;
            let users = this.readTable('users');
            users.push({ id, username, password, role });
            this.writeTable('users', users);
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('delete from products')) {
            const id = params[0];
            let products = this.readTable('products');
            this.writeTable('products', products.filter(p => p.id_venta !== id));
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('delete from locations')) {
            const id = params[0];
            let locations = this.readTable('locations');
            this.writeTable('locations', locations.filter(l => l.id !== id));
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('delete from users')) {
            const id = params[0];
            let users = this.readTable('users');
            this.writeTable('users', users.filter(u => u.id !== id));
            return { rows: [], rowCount: 1 };
        }

        if (lowerText.startsWith('update users')) {
            // Simulación simple para el admin
            return { rows: [], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
    }
}

export const localDb = new LocalDB();
