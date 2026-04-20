/**
 * MovementsPage.tsx
 * Version: 1.2.004
 */
import React, { useCallback } from 'react';
import Card from '../components/Card';
import FileUpload from '../components/FileUpload';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../hooks/useToast';
import { parseInitialInventoryCSV, parseSalesCSV, parseTransferCSV } from '../services/csvParser';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { MovementType, Product } from '../types';
import { MOVEMENT_TYPE_MAP } from '../constants';

const normalizeName = (name: string) => name.toLowerCase().replace(/[\s_]/g, '');

const MovementsPage: React.FC = () => {
    const { addMovement, updateStock, setInitialData, locations, products, movements, stock, addProduct, updateProduct, addBulkMovements } = useInventory();
    const { addToast } = useToast();

    const getStock = (productId: string, locationId: string) => {
        const item = stock.find(s => s.productId === productId && s.locationId === locationId);
        return item ? item.quantity : 0;
    };

    const processInitialInventory = useCallback(async (content: string, file: File) => {
        const processData = async (data: any[]) => {
            const newProducts: Product[] = [];
            const newStock = [];
            const newMovements = [];

            const normalizeItem = (raw: any) => {
                const norm: any = {};
                for (const k in raw) {
                    const nk = k.toLowerCase().trim().replace(/[\s_]+/g, '');
                    norm[nk] = raw[k];
                }
                return norm;
            };

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const idVenta = String(item.idventa || item.codigo || item.idproducto || item.codventa || '');
                if (!idVenta) continue;

                const product: Product = {
                    id_venta: idVenta,
                    price: Number(item.precio || item.price || 0),
                    cost: Number(item.costo || item.cost || 0),
                    id_fabrica: String(item.idfabrica || item.fabricid || ''),
                    description: String(item.descripcion || item.description || ''),
                };
                newProducts.push(product);
                
                const qty = Number(item.qty || item.cantidad || 0);
                newStock.push({
                    productId: idVenta,
                    locationId: 'main_warehouse',
                    quantity: qty,
                });

                newMovements.push({
                    id: `mov_${Date.now()}_${idVenta}`,
                    productId: idVenta,
                    quantity: qty,
                    type: MovementType.INITIAL_LOAD,
                    toLocationId: 'main_warehouse',
                    timestamp: new Date(),
                    relatedFile: file.name
                });
            }
            await setInitialData(newProducts, newStock, newMovements);
            addToast(`Carga inicial desde '${file.name}' procesada con éxito.`, 'success');
        };

        try {
            if (file.name.endsWith('.xlsx')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    await processData(jsonData);
                };
                reader.readAsArrayBuffer(file);
            } else {
                Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: "",
                    complete: async (results) => {
                        await processData(results.data);
                    }
                });
            }
        } catch (error: any) {
            addToast(`Error procesando archivo inicial: ${error.message}`, 'error');
        }
    }, [setInitialData, addToast]);

    const processAppendInventory = useCallback(async (content: string, file: File) => {
        const processData = async (data: any[]) => {
            let addedCount = 0;
            let updatedCount = 0;

            const normalizeItem = (raw: any) => {
                const norm: any = {};
                for (const k in raw) {
                    const nk = k.toLowerCase().trim().replace(/[\s_]+/g, '');
                    norm[nk] = raw[k];
                }
                return norm;
            };

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const idVenta = String(item.idventa || item.codigo || item.idproducto || item.codventa || '');
                if (!idVenta) continue;

                const existingProduct = products.find(p => p.id_venta === idVenta);
                const qty = Number(item.qty || item.cantidad || 0);
                
                const product: Product = {
                    id_venta: idVenta,
                    price: Number(item.precio || item.price || 0),
                    cost: Number(item.costo || item.cost || 0),
                    id_fabrica: String(item.idfabrica || item.fabricid || ''),
                    description: String(item.descripcion || item.description || ''),
                };

                if (existingProduct) {
                    await updateProduct(product);
                    updatedCount++;
                } else {
                    await addProduct(product);
                    addedCount++;
                }

                const mainLoc = locations.find(l => l.id === 'main_warehouse' || l.id === 'loc_central' || l.type === 'WAREHOUSE') || locations[0];
                if (mainLoc) {
                    await updateStock(idVenta, mainLoc.id, qty);
                    await addMovement({
                        productId: idVenta,
                        quantity: qty,
                        type: MovementType.PRODUCT_ADDITION,
                        toLocationId: mainLoc.id,
                        relatedFile: file.name
                    });
                }
            }
            addToast(`Adición procesada: ${addedCount} nuevos, ${updatedCount} actualizados.`, 'success');
        };

        try {
            if (file.name.endsWith('.xlsx')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    await processData(jsonData);
                };
                reader.readAsArrayBuffer(file);
            } else {
                Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: "",
                    complete: async (results) => {
                        await processData(results.data);
                    }
                });
            }
        } catch (error: any) {
            addToast(`Error procesando adición: ${error.message}`, 'error');
        }
    }, [products, addProduct, updateProduct, updateStock, addMovement, locations, addToast]);

    const processTransfers = useCallback(async (content: string, file: File) => {
        const processData = async (data: any[]) => {
            const errors: string[] = [];
            const movementsToBatch: any[] = [];
            const stockAdjustments: any[] = [];

            // Helper para normalizar llaves
            const normalizeItem = (raw: any) => {
                const norm: any = {};
                for (const k in raw) {
                    const nk = k.toLowerCase().trim().replace(/[\s_]+/g, '');
                    norm[nk] = raw[k];
                }
                return norm;
            };

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const prodId = String(item.idventa || item.codigo || item.idproducto || item.id_venta || '');
                const qty = Number(item.qty || item.cantidad || 0);
                if (!prodId || qty <= 0) continue;

                const fromLocName = String(item.sitioinicial || item.origen || item.inicial || item.sitio_inicial || '');
                const toLocName = String(item.sitiofinal || item.destino || item.final || item.sitio_final || '');

                const fromLoc = locations.find(l => 
                    l.name.toLowerCase().trim() === fromLocName.toLowerCase().trim() ||
                    l.id.toLowerCase().trim() === fromLocName.toLowerCase().trim()
                );
                const toLoc = locations.find(l => 
                    l.name.toLowerCase().trim() === toLocName.toLowerCase().trim() ||
                    l.id.toLowerCase().trim() === toLocName.toLowerCase().trim()
                );

                if (!fromLoc) {
                    const available = locations.slice(0, 10).map(l => `${l.id} (${l.name})`).join(', ');
                    errors.push(`Error: El sitio inicial "${fromLocName}" no existe. Disponibles: ${available}...`);
                    continue;
                }
                if (!toLoc) {
                    const available = locations.slice(0, 10).map(l => `${l.id} (${l.name})`).join(', ');
                    errors.push(`Error: El sitio final "${toLocName}" no existe. Disponibles: ${available}...`);
                    continue;
                }

                const currentStock = getStock(prodId, fromLoc.id);
                if (currentStock < qty) {
                    errors.push(`Error: Stock insuficiente para "${prodId}" en "${fromLocName}". Disponible: ${currentStock}, Requerido: ${qty}.`);
                    continue;
                }

                movementsToBatch.push({
                    productId: prodId,
                    quantity: qty,
                    type: MovementType.TRANSFER_OUT,
                    fromLocationId: fromLoc.id,
                    toLocationId: toLoc.id,
                    relatedFile: file.name
                });
                movementsToBatch.push({
                    productId: prodId,
                    quantity: qty,
                    type: MovementType.TRANSFER_IN,
                    fromLocationId: fromLoc.id,
                    toLocationId: toLoc.id,
                    relatedFile: file.name
                });

                stockAdjustments.push({ productId: prodId, locationId: fromLoc.id, quantityChange: -qty });
                stockAdjustments.push({ productId: prodId, locationId: toLoc.id, quantityChange: qty });
            }

            if (movementsToBatch.length === 0) {
                if (errors.length > 0) {
                    addToast(`No se procesó nada. Errores detectados:\n${errors.slice(0, 5).join('\n')}`, 'error');
                } else {
                    addToast('No se encontraron transferencias válidas en el archivo.', 'warning');
                }
                return;
            }

            await addBulkMovements(movementsToBatch, stockAdjustments);

            if (errors.length > 0) {
                addToast(`Transferencia procesada con errores:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '...' : ''}`, 'warning');
            } else {
                addToast(`Transferencia desde '${file.name}' procesada exitosamente (${movementsToBatch.length / 2} items).`, 'success');
            }
        };

        try {
            if (file.name.endsWith('.xlsx')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    await processData(jsonData);
                };
                reader.readAsArrayBuffer(file);
            } else {
                Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: "",
                    complete: async (results) => {
                        await processData(results.data);
                    }
                });
            }
        } catch (error: any) {
            addToast(`Error procesando transferencia: ${error.message}`, 'error');
        }
    }, [addBulkMovements, locations, addToast, getStock]);

    const processSales = useCallback(async (content: string, file: File) => {
        const processData = async (data: any[]) => {
            const errors: string[] = [];
            const movementsToBatch: any[] = [];
            const stockAdjustments: any[] = [];

            // Helper para normalizar llaves
            const normalizeItem = (raw: any) => {
                const norm: any = {};
                for (const k in raw) {
                    const nk = k.toLowerCase().trim().replace(/[\s_]+/g, '');
                    norm[nk] = raw[k];
                }
                return norm;
            };

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const fechaStr = String(item.fecha || item['fecha(dd-mm-aaa)'] || item.timestamp || '');
                const lugarStr = String(item.lugar || item.tienda || '');
                let idVenta = String(item.idventa || item.codventa || item.codigo || item.idproducto || '');
                let precio = Number(item.precio || item.price || 0);
                let qty = Number(item.qty || item.cantidad || 1);

                // Si hay una columna extra (PapaParse), podría ser el ID de venta desplazado
                const extra = (rawItem as any)['__parsed_extra'];
                if (extra && extra.length === 1) {
                    idVenta = String(rawItem['precio'] || rawItem['price']);
                    precio = Number(extra[0]) || 0;
                }

                if (!idVenta || !lugarStr) continue;

                const fromLocation = locations.find(l => 
                    l.name.toLowerCase().trim() === lugarStr.toLowerCase().trim() ||
                    l.id.toLowerCase().trim() === lugarStr.toLowerCase().trim()
                );

                if (!fromLocation) {
                    const available = locations.slice(0, 10).map(l => `${l.id} (${l.name})`).join(', ');
                    errors.push(`Error: El lugar "${lugarStr}" no existe. Disponibles: ${available}...`);
                    continue;
                }
                
                let timestamp = new Date().toISOString();
                if (fechaStr) {
                    const parts = (String(fechaStr).includes('-') ? String(fechaStr).split('-') : String(fechaStr).split('/')).map(p => p.trim());
                    if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10) - 1;
                        let year = parseInt(parts[2], 10);
                        if (year < 100) year += 2000;
                        timestamp = new Date(year, month, day).toISOString();
                    }
                }

                movementsToBatch.push({
                    productId: idVenta,
                    quantity: qty,
                    type: MovementType.SALE,
                    fromLocationId: fromLocation.id,
                    timestamp: timestamp,
                    price: precio,
                    cost: products.find(p => p.id_venta === idVenta)?.cost,
                    relatedFile: file.name
                });

                stockAdjustments.push({ productId: idVenta, locationId: fromLocation.id, quantityChange: -qty });
            }

            if (movementsToBatch.length === 0) {
                if (errors.length > 0) {
                    addToast(`No se procesó ninguna venta. Errores:\n${errors.slice(0, 3).join('\n')}`, 'error');
                } else {
                    addToast('No se encontraron ventas válidas.', 'warning');
                }
                return;
            }

            try {
                await addBulkMovements(movementsToBatch, stockAdjustments);
                if (errors.length > 0) {
                    addToast(`Ventas procesadas con errores:\n${errors.slice(0, 3).join('\n')}`, 'warning');
                } else {
                    addToast(`Ventas desde '${file.name}' procesadas exitosamente (${movementsToBatch.length} registros).`, 'success');
                }
            } catch (err) {
                addToast('Error al procesar el lote de ventas.', 'error');
            }
        };

        try {
            if (file.name.endsWith('.xlsx')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    await processData(jsonData);
                };
                reader.readAsArrayBuffer(file);
            } else {
                Papa.parse(content, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: "", // Auto detect
                    complete: async (results) => {
                        await processData(results.data);
                    }
                });
            }
        } catch (error: any) {
             addToast(`Error procesando ventas: ${error.message}`, 'error');
        }
    }, [addBulkMovements, locations, addToast, products]);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-primary">Cargar Movimientos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Carga Inicial (Sobrescribe Stock)"><FileUpload onFileProcess={processInitialInventory} title="Cargar Inventario Inicial" /></Card>
                <Card title="Adición de Productos (Suma Stock)"><FileUpload onFileProcess={processAppendInventory} title="Agregar Productos" /></Card>
                <Card title="Transferencias (Traslados)"><FileUpload onFileProcess={processTransfers} title="Cargar Transferencia" /></Card>
                <Card title="Ventas Diarias (Ventas)"><FileUpload onFileProcess={processSales} title="Cargar Ventas" /></Card>
            </div>
            
            <Card title="Últimos Movimientos">
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm text-left text-text-main">
                        <thead className="text-xs text-primary uppercase bg-accent sticky top-0">
                             <tr>
                                <th scope="col" className="px-6 py-3">Fecha</th>
                                <th scope="col" className="px-6 py-3">Producto</th>
                                <th scope="col" className="px-6 py-3">Tipo</th>
                                <th scope="col" className="px-6 py-3 text-right">Cantidad</th>
                                <th scope="col" className="px-6 py-3">Origen</th>
                                <th scope="col" className="px-6 py-3">Destino</th>
                            </tr>
                        </thead>
                        <tbody>
                             {movements.slice(0, 50).map(m => {
                                const product = products.find(p => p.id_venta === m.productId);
                                return (
                                <tr key={m.id} className="bg-background-light border-b border-background">
                                    <td className="px-6 py-4">{new Date(m.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        {product ? `${product.description} (${m.productId})` : m.productId}
                                    </td>
                                    <td className="px-6 py-4">{MOVEMENT_TYPE_MAP[m.type] || m.type}</td>
                                    <td className="px-6 py-4">
                                        <span className={`font-medium ${
                                            m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId)
                                                ? 'text-danger' 
                                                : 'text-success'
                                        }`}>
                                            {m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId)
                                                ? `-${m.quantity}` 
                                                : `+${m.quantity}`}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{locations.find(l => l.id === m.fromLocationId)?.name || 'N/A'}</td>
                                    <td className="px-6 py-4">{locations.find(l => l.id === m.toLocationId)?.name || 'N/A'}</td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default MovementsPage;
