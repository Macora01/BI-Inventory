import { MovementType, Location, User, LocationType } from './types';

export const MOVEMENT_TYPE_MAP: Record<MovementType, string> = {
    [MovementType.INITIAL_LOAD]: 'Carga Inicial',
    [MovementType.PRODUCT_ADDITION]: 'Adición de Producto',
    [MovementType.TRANSFER_IN]: 'Entrada de Transferencia',
    [MovementType.TRANSFER_OUT]: 'Salida de Transferencia',
    [MovementType.SALE]: 'Venta',
    [MovementType.ADJUSTMENT]: 'Ajuste de Inventario',
};

export const INITIAL_LOCATIONS: Omit<Location, 'id'>[] = [
    { name: 'Bodega Principal', type: LocationType.WAREHOUSE },
    { name: 'Tienda Central', type: LocationType.FIXED_STORE_PERMANENT },
];

export const INITIAL_USERS: Omit<User, 'id'>[] = [
    { username: 'admin', password: 'admin123', role: 'admin' },
];

export const CSV_HEADERS = {
    INITIAL_INVENTORY: ['id_venta', 'price', 'cost', 'id_fabrica', 'qty', 'description'],
    INITIAL_INVENTORY_ES: ['id_venta', 'precio', 'costo', 'id_fabrica', 'cantidad', 'descripcion'],
    TRANSFER: ['sitio_inicial', 'sitio_final', 'id_venta', 'qty'],
    SALES: ['timestamp', 'lugar', 'cod_fabrica', 'cod_venta', 'description', 'precio', 'qty'],
};
