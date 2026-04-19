
export interface User {
  id: string;
  username: string;
  password?: string;
  role: 'admin' | 'user';
}

export interface Product {
  id_venta: string;
  id_fabrica: string;
  description: string;
  price: number;
  cost: number;
  minStock?: number;
  initialStock?: number;
  image?: string;
}

export interface Stock {
  productId: string;
  locationId: string;
  quantity: number;
  criticalStock?: number;
}

export enum MovementType {
  INITIAL_LOAD = 'INITIAL_LOAD',
  PRODUCT_ADDITION = 'PRODUCT_ADDITION',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  SALE = 'SALE',
  ADJUSTMENT = 'ADJUSTMENT'
}

export interface Movement {
  id: string;
  productId: string;
  quantity: number;
  type: MovementType;
  fromLocationId?: string;
  toLocationId?: string;
  timestamp: Date;
  relatedFile?: string;
  price?: number;
  cost?: number;
}

export enum LocationType {
  FIXED_STORE_PERMANENT = 'FIXED_STORE_PERMANENT',
  FIXED_STORE_TEMPORARY = 'FIXED_STORE_TEMPORARY',
  MOBILE_STORE = 'MOBILE_STORE',
  WAREHOUSE = 'WAREHOUSE'
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
}

export const LOCATION_TYPE_MAP: Record<LocationType, string> = {
  [LocationType.FIXED_STORE_PERMANENT]: 'Tienda Fija Permanente',
  [LocationType.FIXED_STORE_TEMPORARY]: 'Tienda Fija Temporal',
  [LocationType.MOBILE_STORE]: 'Tienda Móvil',
  [LocationType.WAREHOUSE]: 'Bodega'
};

export interface ParsedInitialInventory {
  id_venta: string;
  price: number;
  cost: number;
  id_fabrica: string;
  qty: number;
  description: string;
}

export interface ParsedTransfer {
  sitio_inicial: string;
  sitio_final: string;
  id_venta: string;
  qty: number;
}

export interface ParsedSale {
  timestamp: string;
  lugar: string;
  cod_fabrica: string;
  cod_venta: string;
  description: string;
  precio: number;
  qty: number;
}

export interface GeminiInsight {
    title: string;
    insight: string;
    recommendation: string;
}
