
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

    const fetchLogo = useCallback(async () => {
        try {
            const res = await fetch('/api/settings/logo');
            if (res.ok) {
                const data = await res.json();
                setLogo(data.logo);
            }
        } catch (err) {
            console.error('Error fetching logo:', err);
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
                    newStock[stockIndex] = { ...newStock[stockIndex], quantity: newStock[stockIndex].quantity + quantityChange };
                    return newStock;
                } else if (quantityChange > 0) {
                    return [...prevStock, { productId, locationId, quantity: quantityChange }];
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
    
    return (
        <InventoryContext.Provider value={{ 
            products, stock, movements, locations, users, 
            addMovement, updateStock, setInitialData, findProductById, clearAllData,
            clearProducts, clearLocations, clearUsers,
            backupData, restoreData,
            addProduct, updateProduct, deleteProduct,
            addLocation, updateLocation, deleteLocation,
            addUser, updateUser, deleteUser,
            loading, error, dbStatus, logo, fetchData, checkHealth, fetchLogo,
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
