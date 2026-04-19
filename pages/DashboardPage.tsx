import React, { useEffect, useState, useMemo } from 'react';
import Card from '../components/Card';
import { useInventory } from '../context/InventoryContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { DollarSign, Archive, AlertTriangle, Package, CheckCircle, RefreshCw, TrendingUp, History, Activity, ShoppingCart } from 'lucide-react';
import { analyzeInventoryData } from '../services/geminiService';
import { GeminiInsight } from '../types';
import Button from '../components/Button';

const DashboardPage: React.FC = () => {
    const { products, stock, movements, locations, loading, error, fetchData } = useInventory();
    const [insights, setInsights] = useState<GeminiInsight[]>([]);
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);

    const COLORS = ['#A0522D', '#D2691E', '#CD853F', '#F4A460', '#DEB887', '#BC8F8F', '#8B4513'];

    const inventoryValue = useMemo(() => {
        if (!Array.isArray(stock) || !Array.isArray(products)) return 0;
        return stock.reduce((total, s) => {
            const product = products.find(p => p.id_venta === s.productId);
            return total + (product ? product.cost * s.quantity : 0);
        }, 0);
    }, [stock, products]);

    const potentialRevenue = useMemo(() => {
        if (!Array.isArray(stock) || !Array.isArray(products)) return 0;
        return stock.reduce((total, s) => {
            const product = products.find(p => p.id_venta === s.productId);
            return total + (product ? product.price * s.quantity : 0);
        }, 0);
    }, [stock, products]);

    const potentialMargin = potentialRevenue - inventoryValue;
    
    const totalUnits = useMemo(() => {
        if (!Array.isArray(stock)) return 0;
        return stock.reduce((sum, s) => sum + s.quantity, 0);
    }, [stock]);

    const totalSoldUnits = useMemo(() => {
        if (!Array.isArray(movements)) return 0;
        return movements
            .filter(m => m.type === 'SALE')
            .reduce((sum, m) => sum + m.quantity, 0);
    }, [movements]);
    
    const lowStockItems = useMemo(() => {
        if (!Array.isArray(stock) || !Array.isArray(products)) return 0;
        
        const totalStockByProduct = stock.reduce((acc, s) => {
            acc[s.productId] = (acc[s.productId] || 0) + s.quantity;
            return acc;
        }, {} as Record<string, number>);

        return products.filter(product => {
            const totalStock = totalStockByProduct[product.id_venta] || 0;
            const minStock = product.minStock ?? 2;
            return totalStock < minStock;
        }).length;
    }, [stock, products]);

    const topSellingProducts = useMemo(() => {
        if (!Array.isArray(movements) || !Array.isArray(products)) return [];
        const sales = movements.filter(m => m.type === 'SALE');
        const salesByProduct = sales.reduce((acc, sale) => {
            const product = products.find(p => p.id_venta === sale.productId);
            if(product) {
                acc[product.description] = (acc[product.description] || 0) + sale.quantity;
            }
            return acc;
        }, {} as Record<string, number>);

        return (Object.entries(salesByProduct) as [string, number][])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, ventas]) => ({ name, ventas }));
    }, [movements, products]);

    const stockDistribution = useMemo(() => {
        if (!Array.isArray(stock) || !Array.isArray(locations)) return [];
        
        const distribution = stock.reduce((acc, s) => {
            const location = locations.find(l => l.id === s.locationId);
            const name = location ? location.name : 'Desconocido';
            acc[name] = (acc[name] || 0) + s.quantity;
            return acc;
        }, {} as Record<string, number>);

        return (Object.entries(distribution) as [string, number][])
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));
    }, [stock, locations]);

    const salesTrend = useMemo(() => {
        if (!Array.isArray(movements)) return [];
        
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            const daySales = movements.filter(m => 
                m.type === 'SALE' && 
                new Date(m.timestamp).toISOString().split('T')[0] === date
            );
            const total = daySales.reduce((sum, s) => sum + (s.price || 0) * s.quantity, 0);
            const displayDate = new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
            return { date: displayDate, monto: total };
        });
    }, [movements]);

    const healthScore = useMemo(() => {
        if (products.length === 0) return 100;
        const stockoutPenalty = (lowStockItems / products.length) * 100;
        return Math.max(0, Math.round(100 - stockoutPenalty));
    }, [products.length, lowStockItems]);

    const handleGenerateInsights = async () => {
        setIsLoadingInsights(true);
        try {
            const analysisResult = await analyzeInventoryData(products, stock, movements);
            setInsights(JSON.parse(analysisResult));
        } catch (error) {
            console.error("Gemini insight error:", error);
            setInsights([{
                title: "Análisis no disponible",
                insight: "No se pudieron generar insights.",
                recommendation: "Intente más tarde."
            }]);
        } finally {
            setIsLoadingInsights(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-text-light italic">Cargando tablero...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-primary">Dashboard Ejecutivo</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard icon={DollarSign} title="Valor Inventario" value={`$${inventoryValue.toLocaleString('es-CL')}`} />
                <StatCard icon={TrendingUp} title="Margen Potencial" value={`$${potentialMargin.toLocaleString('es-CL')}`} variant="success" />
                <StatCard icon={Activity} title="Salud Inventario" value={`${healthScore}%`} variant={healthScore > 80 ? 'success' : 'warning'} />
                <StatCard icon={AlertTriangle} title="Items Bajo Stock" value={lowStockItems.toString()} variant="danger" />
                <StatCard icon={Package} title="Total Unidades" value={totalUnits.toString()} />
                <StatCard icon={ShoppingCart} title="Total Ventas" value={totalSoldUnits.toString()} variant="success" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" title="Tendencia de Ventas (7 Días)">
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesTrend}>
                                <defs>
                                    <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#A0522D" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#A0522D" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(v) => `$${v/1000}k`} />
                                <Tooltip formatter={(v: any) => `$${v.toLocaleString('es-CL')}`} />
                                <Area type="monotone" dataKey="monto" stroke="#A0522D" fill="url(#colorMonto)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card title="Insights IA (Gemini)">
                    <div className="space-y-4">
                        {insights.length > 0 ? insights.map((insight, idx) => (
                            <div key={idx} className="border-l-2 border-primary pl-3">
                                <h4 className="font-bold text-primary text-sm">{insight.title}</h4>
                                <p className="text-xs text-text-main mt-1 italic">{insight.insight}</p>
                            </div>
                        )) : (
                            <div className="text-center py-8">
                                <Button onClick={handleGenerateInsights} disabled={isLoadingInsights} size="sm">
                                    {isLoadingInsights ? 'Analizando...' : 'Generar Análisis'}
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Top 5 Productos Vendidos">
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topSellingProducts}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" hide />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="ventas" fill="#A0522D" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card title="Distribución por Bodega">
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stockDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                    {stockDistribution.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: any, title: string, value: string, variant?: string }> = ({ icon: Icon, title, value, variant }) => (
    <Card className="flex items-center">
        <div className="p-3 rounded-full bg-accent mr-4">
            <Icon size={24} className={variant === 'success' ? 'text-success' : variant === 'danger' ? 'text-danger' : 'text-primary'} />
        </div>
        <div>
            <p className="text-xs text-text-light uppercase font-bold tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-text-main">{value}</p>
        </div>
    </Card>
);

export default DashboardPage;
