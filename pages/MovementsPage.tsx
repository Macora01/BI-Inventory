/**
 * MovementsPage.tsx
 * Version: 1.2.020
 */
import React, { useCallback, useMemo, useState } from 'react';
import Card from '../components/Card';
import FileUpload from '../components/FileUpload';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../hooks/useToast';
import { parseInitialInventoryCSV, parseSalesCSV, parseTransferCSV } from '../services/csvParser';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { MovementType, Product, Movement } from '../types';
import { MOVEMENT_TYPE_MAP } from '../constants';
import { RotateCcw, History, UploadCloud, Trash2 } from 'lucide-react';

const normalizeName = (name: string) => name.toLowerCase().replace(/[\s_]/g, '');

const MovementsPage: React.FC = () => {
    const { addMovement, updateStock, setInitialData, locations, products, movements, stock, addProduct, updateProduct, addBulkMovements, revertMovements, deleteMovements } = useInventory();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'loads' | 'history' | 'manage'>('loads');
    const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Centralización de utilidades de parseo/normalización
    const normalizeKey = (k: string) => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    const normalizeItem = useCallback((raw: any) => {
        const norm: any = {};
        for (const k in raw) {
            norm[normalizeKey(k)] = raw[k];
        }
        return norm;
    }, []);

    const getVal = useCallback((item: any, keywords: string[]) => {
        const normKeywords = keywords.map(kw => normalizeKey(kw));
        for (const k in item) {
            if (normKeywords.some(kw => k.includes(kw))) return item[k];
        }
        return undefined;
    }, []);

    const parseDateValue = useCallback((val: any) => {
        if (!val) return new Date().toISOString();
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString();
        }
        const s = String(val).trim();
        if (!s) return new Date().toISOString();

        const parts = (s.includes('-') ? s.split('-') : s.split('/')).map(p => p.trim());
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            if (year < 100) year += 2000;
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date.toISOString();
        }
        const nativeDate = new Date(s);
        return !isNaN(nativeDate.getTime()) ? nativeDate.toISOString() : new Date().toISOString();
    }, []);

    const getStock = (productId: string, locationId: string) => {
        const item = stock.find(s => s.productId === productId && s.locationId === locationId);
        return item ? item.quantity : 0;
    };

    // Helper para buscar ubicaciones con lógica inteligente
    const findLoc = useCallback((searchName: string) => {
        const sn = searchName.toLowerCase().trim();
        if (!sn) return null;
        
        // 1. Exact Match (Nombre o ID)
        let loc = locations.find(l => 
            l.name.toLowerCase().trim() === sn ||
            l.id.toLowerCase().trim() === sn
        );
        if (loc) return loc;

        // 2. Intelligence for Central Warehouse (Bodega)
        const centralTerms = ['bodcen', 'bodcent', 'bodega', 'central', 'bodega central', 'deposito', 'deposito central'];
        if (centralTerms.includes(sn)) {
            const fallback = locations.find(l => 
                l.id.toUpperCase() === 'BODCEN' || 
                l.id.toUpperCase() === 'BODCENT' ||
                l.name.toLowerCase().includes('bodega') ||
                l.name.toLowerCase().includes('central') ||
                l.id.toLowerCase().includes('cen')
            );
            if (fallback) return fallback;
        }

        // 3. Fuzzy search: Start with, then contains
        loc = locations.find(l => l.name.toLowerCase().startsWith(sn) || l.id.toLowerCase().startsWith(sn));
        if (loc) return loc;

        return locations.find(l => l.name.toLowerCase().includes(sn) || l.id.toLowerCase().includes(sn));
    }, [locations]);

    const processInitialInventory = useCallback(async (content: string, file: File) => {
        const processData = async (data: any[]) => {
            const newProducts: Product[] = [];
            const newStock = [];
            const newMovements = [];

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const idVenta = String(getVal(item, ['idventa', 'codigo', 'idproducto', 'codventa']) || '').trim();
                if (!idVenta) continue;

                const product: Product = {
                    id_venta: idVenta,
                    price: Number(getVal(item, ['precio', 'price', 'venta']) || 0),
                    cost: Number(getVal(item, ['costo', 'cost']) || 0),
                    id_fabrica: String(getVal(item, ['idfabrica', 'fabricid', 'fabrica']) || ''),
                    description: String(getVal(item, ['descripcion', 'description', 'nombre']) || ''),
                };
                newProducts.push(product);
                
                const qty = Number(getVal(item, ['qty', 'cantidad', 'unidades', 'stock']) || 0);
                const timestamp = parseDateValue(getVal(item, ['fecha', 'timestamp', 'date']));

                newStock.push({
                    productId: idVenta,
                    locationId: 'BODCENT',
                    quantity: qty,
                });

                newMovements.push({
                    id: `mov_${Date.now()}_${idVenta}_${Math.random()}`,
                    productId: idVenta,
                    quantity: qty,
                    type: MovementType.INITIAL_LOAD,
                    toLocationId: 'BODCENT',
                    timestamp: timestamp,
                    relatedFile: file.name
                });
            }
            await setInitialData(newProducts, newStock, newMovements);
            addToast(`Carga inicial desde '${file.name}' procesada.`, 'success');
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

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const idVenta = String(getVal(item, ['idventa', 'codigo', 'idproducto', 'codventa']) || '').trim();
                if (!idVenta) continue;

                const existingProduct = products.find(p => p.id_venta === idVenta);
                const qty = Number(getVal(item, ['qty', 'cantidad', 'unidades', 'stock']) || 0);
                const timestamp = parseDateValue(getVal(item, ['fecha', 'timestamp', 'date']));
                
                const product: Product = {
                    id_venta: idVenta,
                    price: Number(getVal(item, ['precio', 'price', 'venta']) || 0),
                    cost: Number(getVal(item, ['costo', 'cost']) || 0),
                    id_fabrica: String(getVal(item, ['idfabrica', 'fabricid', 'fabrica']) || ''),
                    description: String(getVal(item, ['descripcion', 'description', 'nombre']) || ''),
                };

                if (existingProduct) {
                    await updateProduct(product);
                    updatedCount++;
                } else {
                    await addProduct(product);
                    addedCount++;
                }

                const mainLoc = locations.find(l => l.id === 'BODCENT') || locations[0];
                if (mainLoc) {
                    await updateStock(idVenta, mainLoc.id, qty);
                    await addMovement({
                        productId: idVenta,
                        quantity: qty,
                        type: MovementType.PRODUCT_ADDITION,
                        toLocationId: mainLoc.id,
                        timestamp: timestamp,
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
            const errorStats: Record<string, number> = {};
            const movementsToBatch: any[] = [];
            const stockAdjustments: any[] = [];

            for (const rawItem of data) {
                const item = normalizeItem(rawItem);
                const prodId = String(getVal(item, ['idventa', 'codigo', 'idproducto', 'codventa']) || '').trim();
                const qty = Number(getVal(item, ['qty', 'cantidad', 'unidades']) || 0);
                if (!prodId || qty <= 0) continue;

                const fromLocVal = getVal(item, ['sitioinicial', 'origen', 'inicial', 'from', 'sucursalorigen']);
                const toLocVal = getVal(item, ['sitiofinal', 'destino', 'final', 'to', 'sucursaldestino']);
                const timestamp = parseDateValue(getVal(item, ['fecha', 'timestamp', 'date', 'time']));

                const fromLoc = findLoc(String(fromLocVal || ''));
                const toLoc = findLoc(String(toLocVal || ''));

                if (!fromLoc) {
                    errorStats[`Origen "${fromLocVal}" no identificado`] = (errorStats[`Origen "${fromLocVal}" no identificado`] || 0) + 1;
                    continue;
                }
                if (!toLoc) {
                    errorStats[`Destino "${toLocVal}" no identificado`] = (errorStats[`Destino "${toLocVal}" no identificado`] || 0) + 1;
                    continue;
                }

                const currentStock = getStock(prodId, fromLoc.id);
                if (currentStock < qty) {
                    errorStats[`Stock insuficiente (${currentStock}/${qty}) p/ "${prodId}" en "${fromLoc.name}"`] = (errorStats[`Stock insuficiente p/ "${prodId}"`] || 0) + 1;
                    // Opcional: Podríamos permitirlo si el usuario quiere stock negativo, 
                    // pero por ahora seguimos la regla de seguridad del sistema.
                    continue;
                }

                movementsToBatch.push({
                    productId: prodId,
                    quantity: qty,
                    type: MovementType.TRANSFER_OUT,
                    fromLocationId: fromLoc.id,
                    toLocationId: toLoc.id,
                    timestamp: timestamp,
                    relatedFile: file.name
                });
                movementsToBatch.push({
                    productId: prodId,
                    quantity: qty,
                    type: MovementType.TRANSFER_IN,
                    fromLocationId: fromLoc.id,
                    toLocationId: toLoc.id,
                    timestamp: timestamp,
                    relatedFile: file.name
                });

                stockAdjustments.push({ productId: prodId, locationId: fromLoc.id, quantityChange: -qty });
                stockAdjustments.push({ productId: prodId, locationId: toLoc.id, quantityChange: qty });
            }

            if (movementsToBatch.length === 0) {
                const errorSummary = Object.entries(errorStats).map(([msg, count]) => `• ${msg}`).join('\n');
                addToast(`No se pudo procesar nada.\n${errorSummary}`, 'error');
                return;
            }

            await addBulkMovements(movementsToBatch, stockAdjustments);
            
            const errorSummary = Object.entries(errorStats).length > 0 
                ? `\nAdvertencias:\n` + Object.entries(errorStats).map(([msg, count]) => `• ${msg} (x${count})`).join('\n')
                : '';
                
            addToast(`Transferencia procesada (${movementsToBatch.length / 2} productos).${errorSummary}`, errorSummary ? 'warning' : 'success');
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
            const errorStats: Record<string, number> = {};
            const movementsToBatch: any[] = [];
            const stockAdjustments: any[] = [];

            for (const [index, rawItem] of data.entries()) {
                const item = normalizeItem(rawItem);
                
                const fechaVal = getVal(item, ['fecha', 'timestamp', 'date', 'time']);
                const lugarVal = getVal(item, ['lugar', 'tienda', 'sitio', 'location', 'sucursal']);
                
                let idVenta = String(getVal(item, ['idventa', 'codventa', 'codigo', 'idproducto', 'prodid']) || '').trim();
                let precio = Number(getVal(item, ['precio', 'price', 'venta']) || 0);
                let qty = Number(getVal(item, ['qty', 'cantidad', 'unidades']) || 1);

                const extra = (rawItem as any)['__parsed_extra'];
                if (extra && extra.length === 1 && !idVenta) {
                    idVenta = String(rawItem['precio'] || rawItem['price'] || '').trim();
                    precio = Number(extra[0]) || 0;
                }

                if (!idVenta || !lugarVal) continue;

                const fromLocation = findLoc(String(lugarVal));
                if (!fromLocation) {
                    errorStats[`Lugar "${lugarVal}" no encontrado`] = (errorStats[String(lugarVal)] || 0) + 1;
                    continue;
                }

                const product = products.find(p => p.id_venta === idVenta);
                const timestamp = parseDateValue(fechaVal);

                movementsToBatch.push({
                    productId: idVenta,
                    quantity: qty,
                    type: MovementType.SALE,
                    fromLocationId: fromLocation.id,
                    timestamp: timestamp,
                    price: precio,
                    cost: product?.cost || 0,
                    relatedFile: file.name
                });

                stockAdjustments.push({ productId: idVenta, locationId: fromLocation.id, quantityChange: -qty });
            }

            if (movementsToBatch.length === 0) {
                const errorSummary = Object.entries(errorStats).map(([msg, count]) => `• ${msg}`).join('\n');
                addToast(`No se procesó ninguna venta.\n${errorSummary}`, 'error');
                return;
            }

            try {
                await addBulkMovements(movementsToBatch, stockAdjustments);
                addToast(`Ventas desde '${file.name}' procesadas (${movementsToBatch.length} registros).`, 'success');
            } catch (err: any) {
                addToast(`Error en registros masivos: ${err.message}`, 'error');
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

    const handleRevert = async (m: Movement) => {
        if (!confirm('¿Estás seguro de revertir este movimiento? Se creará una acción contraria para ajustar el stock.')) return;
        try {
            await revertMovements([m]);
            addToast('Movimiento revertido correctamente.', 'success');
        } catch (err: any) {
            addToast(`Error al revertir: ${err.message}`, 'error');
        }
    };

    const handleRevertBatch = async (batchMovements: Movement[]) => {
        if (!confirm(`¿Estás seguro de revertir este bloque de ${batchMovements.length} movimientos?`)) return;
        try {
            await revertMovements(batchMovements);
            addToast('Bloque revertido correctamente.', 'success');
        } catch (err: any) {
            addToast(`Error al revertir bloque: ${err.message}`, 'error');
        }
    };

    const handleDeleteMovements = async (ids: string[]) => {
        if (!confirm(`¿Estás seguro de eliminar permanentemente ${ids.length} movimientos? Esta acción NO se puede deshacer y afectará el stock calculado.`)) return;
        setIsDeleting(true);
        try {
            await deleteMovements(ids);
            addToast(`${ids.length} movimientos eliminados correctamente.`, 'success');
            setSelectedMovements([]);
        } catch (err: any) {
            addToast(`Error al eliminar: ${err.message}`, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedMovements(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const filteredMovements = useMemo(() => {
        if (!searchTerm) return movements;
        const lowTerm = searchTerm.toLowerCase();
        return movements.filter(m => 
            m.productId.toLowerCase().includes(lowTerm) ||
            m.id.toLowerCase().includes(lowTerm) ||
            (m.relatedFile && m.relatedFile.toLowerCase().includes(lowTerm))
        );
    }, [movements, searchTerm]);

    const groupedBatches = useMemo(() => {
        const groups: Record<string, Movement[]> = {};
        movements.forEach(m => {
            // Agrupar por relatedFile o por fecha minuto (para acciones manuales)
            const dateKey = new Date(m.timestamp).toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
            const groupKey = m.relatedFile || `Acción Manual - ${dateKey}`;
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(m);
        });
        
        return Object.entries(groups)
            .map(([key, movs]) => ({
                id: key,
                name: key,
                count: movs.length,
                lastTimestamp: new Date(Math.max(...movs.map(mv => new Date(mv.timestamp).getTime()))),
                movements: movs,
                type: movs[0].type
            }))
            .sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime());
    }, [movements]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-primary">Gestión de Movimientos</h2>
                <div className="flex bg-background-dark p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('loads')}
                        className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${activeTab === 'loads' ? 'bg-primary text-white shadow-lg' : 'text-text-light hover:text-primary'}`}
                    >
                        <UploadCloud size={18} />
                        Cargar
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-primary text-white shadow-lg' : 'text-text-light hover:text-primary'}`}
                    >
                        <History size={18} />
                        Historial
                    </button>
                    <button 
                        onClick={() => setActiveTab('manage')}
                        className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${activeTab === 'manage' ? 'bg-primary text-white shadow-lg' : 'text-text-light hover:text-primary'}`}
                    >
                        <Trash2 size={18} />
                        Administrar
                    </button>
                </div>
            </div>

            {activeTab === 'manage' && (
                <div className="space-y-6">
                    <Card title="Administración del Historial">
                        <div className="flex flex-col md:flex-row gap-4 mb-4 justify-between items-center">
                            <div className="relative w-full md:w-96">
                                <input 
                                    type="text"
                                    placeholder="Buscar por ID, Producto o Archivo..."
                                    className="input pl-10 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <History className="absolute left-3 top-2.5 text-text-light" size={18} />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => setSelectedMovements(filteredMovements.slice(0, 100).map(m => m.id))}
                                    className="btn btn-secondary flex-1 md:flex-none"
                                >
                                    Seleccionar 100
                                </button>
                                <button 
                                    onClick={() => handleDeleteMovements(selectedMovements)}
                                    disabled={selectedMovements.length === 0 || isDeleting}
                                    className="btn btn-danger flex-1 md:flex-none flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Borrar ({selectedMovements.length})
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-sm text-left text-text-main">
                                <thead className="text-xs text-primary uppercase bg-accent sticky top-0 z-10">
                                     <tr>
                                        <th scope="col" className="px-4 py-3">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMovements.length > 0 && selectedMovements.length === filteredMovements.slice(0, 50).length}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedMovements(filteredMovements.slice(0, 50).map(m => m.id));
                                                    } else {
                                                        setSelectedMovements([]);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3">Fecha</th>
                                        <th scope="col" className="px-4 py-3">Producto</th>
                                        <th scope="col" className="px-4 py-3">Tipo</th>
                                        <th scope="col" className="px-4 py-3">Cantidad</th>
                                        <th scope="col" className="px-4 py-3">Origen</th>
                                        <th scope="col" className="px-4 py-3">Destino</th>
                                        <th scope="col" className="px-4 py-3">Archivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                     {filteredMovements.slice(0, 100).map(m => {
                                        const product = products.find(p => p.id_venta === m.productId);
                                        return (
                                        <tr key={m.id} className={`border-b border-background transition-colors ${selectedMovements.includes(m.id) ? 'bg-primary/10' : 'bg-background-light hover:bg-accent'}`}>
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedMovements.includes(m.id)}
                                                    onChange={() => toggleSelection(m.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-[11px] whitespace-nowrap">
                                                {new Date(m.timestamp).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{m.productId}</span>
                                                    <span className="text-[10px] text-text-light truncate max-w-[150px]">{product?.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[11px]">{MOVEMENT_TYPE_MAP[m.type] || m.type}</td>
                                            <td className="px-4 py-3 font-bold">{m.quantity}</td>
                                            <td className="px-4 py-3 text-[11px]">{locations.find(l => l.id === m.fromLocationId)?.name || '-'}</td>
                                            <td className="px-4 py-3 text-[11px]">{locations.find(l => l.id === m.toLocationId)?.name || '-'}</td>
                                            <td className="px-4 py-3 text-[10px] text-text-light truncate max-w-[100px]">{m.relatedFile || '-'}</td>
                                        </tr>
                                    );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 text-xs text-text-light italic">
                            Mostrando los últimos 100 movimientos que coinciden con la búsqueda.
                        </div>
                    </Card>
                    
                    <Card title="Reseteo Completo (Peligro)">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-text-light mb-2">¿Quieres borrar absolutamente todo el historial de movimientos y empezar de cero?</p>
                                <p className="text-xs text-danger font-bold">Esto dejará el stock en 0 para todos los productos en todas las bodegas.</p>
                            </div>
                            <button 
                                onClick={() => handleDeleteMovements(movements.map(m => m.id))}
                                className="btn btn-danger-outline flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Borrar Todo ({movements.length})
                            </button>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'loads' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card title="Carga Inicial (Sobrescribe Stock)"><FileUpload onFileProcess={processInitialInventory} title="Cargar Inventario Inicial" /></Card>
                    <Card title="Adición de Productos (Suma Stock)"><FileUpload onFileProcess={processAppendInventory} title="Agregar Productos" /></Card>
                    <Card title="Transferencias (Traslados)"><FileUpload onFileProcess={processTransfers} title="Cargar Transferencia" /></Card>
                    <Card title="Ventas Diarias (Ventas)"><FileUpload onFileProcess={processSales} title="Cargar Ventas" /></Card>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="grid grid-cols-1 gap-6">
                    <Card title="Historial de Acciones Masivas (Batches)">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-text-main">
                                <thead className="text-xs text-primary uppercase bg-accent">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Fecha</th>
                                        <th scope="col" className="px-6 py-3">Origen / Archivo</th>
                                        <th scope="col" className="px-6 py-3">Registros</th>
                                        <th scope="col" className="px-6 py-3">Tipo Principal</th>
                                        <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupedBatches.slice(0, 20).map(batch => (
                                        <tr key={batch.id} className="bg-background-light border-b border-background hover:bg-accent transition-colors">
                                            <td className="px-6 py-4">{batch.lastTimestamp.toLocaleString()}</td>
                                            <td className="px-6 py-4 font-medium">{batch.name}</td>
                                            <td className="px-6 py-4">{batch.count}</td>
                                            <td className="px-6 py-4">{MOVEMENT_TYPE_MAP[batch.type] || batch.type}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => handleRevertBatch(batch.movements)}
                                                    className="inline-flex items-center gap-1 text-danger hover:bg-danger/10 px-2 py-1 rounded transition-all"
                                                    title="Revertir todo este bloque"
                                                >
                                                    <RotateCcw size={14} />
                                                    Revertir Todo
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
            
            <Card title="Últimos Movimientos Individuales">
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
                                <th scope="col" className="px-6 py-3 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                             {movements.slice(0, 50).map(m => {
                                const product = products.find(p => p.id_venta === m.productId);
                                return (
                                <tr key={m.id} className="bg-background-light border-b border-background hover:bg-accent transition-colors">
                                    <td className="px-6 py-4">{new Date(m.timestamp).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        {product ? `${product.description} (${m.productId})` : m.productId}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span>{MOVEMENT_TYPE_MAP[m.type] || m.type}</span>
                                            {m.relatedFile && <span className="text-[10px] text-text-light">{m.relatedFile}</span>}
                                        </div>
                                    </td>
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
                                    <td className="px-6 py-4 text-right">
                                        {m.type !== MovementType.REVERSION && (
                                            <button 
                                                onClick={() => handleRevert(m)}
                                                className="text-text-light hover:text-danger transition-colors p-1"
                                                title="Revertir este movimiento"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </td>
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
