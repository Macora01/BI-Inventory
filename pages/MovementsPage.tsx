import React, { useCallback } from 'react';
import Card from '../components/Card';
import FileUpload from '../components/FileUpload';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../hooks/useToast';
import { parseInitialInventoryCSV, parseSalesCSV, parseTransferCSV } from '../services/csvParser';
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
        try {
            const parsedData = parseInitialInventoryCSV(content);
            const newProducts: Product[] = [];
            const newStock = [];
            const newMovements = [];

            for (const item of parsedData) {
                const product: Product = {
                    id_venta: item.id_venta,
                    price: item.price,
                    cost: item.cost,
                    id_fabrica: item.id_fabrica,
                    description: item.description,
                };
                newProducts.push(product);
                
                newStock.push({
                    productId: item.id_venta,
                    locationId: 'main_warehouse',
                    quantity: item.qty,
                });

                newMovements.push({
                    id: `mov_${Date.now()}_${item.id_venta}`,
                    productId: item.id_venta,
                    quantity: item.qty,
                    type: MovementType.INITIAL_LOAD,
                    toLocationId: 'main_warehouse',
                    timestamp: new Date(),
                    relatedFile: file.name
                });
            }
            await setInitialData(newProducts, newStock, newMovements);
            addToast(`Carga inicial desde '${file.name}' procesada con éxito.`, 'success');
        } catch (error: any) {
            addToast(`Error procesando archivo inicial: ${error.message}`, 'error');
        }
    }, [setInitialData, addToast]);

    const processAppendInventory = useCallback(async (content: string, file: File) => {
        try {
            const parsedData = parseInitialInventoryCSV(content);
            let addedCount = 0;
            let updatedCount = 0;

            for (const item of parsedData) {
                const existingProduct = products.find(p => p.id_venta === item.id_venta);
                
                const product: Product = {
                    id_venta: item.id_venta,
                    price: item.price,
                    cost: item.cost,
                    id_fabrica: item.id_fabrica,
                    description: item.description,
                };

                if (existingProduct) {
                    await updateProduct(product);
                    updatedCount++;
                } else {
                    await addProduct(product);
                    addedCount++;
                }

                const mainLoc = locations.find(l => l.id === 'main_warehouse' || l.id === 'loc_central') || locations[0];
                if (mainLoc) {
                    await updateStock(item.id_venta, mainLoc.id, item.qty);
                    await addMovement({
                        productId: item.id_venta,
                        quantity: item.qty,
                        type: MovementType.PRODUCT_ADDITION,
                        toLocationId: mainLoc.id,
                        relatedFile: file.name
                    });
                }
            }
            addToast(`Adición procesada: ${addedCount} nuevos, ${updatedCount} actualizados.`, 'success');
        } catch (error: any) {
            addToast(`Error procesando adición: ${error.message}`, 'error');
        }
    }, [products, addProduct, updateProduct, updateStock, addMovement, locations, addToast]);

    const processTransfers = useCallback(async (content: string, file: File) => {
        try {
            const parsedData = parseTransferCSV(content);
            const errors: string[] = [];
            const movementsToBatch: any[] = [];
            const stockAdjustments: any[] = [];

            for (const item of parsedData) {
                const prodId = item.id_venta;
                const qty = Number(item.qty);
                if (!prodId || qty <= 0) continue;

                const fromLoc = locations.find(l => 
                    l.name.toLowerCase() === item.sitio_inicial?.toLowerCase() ||
                    l.id.toLowerCase() === item.sitio_inicial?.toLowerCase()
                );
                const toLoc = locations.find(l => 
                    l.name.toLowerCase() === item.sitio_final?.toLowerCase() ||
                    l.id.toLowerCase() === item.sitio_final?.toLowerCase()
                );

                if (!fromLoc) {
                    errors.push(`Error: El sitio inicial "${item.sitio_inicial}" no existe.`);
                    continue;
                }
                if (!toLoc) {
                    errors.push(`Error: El sitio final "${item.sitio_final}" no existe.`);
                    continue;
                }

                const currentStock = getStock(prodId, fromLoc.id);
                if (currentStock < qty) {
                    errors.push(`Error: Stock insuficiente para "${prodId}" en "${item.sitio_inicial}". Disponible: ${currentStock}, Requerido: ${qty}.`);
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
                addToast('No se encontraron transferencias válidas.', 'warning');
                return;
            }

            await addBulkMovements(movementsToBatch, stockAdjustments);

            if (errors.length > 0) {
                addToast(`Transferencia procesada con errores:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '...' : ''}`, 'warning');
            } else {
                addToast(`Transferencia desde '${file.name}' procesada exitosamente (${movementsToBatch.length / 2} items).`, 'success');
            }
        } catch (error: any) {
            addToast(`Error procesando transferencia: ${error.message}`, 'error');
        }
    }, [addBulkMovements, locations, addToast, getStock]);

    const processSales = useCallback(async (content: string, file: File) => {
        try {
            const Papa = await import('papaparse');
            Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                delimiter: "", // Auto detect
                complete: async (results) => {
                    const data = results.data;
                    const errors: string[] = [];
                    const movementsToBatch: any[] = [];
                    const stockAdjustments: any[] = [];

                    for (const item of data as any[]) {
                        const fechaStr = item['fecha'] || item['fecha(DD-MM-AAA)'] || item['timestamp'];
                        const lugarStr = item['lugar'] || item['tienda'];
                        let idVenta = item['id_venta'] || item['cod_venta'] || item['id venta'] || item['codigo'];
                        let precio = Number(item['precio'] || item['price']) || 0;
                        let qty = Number(item['qty'] || item['cantidad']) || 1;

                        const extra = item['__parsed_extra'];
                        if (extra && extra.length === 1) {
                            idVenta = item['precio'];
                            precio = Number(extra[0]) || 0;
                        }

                        if (!idVenta || !lugarStr) continue;

                        const fromLocation = locations.find(l => 
                            l.name.toLowerCase() === lugarStr.toLowerCase() ||
                            l.id.toLowerCase() === lugarStr.toLowerCase()
                        );

                        if (!fromLocation) {
                            errors.push(`Error: La ubicación '${lugarStr}' no existe.`);
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
                        addToast('No se encontraron ventas válidas.', 'warning');
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
                }
            });
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
