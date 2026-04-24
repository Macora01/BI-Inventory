
/**
 * InventoryContext.tsx
 * Version: 1.1.000
 */
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { Product, Stock, Movement, Location, User, MovementType } from '../types';

// Define la estructura de datos que proporcionará el contexto.
interface InventoryContextType {
    products: Product[];
    stock: Stock[];
    movements: Movement[];
    locations: Location[];
    users: User[];
    
    // Funciones para manipular el estado
    addMovement: (movementData: Omit<Movement, 'id' | 'timestamp'>) => Promise<void>;
    updateStock: (productId: string, locationId: string, quantityChange: number) => Promise<void>;
    setInitialData: (products: Product[], stock: Stock[], movements: Movement[]) => Promise<void>;
    findProductById: (productId: string) => Product | undefined;
    clearAllData: () => Promise<void>;
    clearProducts: () => Promise<void>;
    clearLocations: () => Promise<void>;
    clearUsers: () => Promise<void>;
    backupData: () => Promise<any>;
    restoreData: (data: any) => Promise<void>;
    
    // Funciones CRUD para Productos
    addProduct: (product: Product) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;

    // Funciones CRUD para Ubicaciones
    addLocation: (location: Omit<Location, 'id'>) => Promise<void>;
    updateLocation: (location: Location) => Promise<void>;
    deleteLocation: (locationId: string) => Promise<void>;
    
