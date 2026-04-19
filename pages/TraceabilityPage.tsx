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
    const { movements, findProductById, locations, stock } = useInventory();

    const handleSearch = () => {
        const product = findProductById(productId);
        if (product) {
            const history = movements
                .filter(m => m.productId === productId)
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            const initialStockMovement = history.find(m => m.type === MovementType.INITIAL_LOAD);
            const initialStock = initialStockMovement ? initialStockMovement.quantity : 0;

            const currentStock = stock
                .filter(s => s.productId === productId)
                .reduce((sum, s) => sum + s.quantity, 0);

            setTraceabilityData({
                history: history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
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
            
            const initialStockMovement = history.find(m => m.type === MovementType.INITIAL_LOAD);
            const initialStock = initialStockMovement ? initialStockMovement.quantity : 0;

            const currentStock = stock
                .filter(s => s.productId === upperCode)
                .reduce((sum, s) => sum + s.quantity, 0);

            setTraceabilityData({
                history: history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                initialStock,
                currentStock
            });
            setProductNotFound(false);
        } else {
            setTraceabilityData(null);
            setProductNotFound(true);
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-background rounded-md border border-accent h-full items-center">
                                <div>
                                    <p className="text-sm text-text-light">Stock Inicial</p>
                                    <p className="text-2xl font-bold text-primary">{traceabilityData.initialStock}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-text-light">Stock Actual</p>
                                    <p className="text-2xl font-bold text-secondary">{traceabilityData.currentStock}</p>
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
                                </tr>
                            </thead>
                            <tbody>
                                {traceabilityData.history.map((m) => (
                                    <tr key={m.id} className="bg-background-light border-b border-background">
                                        <td className="px-6 py-4">{new Date(m.timestamp).toLocaleString('es-CL')}</td>
                                        <td className="px-6 py-4">{MOVEMENT_TYPE_MAP[m.type] || m.type}</td>
                                        <td className="px-6 py-4">{locations.find(l => l.id === m.fromLocationId)?.name || 'N/A'}</td>
                                        <td className="px-6 py-4">{locations.find(l => l.id === m.toLocationId)?.name || 'N/A'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${
                                                m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId)
                                                    ? 'text-danger' 
                                                    : 'text-success'
                                            }`}>
                                                {m.type === MovementType.SALE || m.type === MovementType.TRANSFER_OUT || (m.type === MovementType.ADJUSTMENT && m.fromLocationId && !m.toLocationId)
                                                    ? `-${m.quantity}` 
                                                    : `+${m.quantity}`}
                                            </span>
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
