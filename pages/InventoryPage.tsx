/**
 * InventoryPage.tsx
 * Version: 1.2.020
 */
import React, { useState, useMemo } from 'react';
import Card from '../components/Card';
import { useInventory } from '../context/InventoryContext';
import { Product, Stock, MovementType, Location, ParsedInitialInventory, ParsedTransfer, ParsedSale } from '../types';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Search, Plus, Edit, Trash2, ArrowUpCircle, ArrowDownCircle, Info, Upload, Package, FileText, ShoppingCart, RefreshCw, Camera, AlertCircle } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import Papa from 'papaparse';
import QRScanner from '../components/QRScanner';
import * as XLSX from 'xlsx';
import { APP_VERSION } from '../version';
import ProductImage from '../components/ProductImage';
import BulkImageUpload from '../components/BulkImageUpload';
import { useToast } from '../hooks/useToast';

/**
 * Componente InventoryPage.
 * Muestra una tabla completa de todos los productos, permitiendo a los usuarios
 * ver los niveles de stock en todas las ubicaciones. Incluye funcionalidad de búsqueda,
 * creación, edición, eliminación y ajuste de stock.
 */
const InventoryPage: React.FC = () => {
    const { 
        products, stock, locations, movements,
        addProduct, updateProduct, deleteProduct, 
        updateStock, addMovement, setInitialData, addBulkMovements,
        loading, error, fetchData
    } = useInventory();
    const { addToast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estados para Modales
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isBulkImageModalOpen, setIsBulkImageModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState({
        productId: '',
        fromLocationId: '',
        toLocationId: '',
        quantity: 0,
        reason: ''
    });
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [qrScannerTarget, setQRScannerTarget] = useState<'search' | 'product_id' | 'factory_id'>('search');
    
    // Estado para Producto seleccionado (Edición o Nuevo)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    
    // Estado para subida de imagen de producto
    const [productImageFile, setProductImageFile] = useState<File | null>(null);
    const [uploadingProductImage, setUploadingProductImage] = useState(false);
    const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
    
    // Helper para buscar ubicaciones con lógica inteligente (usado en importaciones)
    const findLoc = (searchName: string) => {
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
    };

    // Estado para Ajuste de Stock
    const [adjustmentData, setAdjustmentData] = useState({
        productId: '',
        locationId: '',
        quantity: 0,
        reason: '',
        type: 'ADD' as 'ADD' | 'REMOVE'
    });

    // Estado para edición rápida en tabla
    const [editingCell, setEditingCell] = useState<{ productId: string, locationId: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [editingMinStock, setEditingMinStock] = useState<string | null>(null);
    const [minStockEditValue, setMinStockEditValue] = useState<string>('');

    // Estado para el motivo obligatorio en edición rápida
    const [isInlineReasonModalOpen, setIsInlineReasonModalOpen] = useState(false);
    const [inlineAdjustmentData, setInlineAdjustmentData] = useState<{
        productId: string;
        locationId: string;
        newValue: number;
        currentQty: number;
        reason: string;
    } | null>(null);

    // Pre-calcular mapa de ventas por producto para eficiencia
    const salesByProduct = useMemo(() => {
        const map: Record<string, number> = {};
        movements.forEach(m => {
            if (m.type === MovementType.SALE) {
                map[m.productId] = (map[m.productId] || 0) + Number(m.quantity);
            }
        });
        return map;
    }, [movements]);

    // Calcular totales por ubicación para el encabezado
    const locationTotals = useMemo(() => {
        const map: Record<string, number> = {};
        stock.forEach(s => {
            map[s.locationId] = (map[s.locationId] || 0) + Number(s.quantity);
        });
        return map;
    }, [stock]);

    // Filtrar ubicaciones que no tienen stock en ningún producto (para simplificar la tabla)
    // Y ordenar para que BOCENT aparezca primero, luego por cantidad total desc
    const activeLocations = useMemo(() => {
        const filtered = locations.filter(loc => 
            stock.some(s => s.locationId === loc.id && Number(s.quantity) !== 0)
        );
        
        const sorted = [...filtered].sort((a, b) => {
            const idA = a.id.toUpperCase();
            const idB = b.id.toUpperCase();
            const isA_BOD = idA === 'BODCENT' || idA === 'BODCEN';
            const isB_BOD = idB === 'BODCENT' || idB === 'BODCEN';

            if (isA_BOD && !isB_BOD) return -1;
            if (!isA_BOD && isB_BOD) return 1;

            const totalA = locationTotals[a.id] || 0;
            const totalB = locationTotals[b.id] || 0;
            
            // Si no son bodega central, ordenamos por total mayor a menor
            return totalB - totalA;
        });

        console.log('[DEBUG] Ubicaciones activas y ordenadas:', sorted.map(l => ({ name: l.name, total: locationTotals[l.id] })));
        return sorted;
    }, [locations, stock, locationTotals]);

    // Total general de ventas
    const globalSalesTotal = useMemo(() => {
        return Object.values(salesByProduct).reduce((sum: number, val: number) => sum + val, 0);
    }, [salesByProduct]);

    // Total general (Stock + Ventas)
    const globalGrandTotal = useMemo(() => {
        const totalStock = Object.values(locationTotals).reduce((sum: number, val: number) => sum + val, 0);
        return totalStock + globalSalesTotal;
    }, [locationTotals, globalSalesTotal]);

    // useMemo para filtrar productos solo cuando la lista de productos o el término de búsqueda cambian.
    const filteredProducts = useMemo(() => {
        if (!searchTerm) {
            return products;
        }
        const lowerSearch = searchTerm.toLowerCase();
        return products.filter(p => 
            p.description.toLowerCase().includes(lowerSearch) ||
            p.id_venta.toLowerCase().includes(lowerSearch) ||
            p.id_fabrica.toLowerCase().includes(lowerSearch)
        );
    }, [products, searchTerm]);

    // Función para obtener el stock de un producto en una ubicación específica.
    const getStockForProductAndLocation = (productId: string, locationId: string): number => {
        const stockItem = stock.find(s => s.productId === productId && s.locationId === locationId);
        return stockItem ? Number(stockItem.quantity) : 0;
    };

    const currentSelectedProduct = useMemo(() => {
        if (!selectedProduct) return null;
        return products.find(p => p.id_venta === selectedProduct.id_venta) || selectedProduct;
    }, [products, selectedProduct]);

    // Manejadores de Producto
    const handleOpenNewProduct = () => {
        setSelectedProduct({ id_venta: '', id_fabrica: '', description: '', price: 0, cost: 0, minStock: 2, initialStock: 0 });
        setIsEditing(false);
        setIsProductModalOpen(true);
    };

    const handleOpenEditProduct = (product: Product) => {
        setSelectedProduct(product);
        setIsEditing(true);
        setIsProductModalOpen(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;
        
        try {
            if (isEditing) {
                await updateProduct(selectedProduct);
                addToast('Producto actualizado con éxito.', 'success');
                
                // Si hay una imagen seleccionada, subirla ahora que el producto está guardado
                if (productImageFile && selectedProduct.id_fabrica) {
                    await handleProductImageUpload(selectedProduct.id_fabrica);
                }
            } else {
                await addProduct(selectedProduct);
                addToast('Producto creado con éxito.', 'success');
                
                // Si hay una imagen seleccionada, subirla
                if (productImageFile && selectedProduct.id_fabrica) {
                    await handleProductImageUpload(selectedProduct.id_fabrica);
                }
            }
            setIsProductModalOpen(false);
            setProductImageFile(null);
        } catch (error) {
            // El error ya se muestra en el alert del contexto
            console.error('Error in handleSaveProduct:', error);
            addToast('Error al guardar el producto.', 'error');
        }
    };

    const handleProductImageUpload = async (factoryId: string) => {
        if (!productImageFile || !factoryId) return;
        setUploadingProductImage(true);
        const formData = new FormData();
        formData.append('file', productImageFile);
        try {
            const response = await fetch(`/api/upload?type=product&factoryId=${factoryId}`, {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                setImageRefreshKey(Date.now());
                await fetchData(); // Recargar datos para obtener la nueva imagen Base64
            } else {
                addToast('Error al subir la imagen del producto.', 'error');
            }
        } catch (err) {
            addToast('Error de red al subir la imagen.', 'error');
        } finally {
            setUploadingProductImage(false);
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        if (window.confirm('¿Está seguro de eliminar este producto? Se borrará también su stock.')) {
            await deleteProduct(productId);
        }
    };

    // Manejadores de Ajuste de Stock
    const handleOpenAdjustment = (productId: string, type: 'ADD' | 'REMOVE') => {
        setAdjustmentData({
            productId,
            locationId: locations[0]?.id || '',
            quantity: 1,
            reason: '',
            type
        });
        setIsAdjustmentModalOpen(true);
    };

    const handleSaveAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        const change = Number(adjustmentData.quantity);
        const relativeChange = adjustmentData.type === 'ADD' ? change : -change;
        
        try {
            await addBulkMovements([
                {
                    productId: adjustmentData.productId,
                    quantity: change,
                    type: MovementType.ADJUSTMENT,
                    fromLocationId: adjustmentData.type === 'REMOVE' ? adjustmentData.locationId : undefined,
                    toLocationId: adjustmentData.type === 'ADD' ? adjustmentData.locationId : undefined,
                    relatedFile: `Ajuste Manual: ${adjustmentData.reason}`
                }
            ], [
                {
                    productId: adjustmentData.productId,
                    locationId: adjustmentData.locationId,
                    quantityChange: relativeChange
                }
            ]);
            setIsAdjustmentModalOpen(false);
            addToast('Ajuste procesado con éxito', 'success');
        } catch (err) {
            addToast('Error al procesar el ajuste', 'error');
        }
    };

    const handleOpenTransfer = (productId: string) => {
        setTransferData({
            productId,
            fromLocationId: locations[0]?.id || '',
            toLocationId: locations[1]?.id || '',
            quantity: 1,
            reason: ''
        });
        setIsTransferModalOpen(true);
    };

    const handleSaveTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (transferData.fromLocationId === transferData.toLocationId) {
            addToast('El origen y el destino no pueden ser iguales.', 'error');
            return;
        }

        const currentFromStock = getStockForProductAndLocation(transferData.productId, transferData.fromLocationId);
        if (currentFromStock < transferData.quantity) {
            addToast(`Stock insuficiente en la ubicación de origen. Disponible: ${currentFromStock}`, 'error');
            return;
        }

        try {
            // Descontar de origen
            await updateStock(transferData.productId, transferData.fromLocationId, -transferData.quantity);
            // Sumar a destino
            await updateStock(transferData.productId, transferData.toLocationId, transferData.quantity);
            
            // Registrar Movimientos
            await addMovement({
                productId: transferData.productId,
                quantity: transferData.quantity,
                type: MovementType.TRANSFER_OUT,
                fromLocationId: transferData.fromLocationId,
                toLocationId: transferData.toLocationId,
                relatedFile: `Transferencia Manual: ${transferData.reason}`
            });

            await addMovement({
                productId: transferData.productId,
                quantity: transferData.quantity,
                type: MovementType.TRANSFER_IN,
                fromLocationId: transferData.fromLocationId,
                toLocationId: transferData.toLocationId,
                relatedFile: `Transferencia Manual: ${transferData.reason}`
            });

            addToast('Transferencia realizada con éxito.', 'success');
            setIsTransferModalOpen(false);
        } catch (err) {
            console.error('Error en transferencia manual:', err);
            addToast('Error al procesar la transferencia.', 'error');
        }
    };

    /**
     * Maneja la edición rápida de stock directamente en la tabla.
     * Ahora abre un modal para pedir el motivo obligatorio.
     */
    const handleInlineEdit = (productId: string, locationId: string, newValue: number) => {
        const currentQty = getStockForProductAndLocation(productId, locationId);
        const diff = newValue - currentQty;
        
        if (diff === 0) {
            setEditingCell(null);
            return;
        }

        setInlineAdjustmentData({
            productId,
            locationId,
            newValue,
            currentQty,
            reason: ''
        });
        setIsInlineReasonModalOpen(true);
        setEditingCell(null);
    };

    /**
     * Guarda el ajuste rápido después de proporcionar el motivo.
     */
    const handleSaveInlineAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inlineAdjustmentData || !inlineAdjustmentData.reason.trim()) {
            addToast('El motivo es obligatorio.', 'error');
            return;
        }

        const { productId, locationId, newValue, currentQty, reason } = inlineAdjustmentData;
        const diff = newValue - currentQty;

        try {
            await updateStock(productId, locationId, diff);
            await addMovement({
                productId,
                quantity: Math.abs(diff),
                type: MovementType.ADJUSTMENT,
                fromLocationId: diff < 0 ? locationId : undefined,
                toLocationId: diff > 0 ? locationId : undefined,
                relatedFile: `Ajuste Rápido (Tabla): ${reason}`
            });
            addToast('Stock actualizado correctamente.', 'success');
            setIsInlineReasonModalOpen(false);
            setInlineAdjustmentData(null);
        } catch (err) {
            console.error('Error en ajuste rápido:', err);
            addToast('Error al actualizar stock.', 'error');
        }
    };

    /**
     * Maneja la edición rápida de stock mínimo directamente en la tabla.
     */
    const handleMinStockEdit = async (productId: string, newValue: number) => {
        const product = products.find(p => p.id_venta === productId);
        if (!product || product.minStock === newValue) {
            setEditingMinStock(null);
            return;
        }

        try {
            await updateProduct({ ...product, minStock: newValue });
            addToast('Stock mínimo actualizado.', 'success');
        } catch (err) {
            console.error('Error al actualizar stock mínimo:', err);
            addToast('Error al actualizar stock mínimo.', 'error');
        } finally {
            setEditingMinStock(null);
        }
    };

    // --- LÓGICA DE IMPORTACIÓN CSV ---
    
    const processInitialInventory = async (content: string, file?: File) => {
        const processData = async (data: any[]) => {
            try {
                const newProducts: Product[] = [];
                const newStock: Stock[] = [];
                const newMovements: any[] = [];
                
                const mainLoc = locations.find(l => l.id === 'main_warehouse' || l.id === 'loc_central') || locations[0];
                
                data.forEach(item => {
                    if (!item.id_venta) return;
                    newProducts.push({
                        id_venta: String(item.id_venta),
                        id_fabrica: String(item.id_fabrica || ''),
                        description: String(item.description || ''),
                        price: Number(item.price) || 0,
                        cost: Number(item.cost) || 0
                    });
                    
                    if (Number(item.qty) > 0) {
                        newStock.push({
                            productId: String(item.id_venta),
                            locationId: mainLoc.id,
                            quantity: Number(item.qty)
                        });
                        newMovements.push({
                            productId: String(item.id_venta),
                            quantity: Number(item.qty),
                            type: MovementType.INITIAL_LOAD,
                            toLocationId: mainLoc.id,
                            timestamp: new Date(),
                            relatedFile: file ? file.name : 'Carga Inicial'
                        });
                    }
                });
                
                await setInitialData(newProducts, newStock, newMovements);
                setIsImportModalOpen(false);
                addToast('Inventario inicial cargado con éxito.', 'success');
            } catch (error: any) {
                console.error('Error procesando inventario:', error);
                addToast(`Error al cargar el inventario: ${error.message}`, 'error');
            }
        };

        if (file && file.name.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
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
    };

    const processProductsOnly = async (content: string, file?: File) => {
        const processData = async (data: any[]) => {
            try {
                const productsToUpload: Product[] = data.map(item => ({
                    id_venta: String(item.id_venta),
                    id_fabrica: String(item.id_fabrica || ''),
                    description: String(item.description || ''),
                    price: Number(item.price) || 0,
                    cost: Number(item.cost) || 0,
                    minStock: Number(item.minStock) || 2
                })).filter(p => p.id_venta);

                if (productsToUpload.length === 0) {
                    addToast('No se encontraron productos válidos en el archivo.', 'error');
                    return;
                }

                // Usamos la API genérica de productos enviando el array completo
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(productsToUpload)
                });

                if (response.ok) {
                    await fetchData();
                    setIsImportModalOpen(false);
                    addToast(`Catálogo actualizado con ${productsToUpload.length} productos.`, 'success');
                } else {
                    throw new Error('Error al subir catálogo');
                }
            } catch (error: any) {
                console.error('Error procesando catálogo:', error);
                addToast(`Error al cargar el catálogo: ${error.message}`, 'error');
            }
        };

        if (file && file.name.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
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
    };

    const processTransfers = async (content: string, file?: File) => {
        const processData = async (data: any[]) => {
            const errorStats: Record<string, number> = {};
            const movementsToBatch: any[] = [];
            const stockAdjustments: any[] = [];

            // Helper para normalizar llaves de objetos (Excel/CSV)
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
                
                // Validar existencia de ubicaciones
                const fromLocNameRaw = String(item.sitioinicial || item.origen || item.inicial || item.sitio_inicial || '');
                const toLocNameRaw = String(item.sitiofinal || item.destino || item.final || item.sitio_final || '');

                const fromLoc = findLoc(fromLocNameRaw);
                const toLoc = findLoc(toLocNameRaw);
                
                if (!fromLoc) {
                    const key = `El sitio "${fromLocNameRaw}" no existe.`;
                    errorStats[key] = (errorStats[key] || 0) + 1;
                    continue;
                }
                if (!toLoc) {
                    const key = `El sitio "${toLocNameRaw}" no existe.`;
                    errorStats[key] = (errorStats[key] || 0) + 1;
                    continue;
                }
                
                // Validar stock en sitio inicial
                const currentStock = getStockForProductAndLocation(prodId, fromLoc.id);
                if (currentStock < qty) {
                    const key = `Stock insuficiente p/ "${prodId}" en "${fromLoc.name}"`;
                    errorStats[key] = (errorStats[key] || 0) + 1;
                    continue;
                }
                
                // Añadir al lote
                movementsToBatch.push({
                    productId: prodId,
                    quantity: qty,
                    type: MovementType.TRANSFER_OUT,
                    fromLocationId: fromLoc.id,
                    toLocationId: toLoc.id,
                    relatedFile: file ? file.name : 'Transferencia Masiva'
                });
                movementsToBatch.push({
                    productId: prodId,
                    quantity: qty,
                    type: MovementType.TRANSFER_IN,
                    fromLocationId: fromLoc.id,
                    toLocationId: toLoc.id,
                    relatedFile: file ? file.name : 'Transferencia Masiva'
                });

                stockAdjustments.push({ productId: prodId, locationId: fromLoc.id, quantityChange: -qty });
                stockAdjustments.push({ productId: prodId, locationId: toLoc.id, quantityChange: qty });
            }

            if (movementsToBatch.length === 0) {
                const errorSummary = Object.entries(errorStats).map(([msg, count]) => `• ${msg} (${count} filas)`).join('\n');
                if (errorSummary) {
                    addToast(`No se pudo procesar nada. Resumen de errores:\n${errorSummary}\n\nUbicaciones recomendadas: ${locations.slice(0, 10).map(l => l.name).join(', ')}`, 'error');
                } else {
                    addToast('No se encontraron movimientos válidos para procesar.', 'warning');
                }
                return;
            }

            try {
                await addBulkMovements(movementsToBatch, stockAdjustments);
                setIsImportModalOpen(false);
                const errorSummary = Object.entries(errorStats).map(([msg, count]) => `• ${msg} (${count} filas)`).join('\n');
                if (errorSummary) {
                    addToast(`Carga completada con fallos parciales:\n${errorSummary}\n\nSe procesaron ${movementsToBatch.length / 2} transferencias.`, 'warning');
                } else {
                    addToast(`¡Éxito! Se procesaron ${movementsToBatch.length / 2} transferencias correctamente.`, 'success');
                }
            } catch (err) {
                addToast('Error crítico al procesar el lote de movimientos.', 'error');
            }
        };

        if (file && file.name.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
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
    };

    const processSales = async (content: string, file?: File) => {
        console.log(`[DEBUG] processSales en InventoryPage - Archivo: ${file?.name || 'CSV directo'}`);
        const processData = async (data: any[]) => {
            console.log(`[DEBUG] Filas detectadas: ${data.length}`);
            const errorStats: Record<string, number> = {};
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
            
            for (const [index, rawItem] of data.entries()) {
                const item = normalizeItem(rawItem);
                
                if (index === 0) {
                    console.log('[DEBUG] Primera fila normalizada:', item);
                }

                const fechaStr = String(item.fecha || item['fecha(dd-mm-aaa)'] || item.timestamp || '');
                const lugarStrRaw = String(item.lugar || item.tienda || '');
                
                let idVenta = String(item.idventa || item.codventa || item.codigo || item.idproducto || '').trim();
                let precio = Number(item.precio || item.price || 0);
                let qty = Number(item.qty || item.cantidad || 1);

                const extra = (item as any)['__parsed_extra'];
                if (extra && extra.length === 1) {
                    idVenta = String((item as any)['precio']).trim();
                    precio = Number(extra[0]) || 0;
                }

                if (!idVenta || !lugarStrRaw) {
                    if (index < 5) console.warn('[DEBUG] Fila incompleta:', { index, idVenta, lugarStrRaw });
                    continue;
                }
                
                const loc = findLoc(lugarStrRaw);
                if (!loc) {
                    const key = `El lugar "${lugarStrRaw}" no existe.`;
                    errorStats[key] = (errorStats[key] || 0) + 1;
                    if (index < 5) console.error(`[DEBUG] Ubicación no encontrada: ${lugarStrRaw}`);
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

                const product = products.find(p => p.id_venta === idVenta);

                movementsToBatch.push({
                    productId: idVenta,
                    quantity: qty,
                    type: MovementType.SALE,
                    fromLocationId: loc.id,
                    timestamp: timestamp,
                    price: precio,
                    cost: product?.cost || 0,
                    relatedFile: file ? file.name : 'Venta Masiva'
                });

                stockAdjustments.push({ productId: idVenta, locationId: loc.id, quantityChange: -qty });
            }

            console.log(`[DEBUG] Registros válidos para procesar: ${movementsToBatch.length}`);

            if (movementsToBatch.length === 0) {
                const errorSummary = Object.entries(errorStats).map(([msg, count]) => `• ${msg} (${count} filas)`).join('\n');
                if (errorSummary) {
                    addToast(`No se procesó nada. Resumen de errores:\n${errorSummary}\n\nUbicaciones reconocidas en el sistema: ${locations.map(l => l.name).join(', ')}`, 'error');
                } else {
                    addToast('No se encontraron ventas válidas en el archivo seleccionado.', 'warning');
                }
                return;
            }

            try {
                console.log('[DEBUG] Invocando addBulkMovements...');
                await addBulkMovements(movementsToBatch, stockAdjustments);
                console.log('[DEBUG] Batch procesado con éxito en el backend.');
                setIsImportModalOpen(false);
                const errorSummary = Object.entries(errorStats).map(([msg, count]) => `• ${msg} (${count} filas)`).join('\n');
                if (errorSummary) {
                    addToast(`Ventas cargadas con fallos parciales:\n${errorSummary}\n\nSe registraron ${movementsToBatch.length} ventas.`, 'warning');
                } else {
                    addToast(`¡Éxito! Se registraron ${movementsToBatch.length} ventas correctamente desde '${file?.name || 'archivo'}'.`, 'success');
                }
            } catch (err: any) {
                console.error('[DEBUG] Error en addBulkMovements:', err);
                addToast(`Error al procesar el lote de ventas: ${err.message}`, 'error');
            }
        };

        if (file && file.name.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
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
    };

    const handleQRScan = (decodedText: string) => {
        const upperCode = decodedText.toUpperCase();
        if (qrScannerTarget === 'search') {
            setSearchTerm(upperCode);
        } else if (qrScannerTarget === 'product_id') {
            setSelectedProduct(prev => prev ? { ...prev, id_venta: upperCode } : null);
        } else if (qrScannerTarget === 'factory_id') {
            setSelectedProduct(prev => prev ? { ...prev, id_fabrica: upperCode } : null);
        }
        setIsQRScannerOpen(false);
    };

    const openScanner = (target: 'search' | 'product_id' | 'factory_id') => {
        setQRScannerTarget(target);
        setIsQRScannerOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-primary">Gestión de Productos e Inventario</h2>
                <div className="flex space-x-2">
                    <Button onClick={() => setIsBulkImageModalOpen(true)} variant="secondary" className="flex items-center">
                        <Upload size={18} className="mr-2" /> Fotos Masivas
                    </Button>
                    <Button onClick={() => setIsImportModalOpen(true)} variant="secondary" className="flex items-center">
                        <Upload size={18} className="mr-2" /> Importar CSV
                    </Button>
                    <Button onClick={handleOpenNewProduct} className="flex items-center">
                        <Plus size={18} className="mr-2" /> Nuevo Producto
                    </Button>
                </div>
            </div>

            <Card>
                <div className="mb-4 flex items-center bg-white border border-accent rounded-md px-3 py-2 max-w-md focus-within:ring-2 focus-within:ring-secondary">
                    <Search size={20} className="text-text-light mr-2" />
                    <input
                        type="text"
                        placeholder="Buscar por descripción, código venta o fábrica..."
                        className="flex-grow bg-transparent focus:outline-none text-text-main"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button 
                        onClick={() => openScanner('search')}
                        className="ml-2 p-1 text-primary hover:bg-accent/20 rounded transition-colors"
                        title="Buscar por QR/Barcode"
                    >
                        <Camera size={20} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-text-main">
                        <thead className="text-xs text-primary uppercase bg-accent">
                            <tr>
                                <th scope="col" className="px-4 py-3">Imagen</th>
                                <th scope="col" className="px-4 py-3">Código Venta / Fábrica</th>
                                <th scope="col" className="px-4 py-3">Descripción</th>
                                {activeLocations.map(loc => (
                                    <th key={loc.id} scope="col" className="px-4 py-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span>{loc.name}</span>
                                            <span className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded-full mt-1 border border-secondary/20">
                                                {locationTotals[loc.id] || 0}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th scope="col" className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center">
                                        <span>Total</span>
                                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1 border border-primary/20">
                                            {globalGrandTotal}
                                        </span>
                                    </div>
                                </th>
                                <th scope="col" className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center">
                                        <span>Ventas</span>
                                        <span className="text-[10px] font-black text-danger bg-danger/10 px-2 py-0.5 rounded-full mt-1 border border-danger/20">
                                            {globalSalesTotal}
                                        </span>
                                    </div>
                                </th>
                                <th scope="col" className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center">
                                        Mín. <Edit size={12} className="ml-1 opacity-50" />
                                    </div>
                                </th>
                                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={locations.length + 4} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                            <p className="text-text-light">Cargando inventario...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={locations.length + 4} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center space-y-4 text-danger">
                                            <AlertCircle size={48} />
                                            <p className="font-bold">Error de Conexión</p>
                                            <p className="text-sm max-w-md">{error}</p>
                                            <button 
                                                onClick={() => fetchData()}
                                                className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                                            >
                                                Reintentar Conexión
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProducts.map(product => {
                                const totalStock = stock
                                    .filter(s => s.productId === product.id_venta)
                                    .reduce((sum, s) => sum + Number(s.quantity), 0);
                                
                                const isLowStock = totalStock < (product.minStock ?? 2);

                                return (
                                    <tr key={product.id_venta} className="bg-background-light border-b border-background hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <ProductImage 
                                                factoryId={product.id_fabrica} 
                                                alt={product.description} 
                                                className="w-12 h-12" 
                                                refreshKey={imageRefreshKey}
                                                image={product.image}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold">{product.id_venta}</div>
                                            <div className="text-xs text-text-light">{product.id_fabrica}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {product.description}
                                            {isLowStock && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-danger text-white">
                                                    Stock Bajo
                                                </span>
                                            )}
                                        </td>
                                        {activeLocations.map(loc => {
                                            const qty = getStockForProductAndLocation(product.id_venta, loc.id);
                                            const minStock = product.minStock ?? 2;
                                            
                                            // Indicador visual por celda
                                            let cellBg = '';
                                            if (qty < minStock && qty > 0) cellBg = 'bg-red-50 text-red-800';
                                            else if (qty === minStock) cellBg = 'bg-yellow-50 text-yellow-800';
                                            else if (qty > 0) cellBg = 'bg-green-50 text-green-800';
                                            else if (qty < 0) cellBg = 'bg-red-200 text-red-900'; // Saldo negativo

                                            const isEditing = editingCell?.productId === product.id_venta && editingCell?.locationId === loc.id;

                                            return (
                                                <td 
                                                    key={loc.id} 
                                                    className={`px-4 py-4 text-center cursor-pointer border-x border-gray-100 transition-all duration-200 group relative ${isEditing ? 'bg-white ring-2 ring-primary ring-inset' : cellBg}`}
                                                    onClick={() => {
                                                        if (!isEditing) {
                                                            setEditingCell({ productId: product.id_venta, locationId: loc.id });
                                                            setEditValue(qty.toString());
                                                        }
                                                    }}
                                                >
                                                    {isEditing ? (
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            className="w-full bg-transparent text-center font-bold outline-none"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                            onBlur={() => handleInlineEdit(product.id_venta, loc.id, parseInt(editValue) || 0)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleInlineEdit(product.id_venta, loc.id, parseInt(editValue) || 0);
                                                                if (e.key === 'Escape') setEditingCell(null);
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center group-hover:scale-110 transition-transform">
                                                            <span className={qty === 0 ? "text-text-light/30 text-xs" : "font-bold"}>{qty}</span>
                                                            <Edit size={8} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className={`px-4 py-4 text-center font-black transition-colors ${
                                            totalStock < (product.minStock ?? 2) ? 'bg-red-100 text-red-900 border-red-200' : 
                                            'bg-accent/30 text-primary border-accent/20'
                                        }`}>
                                            {totalStock + (salesByProduct[product.id_venta] || 0)}
                                        </td>
                                        <td className="px-4 py-4 text-center font-medium text-secondary bg-secondary/5">
                                            {salesByProduct[product.id_venta] || 0}
                                        </td>
                                        <td 
                                            className="px-4 py-4 text-center cursor-pointer hover:bg-accent/10 transition-colors"
                                            onClick={() => {
                                                setEditingMinStock(product.id_venta);
                                                setMinStockEditValue((product.minStock ?? 2).toString());
                                            }}
                                        >
                                            {editingMinStock === product.id_venta ? (
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    className="w-16 p-1 border border-primary rounded text-center outline-none"
                                                    value={minStockEditValue}
                                                    onChange={(e) => setMinStockEditValue(e.target.value)}
                                                    onBlur={() => handleMinStockEdit(product.id_venta, parseInt(minStockEditValue) || 0)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleMinStockEdit(product.id_venta, parseInt(minStockEditValue) || 0);
                                                        if (e.key === 'Escape') setEditingMinStock(null);
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-text-light font-medium">{product.minStock ?? 2}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end space-x-1">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedProduct(product);
                                                        setIsAnalysisModalOpen(true);
                                                    }}
                                                    title="Análisis de Stock"
                                                    className="p-1 text-primary hover:bg-primary/10 rounded"
                                                >
                                                    <Info size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenAdjustment(product.id_venta, 'ADD')}
                                                    title="Aumentar Stock"
                                                    className="p-1 text-success hover:bg-success/10 rounded"
                                                >
                                                    <ArrowUpCircle size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenAdjustment(product.id_venta, 'REMOVE')}
                                                    title="Disminuir Stock"
                                                    className="p-1 text-danger hover:bg-danger/10 rounded"
                                                >
                                                    <ArrowDownCircle size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenTransfer(product.id_venta)}
                                                    title="Transferir Stock"
                                                    className="p-1 text-secondary hover:bg-secondary/10 rounded"
                                                >
                                                    <RefreshCw size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenEditProduct(product)}
                                                    title="Editar Producto"
                                                    className="p-1 text-primary hover:bg-primary/10 rounded"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteProduct(product.id_venta)}
                                                    title="Eliminar Producto"
                                                    className="p-1 text-danger hover:bg-danger/10 rounded"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                             {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={locations.length + 4} className="text-center py-8 text-text-light italic">
                                        No se encontraron productos que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal de Análisis de Producto */}
            <Modal 
                isOpen={isAnalysisModalOpen} 
                onClose={() => setIsAnalysisModalOpen(false)} 
                title={`Análisis de Stock: ${currentSelectedProduct?.description || ''}`}
            >
                <div className="space-y-6">
                    <div className="flex items-center space-x-4 p-4 bg-accent/10 rounded-lg">
                        <ProductImage 
                            factoryId={currentSelectedProduct?.id_fabrica || ''} 
                            alt={currentSelectedProduct?.description || ''} 
                            className="w-20 h-20 shadow-sm"
                            refreshKey={imageRefreshKey}
                            image={currentSelectedProduct?.image}
                        />
                        <div>
                            <h3 className="font-bold text-lg text-primary">{currentSelectedProduct?.description}</h3>
                            <p className="text-sm text-text-light">Código Venta: <span className="font-mono">{currentSelectedProduct?.id_venta}</span></p>
                            <p className="text-sm text-text-light">Código Fábrica: <span className="font-mono">{currentSelectedProduct?.id_fabrica}</span></p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-primary border-b border-accent pb-2">Distribución por Ubicación</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {activeLocations.map(loc => {
                                const qty = getStockForProductAndLocation(selectedProduct?.id_venta || '', loc.id);
                                if (qty === 0) return null;
                                return (
                                    <div key={loc.id} className="flex justify-between items-center p-3 bg-white border border-accent rounded-md shadow-sm">
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 rounded-full bg-primary mr-3"></div>
                                            <span className="font-medium text-text-main">{loc.name}</span>
                                        </div>
                                        <span className="text-lg font-bold text-primary">{qty} uds.</span>
                                    </div>
                                );
                            })}
                            {stock.filter(s => s.productId === selectedProduct?.id_venta && s.quantity > 0).length === 0 && (
                                <div className="text-center py-4 text-text-light italic">
                                    No hay stock disponible en ninguna ubicación.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setIsAnalysisModalOpen(false)}>Cerrar</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Producto (Nuevo/Editar) */}
            <Modal 
                isOpen={isProductModalOpen} 
                onClose={() => setIsProductModalOpen(false)} 
                title={isEditing ? 'Detalles del Producto' : 'Nuevo Producto'}
            >
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/3 flex flex-col items-center">
                        <ProductImage 
                            factoryId={currentSelectedProduct?.id_fabrica || ''} 
                            alt={currentSelectedProduct?.description || 'Producto'} 
                            className="w-full aspect-square mb-4 shadow-md" 
                            refreshKey={imageRefreshKey}
                            image={currentSelectedProduct?.image}
                        />
                        <div className="w-full space-y-2">
                            <label className="block text-[10px] font-medium text-text-light uppercase tracking-wider">Subir Foto</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => setProductImageFile(e.target.files?.[0] || null)}
                                className="block w-full text-[10px] text-text-main file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-accent file:text-primary hover:file:bg-accent/80"
                            />
                            <p className="text-[10px] text-text-light text-center italic">
                                La imagen se guardará como <code className="bg-background p-0.5 rounded">{currentSelectedProduct?.id_fabrica || 'id_fabrica'}.jpg</code>
                            </p>
                        </div>
                    </div>
                    <form onSubmit={handleSaveProduct} className="flex-1 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main">Código Venta (ID Único)</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input 
                                type="text" 
                                required
                                disabled={isEditing}
                                className="flex-grow p-2 border border-accent rounded-l-md bg-white disabled:bg-gray-100"
                                value={selectedProduct?.id_venta || ''}
                                onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, id_venta: e.target.value } : null)}
                            />
                            {!isEditing && (
                                <button
                                    type="button"
                                    onClick={() => openScanner('product_id')}
                                    className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-accent bg-accent/20 text-primary hover:bg-accent/40 transition-colors"
                                    title="Escanear Código"
                                >
                                    <Camera size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Código Fábrica</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input 
                                type="text" 
                                className="flex-grow p-2 border border-accent rounded-l-md bg-white"
                                value={selectedProduct?.id_fabrica || ''}
                                onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, id_fabrica: e.target.value } : null)}
                            />
                            <button
                                type="button"
                                onClick={() => openScanner('factory_id')}
                                className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-accent bg-accent/20 text-primary hover:bg-accent/40 transition-colors"
                                title="Escanear Código"
                            >
                                <Camera size={20} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Descripción</label>
                        <input 
                            type="text" 
                            required
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            value={selectedProduct?.description || ''}
                            onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, description: e.target.value } : null)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-main">Precio Venta</label>
                            <input 
                                type="number" 
                                required
                                className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                                value={selectedProduct?.price || ''}
                                placeholder="0"
                                onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, price: Number(e.target.value) } : null)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-main">Costo</label>
                            <input 
                                type="number" 
                                required
                                className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                                value={selectedProduct?.cost || ''}
                                placeholder="0"
                                onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, cost: Number(e.target.value) } : null)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-main">Stock Mínimo</label>
                            <input 
                                type="number" 
                                required
                                min="0"
                                className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                                value={selectedProduct?.minStock ?? ''}
                                placeholder="Ej: 5"
                                onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, minStock: e.target.value === '' ? undefined : Number(e.target.value) } : null)}
                            />
                        </div>
                        {!isEditing && (
                            <div>
                                <label className="block text-sm font-medium text-text-main">Stock Inicial</label>
                                <input 
                                    type="number" 
                                    required
                                    min="0"
                                    className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                                    value={selectedProduct?.initialStock || ''}
                                    placeholder="0"
                                    onChange={(e) => setSelectedProduct(prev => prev ? { ...prev, initialStock: Number(e.target.value) } : null)}
                                />
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-text-light mt-1">El sistema alertará cuando la suma de todas las bodegas sea menor al stock mínimo.</p>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsProductModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Guardar Producto</Button>
                    </div>
                </form>
            </div>
        </Modal>

            {/* Modal de Transferencia de Stock */}
            <Modal 
                isOpen={isTransferModalOpen} 
                onClose={() => setIsTransferModalOpen(false)} 
                title="Transferencia entre Ubicaciones"
            >
                <form onSubmit={handleSaveTransfer} className="space-y-4">
                    <div className="p-3 bg-secondary/10 rounded-md">
                        <p className="text-sm text-text-main">
                            Transferir <strong>{products.find(p => p.id_venta === transferData.productId)?.description}</strong>
                        </p>
                        <p className="text-xs text-text-light mt-1">
                            Código: {transferData.productId}
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-main">Desde (Origen)</label>
                            <select 
                                className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                                value={transferData.fromLocationId}
                                onChange={(e) => setTransferData(prev => ({ ...prev, fromLocationId: e.target.value }))}
                            >
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-text-light mt-1 pl-1">
                                Disponible: {getStockForProductAndLocation(transferData.productId, transferData.fromLocationId)}
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-main">Hacia (Destino)</label>
                            <select 
                                className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                                value={transferData.toLocationId}
                                onChange={(e) => setTransferData(prev => ({ ...prev, toLocationId: e.target.value }))}
                            >
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main">Cantidad a Transferir</label>
                        <input 
                            type="number" 
                            min="1"
                            max={getStockForProductAndLocation(transferData.productId, transferData.fromLocationId)}
                            required
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            value={transferData.quantity || ''}
                            onChange={(e) => setTransferData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-text-main">Nota / Motivo</label>
                        <textarea 
                            placeholder="Ej: Traslado a tienda, reposición..."
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            rows={2}
                            value={transferData.reason}
                            onChange={(e) => setTransferData(prev => ({ ...prev, reason: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsTransferModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="secondary">Efectuar Transferencia</Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Ajuste de Stock */}
            <Modal 
                isOpen={isAdjustmentModalOpen} 
                onClose={() => setIsAdjustmentModalOpen(false)} 
                title={adjustmentData.type === 'ADD' ? 'Aumentar Stock' : 'Disminuir Stock'}
            >
                <form onSubmit={handleSaveAdjustment} className="space-y-4">
                    <div className="p-3 bg-accent/20 rounded-md flex items-start">
                        <Info size={20} className="text-primary mr-2 mt-0.5" />
                        <p className="text-xs text-text-main">
                            Este ajuste registrará un movimiento de tipo <strong>AJUSTE</strong> en el historial.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Ubicación</label>
                        <select 
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            value={adjustmentData.locationId}
                            onChange={(e) => setAdjustmentData(prev => ({ ...prev, locationId: e.target.value }))}
                        >
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Cantidad</label>
                        <input 
                            type="number" 
                            min="1"
                            required
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            value={adjustmentData.quantity || ''}
                            placeholder="0"
                            onChange={(e) => setAdjustmentData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Razón / Motivo</label>
                        <textarea 
                            required
                            placeholder="Ej: Producto dañado, error de conteo, devolución..."
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            rows={3}
                            value={adjustmentData.reason}
                            onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                        />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsAdjustmentModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant={adjustmentData.type === 'ADD' ? 'primary' : 'danger'}>
                            {adjustmentData.type === 'ADD' ? 'Aumentar' : 'Disminuir'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Motivo para Ajuste Rápido */}
            <Modal 
                isOpen={isInlineReasonModalOpen} 
                onClose={() => {
                    setIsInlineReasonModalOpen(false);
                    setInlineAdjustmentData(null);
                }} 
                title="Motivo del Ajuste"
            >
                <form onSubmit={handleSaveInlineAdjustment} className="space-y-4">
                    <div className="p-3 bg-accent/20 rounded-md">
                        <p className="text-sm text-text-main">
                            Has cambiado el stock de <strong>{inlineAdjustmentData?.currentQty}</strong> a <strong>{inlineAdjustmentData?.newValue}</strong>.
                        </p>
                        <p className="text-xs text-text-light mt-1">
                            Producto: {products.find(p => p.id_venta === inlineAdjustmentData?.productId)?.description}
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Motivo del cambio (Obligatorio)</label>
                        <textarea 
                            autoFocus
                            required
                            placeholder="Ej: Error de conteo, producto dañado, ajuste de inventario..."
                            className="mt-1 block w-full p-2 border border-accent rounded-md bg-white"
                            rows={3}
                            value={inlineAdjustmentData?.reason || ''}
                            onChange={(e) => setInlineAdjustmentData(prev => prev ? { ...prev, reason: e.target.value } : null)}
                        />
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => {
                                setIsInlineReasonModalOpen(false);
                                setInlineAdjustmentData(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit">Confirmar Ajuste</Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Carga Masiva de Imágenes */}
            <Modal
                isOpen={isBulkImageModalOpen}
                onClose={() => setIsBulkImageModalOpen(false)}
                title="Carga Masiva de Fotografías"
            >
                <div className="space-y-4">
                    <p className="text-sm text-text-light italic">
                        Selecciona múltiples archivos. El sistema los asociará automáticamente a los productos usando el <strong>Código de Fábrica</strong> (ej: 7089.jpeg se asignará al producto con código de fábrica 7089).
                    </p>
                    <BulkImageUpload 
                        onSuccess={() => {
                            setIsBulkImageModalOpen(false);
                            setImageRefreshKey(Date.now());
                            fetchData();
                        }} 
                    />
                </div>
            </Modal>

            {/* Modal de Importación (CSV / XLSX) */}
            <Modal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                title="Importar Datos desde CSV / Excel (XLSX)"
            >
                <div className="space-y-6">
                    <p className="text-sm text-text-main">
                        Seleccione el tipo de archivo que desea cargar (Formatos soportados: <strong>.csv</strong> y <strong>.xlsx</strong>). Asegúrese de que el formato coincida con los campos requeridos.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 border border-accent rounded-lg flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-primary flex items-center mb-2">
                                    <Package size={18} className="mr-2" /> Inventario Inicial
                                </h4>
                                <p className="text-xs text-text-light mb-3">Carga masiva de productos y stock inicial.</p>
                            </div>
                            <FileUpload 
                                title="Subir Inventario Inicial"
                                onFileProcess={processInitialInventory} 
                            />
                        </div>

                        <div className="p-4 border border-accent rounded-lg flex flex-col justify-between bg-secondary/5">
                            <div>
                                <h4 className="font-bold text-primary flex items-center mb-2">
                                    <FileText size={18} className="mr-2" /> Catálogo de Productos
                                </h4>
                                <p className="text-xs text-text-light mb-3">Solo productos (id_venta, descripción, precios). No afecta el stock.</p>
                            </div>
                            <FileUpload 
                                title="Subir Solo Productos"
                                onFileProcess={processProductsOnly} 
                            />
                        </div>

                        <div className="p-4 border border-accent rounded-lg flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-primary flex items-center mb-2">
                                    <RefreshCw size={18} className="mr-2" /> Transferencias
                                </h4>
                                <p className="text-xs text-text-light mb-3">Movimientos entre Bodega Central y Almacenes.</p>
                            </div>
                            <FileUpload 
                                title="Subir Transferencias"
                                onFileProcess={processTransfers} 
                            />
                        </div>

                        <div className="p-4 border border-accent rounded-lg flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-primary flex items-center mb-2">
                                    <ShoppingCart size={18} className="mr-2" /> Ventas Diarias
                                </h4>
                                <p className="text-xs text-text-light mb-3">Registro de ventas por almacén. Formato: fecha;lugar;id_venta;precio</p>
                            </div>
                            <FileUpload 
                                title="Subir Ventas"
                                onFileProcess={processSales} 
                            />
                        </div>

                        <div className="p-4 border border-accent rounded-lg bg-gray-50 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-primary flex items-center mb-2">
                                    <Camera size={18} className="mr-2" /> Subida Masiva de Fotos
                                </h4>
                                <p className="text-xs text-text-light mb-3">Sube múltiples fotos de productos de una vez. Los archivos deben llamarse como el ID de Fábrica.</p>
                            </div>
                            <BulkImageUpload onSuccess={() => {
                                setImageRefreshKey(Date.now());
                                fetchData();
                            }} />
                        </div>
                    </div>

                    <div className="bg-background-light p-3 rounded-md border border-accent">
                        <h5 className="text-xs font-bold text-primary uppercase mb-2">Formatos y Cabeceras Esperadas (.csv / .xlsx):</h5>
                        <ul className="text-[10px] space-y-1 text-text-main list-disc pl-4">
                            <li><strong>Catálogo:</strong> id_venta, id_fabrica, description, price, cost, minStock</li>
                            <li><strong>Inventario Inicial:</strong> id_venta, id_fabrica, description, price, cost, qty</li>
                            <li><strong>Transferencias:</strong> sitio_inicial, sitio_final, id_venta, qty <br/>
                                <span className="text-[9px] text-text-light italic">(Ej: Bodega Central, Vitacura, PROD01, 10)</span>
                            </li>
                            <li><strong>Ventas Diarias:</strong> fecha; lugar; id_venta; precio <br/>
                                <span className="text-[9px] text-text-light italic">(Ej: 31-03-2024; Vitacura; VENTA01; 100)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </Modal>

            {isQRScannerOpen && (
                <QRScanner 
                    onScan={handleQRScan} 
                    onClose={() => setIsQRScannerOpen(false)} 
                    title={
                        qrScannerTarget === 'search' ? "Buscar Producto" : 
                        qrScannerTarget === 'product_id' ? "Escanear Código Venta" : 
                        "Escanear Código Fábrica"
                    }
                />
            )}
        </div>
    );
};

export default InventoryPage;