    // Funciones CRUD para Usuarios
    addUser: (user: Omit<User, 'id'>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;

    // Estado de carga y error
    loading: boolean;
    error: string | null;
    dbStatus: { status: string; database: string; time?: string; error?: string } | null;
    logo: string | null;
    fetchData: () => Promise<void>;
    checkHealth: () => Promise<void>;
    fetchLogo: () => Promise<void>;
    uploadProductImage: (factoryId: string, file: File) => Promise<boolean>;
    bulkUploadImages: (files: FileList) => Promise<{ success: number; failed: number }>;
    returnAllToWarehouse: (locationId: string) => Promise<void>;
    addBulkMovements: (movements: (Omit<Movement, 'id' | 'timestamp'> & { timestamp?: Date | string })[], stockAdjustments: { productId: string, locationId: string, quantityChange: number }[]) => Promise<void>;
    revertMovements: (movements: Movement[]) => Promise<void>;
    
    // Auth
    currentUser: User | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Función auxiliar para generar IDs únicos.
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [stock, setStock] = useState<Stock[]>([]);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dbStatus, setDbStatus] = useState<{ status: string; database: string; time?: string; error?: string } | null>(null);
    const [logo, setLogo] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('inventory_user');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validar que sea un objeto con la propiedad username
                if (parsed && typeof parsed === 'object' && parsed.username) {
                    return parsed;
                }
                localStorage.removeItem('inventory_user');
            } catch (e) {
                localStorage.removeItem('inventory_user');
            }
        }
        return null;
    });

    const login = useCallback(async (username: string, password: string) => {
        // En un entorno real, esto iría a una API. Aquí buscamos en los usuarios locales.
        // O permitimos admin/admin123 por defecto si no hay usuarios.
        const user = users.find(u => u.username === username && u.password === password);
        
        // Hardcoded fallback for admin
        if (user || (username === 'admin' && password === 'admin123')) {
            const authUser: User = user || { id: 'admin', username: 'admin', role: 'admin' };
            setCurrentUser(authUser);
            localStorage.setItem('inventory_user', JSON.stringify(authUser));
            return true;
        }
        return false;
    }, [users]);

    const logout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem('inventory_user');
    }, []);

    const uploadProductImage = useCallback(async (factoryId: string, file: File) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await fetch(`/api/upload?type=product&factoryId=${factoryId}`, {
                method: 'POST',
                body: formData
            });
            return res.ok;
        } catch (err) {
            console.error('Error uploading product image:', err);
            return false;
        }
    }, []);

    const bulkUploadImages = useCallback(async (files: FileList) => {
        try {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            
            const res = await fetch('/api/products/images/bulk', {
                method: 'POST',
                body: formData
            });
            
            if (res.ok) {
                const data = await res.json();
                return data.stats;
            }
            throw new Error('Bulk upload failed');
        } catch (err) {
            console.error('Error uploading images bulk:', err);
            throw err;
        }
    }, []);

    const fetchLogo = useCallback(async () => {
        try {
            const res = await fetch('/api/settings/logo');
            if (res.ok) {
                const data = await res.json();
                // Añadir cache buster para forzar actualización
                const logoUrl = data.logo ? `${data.logo}?t=${Date.now()}` : null;
                setLogo(logoUrl);
            }
        } catch (err) {
            console.error('Error fetching logo:', err);
        }
    }, []);

    const addBulkMovements = useCallback(async (movements: (Omit<Movement, 'id' | 'timestamp'> & { timestamp?: Date | string })[], stockAdjustments: { productId: string, locationId: string, quantityChange: number }[]) => {
        console.log('[DEBUG] addBulkMovements - Payload recibido:', { movementsCount: movements.length, stockAdjCount: stockAdjustments.length });
        const fullMovements = movements.map(m => ({
            ...m,
            id: generateId('mov'),
            timestamp: m.timestamp || new Date().toISOString()
        }));

        try {
            console.log('[DEBUG] Enviando POST a /api/movements/bulk...');
            const response = await fetch('/api/movements/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movements: fullMovements, stockAdjustments })
            });

            console.log('[DEBUG] Respuesta del servidor status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[DEBUG] Error retornado por el servidor:', errorData);
                throw new Error(errorData.error || 'Error en procesamiento masivo');
            }

            const successData = await response.json();
            console.log('[DEBUG] Servidor procesó batch con éxito:', successData);

            // Actualizar localmente para inmediatez
            setMovements(prev => [...fullMovements.map(m => ({ ...m, timestamp: new Date(m.timestamp) })), ...prev]);
            
            setStock(prevStock => {
                const newStock = [...prevStock];
                for (const sa of stockAdjustments) {
                    const idx = newStock.findIndex(s => s.productId === sa.productId && s.locationId === sa.locationId);
                    if (idx > -1) {
                        newStock[idx] = { ...newStock[idx], quantity: Number(newStock[idx].quantity) + Number(sa.quantityChange) };
                    } else {
                        newStock.push({ productId: sa.productId, locationId: sa.locationId, quantity: Number(sa.quantityChange) });
                    }
                }
                return newStock;
            });

        } catch (error) {
            console.error('Error in bulk movements context:', error);
            throw error;
        }
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setDbStatus(data);
        } catch (err) {
            setDbStatus({ status: 'error', database: 'disconnected', error: 'No se pudo contactar con el servidor' });
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        checkHealth();
        try {
            const [pRes, sRes, mRes, lRes, uRes] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/stock'),
                fetch('/api/movements'),
                fetch('/api/locations'),
                fetch('/api/users')
            ]);

            const responses = [pRes, sRes, mRes, lRes, uRes];
            const failedRes = responses.find(r => !r.ok);
            if (failedRes) {
                const errData = await failedRes.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errData.error || `HTTP Error ${failedRes.status}`);
            }

            const pData = await pRes.json();
            const sData = await sRes.json();
            const mData = await mRes.json();
            const lData = await lRes.json();
            const uData = await uRes.json();

            setProducts(pData);
            setStock(sData);
            setMovements(mData.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
            setLocations(lData);
            setUsers(uData);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido al cargar datos';
            console.error('Error fetching data:', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [checkHealth]);

    useEffect(() => {
        fetchData();
        fetchLogo();
    }, [fetchData, fetchLogo]);

    const addMovement = useCallback(async (movementData: Omit<Movement, 'id' | 'timestamp'>) => {
        const id = generateId('mov');
        const timestamp = new Date().toISOString();
        const newMovement = { ...movementData, id, timestamp };

        try {
            await fetch('/api/movements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMovement)
            });
            setMovements(prev => [{ ...newMovement, timestamp: new Date(timestamp) }, ...prev]);
        } catch (error) {
            console.error('Error adding movement:', error);
        }
    }, []);

    const updateStock = useCallback(async (productId: string, locationId: string, quantityChange: number) => {
        try {
            await fetch('/api/stock/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, locationId, quantityChange })
            });
            setStock(prevStock => {
                const stockIndex = prevStock.findIndex(s => s.productId === productId && s.locationId === locationId);
                if (stockIndex > -1) {
                    const newStock = [...prevStock];
                    newStock[stockIndex] = { ...newStock[stockIndex], quantity: Number(newStock[stockIndex].quantity) + Number(quantityChange) };
                    return newStock;
                } else if (quantityChange > 0) {
                    return [...prevStock, { productId, locationId, quantity: Number(quantityChange) }];
                }
                return prevStock;
            });
        } catch (error) {
            console.error('Error updating stock:', error);
        }
    }, []);
    
    const setInitialData = useCallback(async (initialProducts: Product[], initialStock: Stock[], initialMovements: Movement[]) => {
        try {
            const response = await fetch('/api/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    products: initialProducts, 
                    stock: initialStock, 
                    movements: initialMovements 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en la importación masiva');
            }

            await fetchData();
        } catch (error) {
            console.error('Error setting initial data:', error);
            throw error;
        }
    }, [fetchData]);

    const findProductById = useCallback((productId: string) => products.find(p => p.id_venta === productId), [products]);

    const addProduct = useCallback(async (product: Product) => {
        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar el producto');
            }

            await fetchData();
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    }, [fetchData]);

    const updateProduct = useCallback(async (product: Product) => {
        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al actualizar el producto');
            }
            await fetchData();
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }, [fetchData]);

    const deleteProduct = useCallback(async (productId: string) => {
        try {
            const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar el producto');
            }
            await fetchData();
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
        }
    }, [fetchData]);

    const addLocation = useCallback(async (locationData: Omit<Location, 'id'>) => {
        const id = generateId('loc');
        const newLocation = { ...locationData, id };
        try {
            await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLocation)
            });
            await fetchData();
        } catch (error) {
            console.error('Error adding location:', error);
        }
    }, [fetchData]);

    const updateLocation = useCallback(async (updatedLocation: Location) => {
        try {
            await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLocation)
            });
            await fetchData();
        } catch (error) {
            console.error('Error updating location:', error);
        }
    }, [fetchData]);

    const deleteLocation = useCallback(async (locationId: string) => {
        try {
            await fetch(`/api/locations/${locationId}`, { method: 'DELETE' });
            await fetchData();
        } catch (error) {
            console.error('Error deleting location:', error);
        }
    }, [fetchData]);

    const addUser = useCallback(async (userData: Omit<User, 'id'>) => {
        const id = generateId('user');
        const newUser = { ...userData, id };
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            await fetchData();
        } catch (error) {
            console.error('Error adding user:', error);
        }
    }, [fetchData]);

    const updateUser = useCallback(async (updatedUser: User) => {
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedUser)
            });
            await fetchData();
        } catch (error) {
            console.error('Error updating user:', error);
        }
    }, [fetchData]);

    const deleteUser = useCallback(async (userId: string) => {
        try {
            await fetch(`/api/users/${userId}`, { method: 'DELETE' });
            await fetchData();
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    }, [fetchData]);

    const clearAllData = useCallback(async () => {
        try {
            await fetch('/api/clear', { method: 'POST' });
            setProducts([]);
            setStock([]);
            setMovements([]);
            localStorage.removeItem('inventory_user');
            await fetchData();
        } catch (error) {
            console.error('Error clearing data:', error);
        }
    }, [fetchData]);

    const clearProducts = useCallback(async () => {
        try {
            await fetch('/api/clear/products', { method: 'POST' });
            await fetchData();
        } catch (error) {
            console.error('Error clearing products:', error);
        }
    }, [fetchData]);

    const clearLocations = useCallback(async () => {
        try {
            await fetch('/api/clear/locations', { method: 'POST' });
            await fetchData();
        } catch (error) {
            console.error('Error clearing locations:', error);
        }
    }, [fetchData]);

    const clearUsers = useCallback(async () => {
        try {
            await fetch('/api/clear/users', { method: 'POST' });
            localStorage.removeItem('inventory_user');
            await fetchData();
        } catch (error) {
            console.error('Error clearing users:', error);
        }
    }, [fetchData]);

    const backupData = useCallback(async () => {
        try {
            const response = await fetch('/api/backup');
            if (response.ok) {
                return await response.json();
            }
            throw new Error('Error al obtener el respaldo');
        } catch (err) {
            console.error('Error backing up data:', err);
            throw err;
        }
    }, []);

    const restoreData = useCallback(async (data: any) => {
        try {
            const response = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                await fetchData();
            } else {
                throw new Error('Error al restaurar los datos');
            }
        } catch (err) {
            console.error('Error restoring data:', err);
            throw err;
        }
    }, [fetchData]);
    
    const returnAllToWarehouse = useCallback(async (locationId: string) => {
        // Encontrar la bodega central (BODCENT)
        const central = locations.find(l => l.id === 'BODCENT' || l.name?.toUpperCase().includes('BODEGA CENTRAL') || l.name?.toUpperCase() === 'BODEGA');
        if (!central) throw new Error('No se encontró BODCENT');
        if (locationId === central.id) throw new Error('La ubicación de origen ya es BODCENT');
        
        // Obtener stock remanente
        const itemsToReturn = stock.filter(s => s.locationId === locationId && s.quantity > 0);
        if (itemsToReturn.length === 0) return; // Nada que retornar
        
        const movementsBatch: any[] = [];
        const stockAdjustments: any[] = [];
        
        itemsToReturn.forEach(s => {
            const qty = s.quantity;
            // Movimiento de salida
            movementsBatch.push({
                productId: s.productId,
                quantity: qty,
                type: MovementType.TRANSFER_OUT,
                fromLocationId: locationId,
                toLocationId: central.id,
                relatedFile: 'Retorno Masivo (Cierre)'
            });
            // Movimiento de entrada
            movementsBatch.push({
                productId: s.productId,
                quantity: qty,
                type: MovementType.TRANSFER_IN,
                fromLocationId: locationId,
                toLocationId: central.id,
                relatedFile: 'Retorno Masivo (Cierre)'
            });
            
            // Ajustes de stock
            stockAdjustments.push({ productId: s.productId, locationId: locationId, quantityChange: -qty });
            stockAdjustments.push({ productId: s.productId, locationId: central.id, quantityChange: qty });
        });
        
        await addBulkMovements(movementsBatch, stockAdjustments);
    }, [locations, stock, addBulkMovements]);

    /**
     * Compara el stock actual vs la suma de movimientos para detectar discrepancias.
     */
    const checkConsistency = useCallback(async () => {
        const report: any[] = [];
        for (const loc of locations) {
            for (const prod of products) {
                const currentStockItem = stock.find(s => s.productId === prod.id_venta && s.locationId === loc.id);
                const currentStock = currentStockItem ? Number(currentStockItem.quantity) : 0;
                
                // Calcular stock desde movimientos
                let calculated = 0;
                movements.forEach(m => {
                    if (m.productId !== prod.id_venta) return;
                    if (m.toLocationId === loc.id) {
                        if (m.type !== MovementType.TRANSFER_OUT) calculated += Number(m.quantity);
                    }
                    if (m.fromLocationId === loc.id) {
                        if (m.type !== MovementType.TRANSFER_IN) calculated -= Number(m.quantity);
                    }
                });

                if (Math.abs(currentStock - calculated) > 0.001) {
                    report.push({
                        productId: prod.id_venta,
                        description: prod.description,
                        locationId: loc.id,
                        locationName: loc.name,
                        current: currentStock,
                        calculated: calculated,
                        diff: currentStock - calculated
                    });
                }
            }
        }
        return report;
    }, [locations, products, stock, movements]);

    /**
     * Ajusta el stock a lo que digan los movimientos (Sincronización destructiva si faltan movimientos).
     */
    const syncStockFromMovements = useCallback(async () => {
        try {
            // 1. Unificar Catálogos para evitar duplicados por ID/Nombre
            const productMap = new Map<string, string>();
            products.forEach(p => {
                const pid = p.id_venta.trim().toUpperCase();
                productMap.set(pid, p.id_venta);
                if (p.description) productMap.set(p.description.trim().toUpperCase(), p.id_venta);
            });
            
            const locationMap = new Map<string, string>();
            locations.forEach(l => {
                const lid = l.id.trim().toUpperCase();
                locationMap.set(lid, l.id);
                if (l.name) locationMap.set(l.name.trim().toUpperCase(), l.id);
            });

            const uniqueProductIds = Array.from(new Set(products.map(p => p.id_venta.trim().toUpperCase())));
            const uniqueLocationIds = Array.from(new Set(locations.map(l => l.id.trim().toUpperCase())));

            // 2. Filtrar movimientos duplicados de forma agresiva (Mismo producto, cantidad, tipo, ubicaciones y día)
            const uniqueMovements: any[] = [];
            const seenMovements = new Set();
            
            const sortedMovements = [...movements].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            sortedMovements.forEach(m => {
                const pidRaw = m.productId?.trim().toUpperCase();
                const fromLidRaw = m.fromLocationId?.trim().toUpperCase() || 'NONE';
                const toLidRaw = m.toLocationId?.trim().toUpperCase() || 'NONE';
                
                // Traducir a IDs canónicos si es posible
                const pid = productMap.get(pidRaw) ? pidRaw : pidRaw;
                const fromLid = locationMap.get(fromLidRaw) || (fromLidRaw === 'NONE' ? 'NONE' : fromLidRaw);
                const toLid = locationMap.get(toLidRaw) || (toLidRaw === 'NONE' ? 'NONE' : toLidRaw);
                
                // Llave de identidad: Producto + Cantidad + Tipo + Origen + Destino + Timestamp EXACTO
                const key = `${pid}|${m.quantity}|${m.type}|${fromLid}|${toLid}|${m.timestamp}`;
                
                if (!seenMovements.has(key)) {
                    uniqueMovements.push({
                        ...m,
                        productId: pid,
                        fromLocationId: fromLid === 'NONE' ? null : fromLid,
                        toLocationId: toLid === 'NONE' ? null : toLid
                    });
                    seenMovements.add(key);
                }
            });

            // 3. Calcular Stock Real sobre la base unificada
            const realStock: { productId: string, locationId: string, quantity: number }[] = [];
            
            for (const lid of uniqueLocationIds) {
                const canonicalLid = locationMap.get(lid) || lid; // Fallback al ID original si no hay mapa
                for (const pid of uniqueProductIds) {
                    const canonicalPid = productMap.get(pid) || pid; // Fallback al ID original si no hay mapa
                    let calculated = 0;
                    uniqueMovements.forEach(m => {
                        // Comparación flexible: intentamos match exacto normalizado o match por nombre
                        const mPid = m.productId?.trim().toUpperCase();
                        if (mPid === pid) {
                            if (m.toLocationId?.trim().toUpperCase() === lid) {
                                if (m.type !== MovementType.TRANSFER_OUT) calculated += Number(m.quantity);
                            }
                            if (m.fromLocationId?.trim().toUpperCase() === lid) {
                                if (m.type !== MovementType.TRANSFER_IN) calculated -= Number(m.quantity);
                            }
                        }
                    });
                    
                    if (calculated !== 0) {
                        realStock.push({ 
                            productId: canonicalPid, 
                            locationId: canonicalLid, 
                            quantity: calculated 
                        });
                    }
                }
            }

            // 4. Reset Físico (Nuclear): Borrar todo y escribir la verdad calculada
            // FILTRO DE SEGURIDAD: Solo enviar si el ID existe en la tabla maestra (evita error 500 FK)
            const productIdsInDb = new Set(products.map(p => p.id_venta));
            const locationIdsInDb = new Set(locations.map(l => l.id));

            const validStock = realStock.filter(s => 
                productIdsInDb.has(s.productId) && locationIdsInDb.has(s.locationId)
            );

            const response = await fetch('/api/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: validStock, clearStock: true })
            });

            if (response.ok) {
                await fetchData();
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Falla al sincronizar stock nuclear');
            }
        } catch (err) {
            console.error('Error in nuclear sync:', err);
            throw err;
        }
    }, [locations, products, movements, fetchData]);

    /**
     * Genera movimientos de Ajuste para que los movimientos coincidan con el stock actual (Ideal para cargas antiguas sin log).
     */
    const fixMovementsFromStock = useCallback(async () => {
        const discrepancies = await checkConsistency();
        if (discrepancies.length === 0) return;

        const newMovements = discrepancies.map(d => ({
            productId: d.productId,
            quantity: Math.abs(d.diff),
            type: MovementType.ADJUSTMENT,
            toLocationId: d.diff > 0 ? d.locationId : undefined,
            fromLocationId: d.diff < 0 ? d.locationId : undefined,
            timestamp: new Date().toISOString(),
            reason: 'AUTO-SINC: Ajuste para coincidir con stock físico (Carga histórica)',
            relatedFile: 'Sincronización de Sistema'
        }));

        const response = await fetch('/api/movements/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ movements: newMovements, stockAdjustments: [] })
        });

        if (response.ok) {
            await fetchData();
        } else {
            throw new Error('Falla al fijar movimientos');
        }
    }, [checkConsistency, fetchData]);

    const revertMovements = useCallback(async (movementsToRevert: Movement[]) => {
        try {
            const response = await fetch('/api/movements/revert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movements: movementsToRevert })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al revertir movimientos');
            }

            await fetchData();
        } catch (error) {
            console.error('Error in revertMovements context:', error);
            throw error;
        }
    }, [fetchData]);

    return (
        <InventoryContext.Provider value={{ 
            products, stock, movements, locations, users, 
            addMovement, updateStock, setInitialData, findProductById, clearAllData,
            clearProducts, clearLocations, clearUsers,
            backupData, restoreData,
            addProduct, updateProduct, deleteProduct,
            addLocation, updateLocation, deleteLocation,
            addUser, updateUser, deleteUser,
            loading, error, dbStatus, logo, fetchData, checkHealth, fetchLogo, addBulkMovements,
            revertMovements,
            uploadProductImage, bulkUploadImages,
            returnAllToWarehouse,
            checkConsistency, syncStockFromMovements, fixMovementsFromStock,
            currentUser, isAuthenticated: !!currentUser, login, logout
        }}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (context === undefined) {
        throw new Error('useInventory debe ser usado dentro de un InventoryProvider');
    }
    return context;
};
