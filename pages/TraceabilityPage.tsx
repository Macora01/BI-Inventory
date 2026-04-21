import React, { useState } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { useInventory } from '../context/InventoryContext';
import { Movement, MovementType } from '../types';
import { MOVEMENT_TYPE_MAP } from '../constants';
import { Camera } from 'lucide-react';
import QRScanner from '../components/QRScanner';
import ProductImage from '../components/ProductImage';

interface TraceabilityData {
    history: Movement[];
    initialStock: number;
    currentStock: number;
}

const TraceabilityPage: React.FC = () => {
    const [productId, setProductId] = useState('');
    const [traceabilityData, setTraceabilityData] = useState<TraceabilityData | null>(null);
    const [productNotFound, setProductNotFound] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const { movements, findProductById, locations, stock, revertMovements, addBulkMovements } = useInventory();

    const handleSearch = () => {
        const product = findProductById(productId);
        if (product) {
            const history = movements
                .filter(m => m.productId === productId)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            const initialStock = history
                .filter(m => m.type === MovementType.INITIAL_LOAD)
                .reduce((sum, m) => sum + Number(m.quantity), 0);

            const currentStock = stock
                .filter(s => s.productId === productId)
                .reduce((sum, s) => sum + Number(s.quantity), 0);

            setTraceabilityData({
                history: [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                initialStock,
                currentStock
            });
            setProductNotFound(false);
        } else {
            setTraceabilityData(null);
            setProductNotFound(true);
        }
    };

    const product = traceabilityData ? findProductById(productId) : null;

    const handleQRScan = (decodedText: string) => {
        const upperCode = decodedText.toUpperCase();
        setProductId(upperCode);
        const product = findProductById(upperCode);
        if (product) {
            const history = movements
                .filter(m => m.productId === upperCode)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            const initialStock = history
                .filter(m => m.type === MovementType.INITIAL_LOAD)
                .reduce((sum, m) => sum + Number(m.quantity), 0);

            const currentStock = stock
                .filter(s => s.productId === upperCode)
                .reduce((sum, s) => sum + Number(s.quantity), 0);

            setTraceabilityData({
                history: [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                initialStock,
                currentStock
            });
            setProductNotFound(false);
        } else {
            setTraceabilityData(null);
            setProductNotFound(true);
        }
    };

    // Cálculos para el resumen detallado (ENFOQUE GLOBAL)
    const summary = React.useMemo(() => {
        if (!traceabilityData) return null;
        
        // Entradas reales al sistema (excluyendo transferencias internas)
        const entries = traceabilityData.history
            .filter(m => {
                const isPositive = !(m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId) || m.type === MovementType.REVERSION);
                // Ignoramos carga inicial (es el punto de partida) y transferencias
                return isPositive && 
                       m.type !== MovementType.INITIAL_LOAD && 
                       m.type !== MovementType.TRANSFER_IN;
            })
            .reduce((sum, m) => sum + Number(m.quantity), 0);

        // Salidas reales del sistema (excluyendo transferencias internas)
        const exits = traceabilityData.history
            .filter(m => {
                const isNegative = (m.type === MovementType.SALE || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId) || m.type === MovementType.REVERSION);
                return isNegative;
            })
            .reduce((sum, m) => sum + Number(m.quantity), 0);
            
        // El Stock Esperado GLOBAL es: Cargas Iniciales + Entradas de Mercadería - Ventas - Ajustes de Salida
        // Nota: Las transferencias son net-zero globalmente.
        const expectedStock = traceabilityData.initialStock + entries - exits;
        
        const totalSales = traceabilityData.history
            .filter(m => m.type === MovementType.SALE)
            .reduce((sum, m) => sum + Number(m.quantity), 0);

        return { entries, exits, expectedStock, totalSales };
    }, [traceabilityData]);

    const handleRevertMovement = async (m: Movement) => {
        if (!window.confirm(`¿Está seguro de revertir este movimiento (${MOVEMENT_TYPE_MAP[m.type]})? Se creará una contra-entrada/salida para compensar.`)) return;
        
        try {
            await revertMovements([m]);
            handleSearch(); // Recargar datos
        } catch (err: any) {
            alert("Error al revertir: " + err.message);
        }
    };

    const handleSyncStock = async () => {
        if (!summary || !traceabilityData || !product) return;
        const diff = summary.expectedStock - traceabilityData.currentStock;
        if (diff === 0) return;

        const action = diff > 0 ? 'sumar' : 'restar';
        if (!window.confirm(`¿Desea sincronizar el stock? Se creará un ajuste automático de ${Math.abs(diff)} unidades para que el Stock Actual sea ${summary.expectedStock}.`)) return;

        try {
            // Intentamos aplicar el ajuste a la bodega central por defecto, o a la primera ubicación con stock
            const targetLocation = locations.find(l => l.id === 'BODCENT') || locations[0];
            
            await addBulkMovements([{
                productId: product.id_venta,
                quantity: Math.abs(diff),
                type: MovementType.ADJUSTMENT,
                fromLocationId: diff < 0 ? targetLocation.id : undefined,
                toLocationId: diff > 0 ? targetLocation.id : undefined,
                reason: 'Sincronización automática por discrepancia en trazabilidad'
            }], [{
                productId: product.id_venta,
                locationId: targetLocation.id,
                quantityChange: diff
            }]);
            
            alert("Stock sincronizado correctamente.");
            handleSearch();
        } catch (err: any) {
            alert("Error al sincronizar: " + err.message);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-primary">Trazabilidad de Producto</h2>
            <Card>
                <div className="flex items-end space-x-4">
                    <div className="flex-grow">
                        <label htmlFor="product-search" className="block text-sm font-medium text-text-main">
                            Código de Venta del Producto (ej: BI0001BL)
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input
                                id="product-search"
                                type="text"
                                className="flex-grow p-2 border border-accent rounded-l-md bg-white focus:ring-2 focus:ring-secondary focus:outline-none"
                                value={productId}
                                onChange={(e) => setProductId(e.target.value.toUpperCase())}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={() => setIsScannerOpen(true)}
                                className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-accent bg-accent/20 text-primary hover:bg-accent/40 transition-colors"
                                title="Escanear Código"
                            >
                                <Camera size={20} />
                            </button>
                        </div>
                    </div>
                    <Button onClick={handleSearch}>Buscar</Button>
                </div>
            </Card>

            {isScannerOpen && (
                <QRScanner 
                    onScan={handleQRScan} 
                    onClose={() => setIsScannerOpen(false)} 
                    title="Escanear Etiqueta de Producto"
                />
            )}

            {productNotFound && (
                <Card>
                    <p className="text-center text-danger">Producto con código '{productId}' no encontrado.</p>
                </Card>
            )}

            {traceabilityData && product && (
                <Card title={`Historial de: ${product.description} (${product.id_venta})`}>
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                        <div className="w-full md:w-1/4">
                            <ProductImage 
                                factoryId={product.id_fabrica} 
                                alt={product.description} 
                                className="w-full aspect-square shadow-sm" 
                                image={product.image}
                            />
                        </div>
                        <div className="flex-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 bg-background rounded-md border border-accent h-full items-center">
                                    <div>
                                        <p className="text-xs text-text-light uppercase font-bold">Stock Inicial</p>
                                        <p className="text-xl font-bold text-primary">{traceabilityData.initialStock}</p>
                                    </div>
                                    <div className="border-l border-accent pl-4">
                                        <p className="text-xs text-text-light uppercase font-bold">Ventas</p>
                                        <p className="text-xl font-bold text-danger">-{summary?.totalSales || 0}</p>
                                    </div>
                                    <div className="border-l border-accent pl-4">
                                        <p className="text-xs text-text-light uppercase font-bold">Otros Aj.</p>
                                        <p className="text-xl font-bold text-orange-600">{((summary?.entries || 0) - ((summary?.exits || 0) - (summary?.totalSales || 0))) >= 0 ? '+' : ''}{(summary?.entries || 0) - ((summary?.exits || 0) - (summary?.totalSales || 0))}</p>
                                    </div>
                                    <div className="border-l border-accent pl-4 bg-accent/5 p-2 rounded">
                                        <p className="text-xs text-text-light uppercase font-bold">Stock Esperado</p>
                                        <p className="text-xl font-black text-primary">{summary?.expectedStock || 0}</p>
                                    </div>
                                    <div className="border-l border-accent pl-4 bg-secondary/5 p-2 rounded">
                                        <p className="text-xs text-text-light uppercase font-bold">Stock Actual</p>
                                        <p className={`text-xl font-black ${(summary?.expectedStock !== traceabilityData.currentStock) ? 'text-danger animate-pulse' : 'text-secondary'}`}>
                                            {traceabilityData.currentStock}
                                        </p>
                                        {summary?.expectedStock !== traceabilityData.currentStock && (
                                            <div className="mt-2 space-y-1">
                                                <p className="text-[10px] text-danger font-bold uppercase">Discrepancia Detectada</p>
                                                <button 
                                                    onClick={() => handleSyncStock()}
                                                    className="text-[10px] bg-danger text-white px-2 py-1 rounded hover:bg-danger/80 transition-colors font-bold flex items-center gap-1"
                                                    title="Igualar el Stock Actual al Stock Esperado mediante un ajuste"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                                                    SINCRONIZAR
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-screen">
                         <table className="w-full text-sm text-left text-text-main">
                            <thead className="text-xs text-primary uppercase bg-accent sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Fecha</th>
                                    <th scope="col" className="px-6 py-3">Tipo de Movimiento</th>
                                    <th scope="col" className="px-6 py-3">Origen</th>
                                    <th scope="col" className="px-6 py-3">Destino</th>
                                    <th scope="col" className="px-6 py-3 text-right">Cantidad</th>
                                    <th scope="col" className="px-6 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {traceabilityData.history.map((m) => (
                                    <tr key={m.id} className="bg-background-light border-b border-background hover:bg-accent/5 transition-colors">
                                        <td className="px-6 py-4">{new Date(m.timestamp).toLocaleString('es-CL')}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                                m.type === MovementType.SALE ? 'bg-danger/10 text-danger' : 
                                                m.type === MovementType.INITIAL_LOAD ? 'bg-primary/10 text-primary' :
                                                m.type === MovementType.REVERSION ? 'bg-orange-500/10 text-orange-600' :
                                                'bg-accent/20 text-text-main'
                                            }`}>
                                                {MOVEMENT_TYPE_MAP[m.type] || m.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{locations.find(l => l.id === m.fromLocationId)?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">{locations.find(l => l.id === m.toLocationId)?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${
                                                m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId) || m.type === MovementType.REVERSION
                                                    ? 'text-danger' 
                                                    : 'text-success'
                                            }`}>
                                                {m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId) || m.type === MovementType.REVERSION
                                                    ? `-${m.quantity}` 
                                                    : `+${m.quantity}`}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {m.type !== MovementType.REVERSION && (
                                                <button 
                                                    onClick={() => handleRevertMovement(m)}
                                                    className="p-1 text-text-light hover:text-danger transition-colors"
                                                    title="Revertir este movimiento"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default TraceabilityPage;
