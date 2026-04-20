import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { useInventory } from '../context/InventoryContext';
import { Location, User, LocationType, LOCATION_TYPE_MAP } from '../types';
import Modal from '../components/Modal';
import { Edit, Trash2, Database, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Upload, Download, FileUp, RotateCcw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { APP_VERSION } from '../version';

const CHANGELOG = [
    {
        version: "1.2.015",
        date: "2026-04-20",
        title: "Gestión Multimedia",
        changes: [
            "Carga Masiva de Fotos: Nueva opción para subir múltiples fotos simultáneamente vinculadas por Código de Fábrica.",
            "Fotos Individuales: Integrada la subida de foto directamente en el formulario de creación/edición de producto.",
            "Compatibilidad Ampliada: Soporte para formatos .jpg, .jpeg, .png y .webp con detección automática.",
            "Optimización de Servidor: Nuevo motor de procesamiento de imágenes masivo para mayor velocidad."
        ]
    },
    {
        version: "1.2.014",
        date: "2026-04-20",
        title: "Reparación de Base de Datos",
        changes: [
            "Hotfix Crítico: Reparado error en la base de datos que impedía guardar ventas por falta de columnas de precio/costo.",
            "Estabilidad de Batch: Optimizado el proceso de guardado masivo para evitar fallos de esquema.",
            "Confirmación de Orden: Reforzada la prioridad de BODCENT y el orden por volumen de stock en la grilla."
        ]
    },
    {
        version: "1.2.013",
        date: "2026-04-20",
        title: "Sniffer & Orden Inteligente",
        changes: [
            "Modo Sniffer: Implementado registro detallado (logs) en consola para rastrear por qué una carga de ventas no genera movimientos.",
            "Orden de Columnas Pro: BOCENT siempre primero, seguido del resto de almacenes ordenados por volumen de stock (mayor a menor).",
            "Depuración de Lógica: Unificada y robustecida la limpieza de IDs y nombres en todos los puntos de importación.",
            "Consistencia de Datos: Verificación adicional de costos de producto durante el registro de ventas masivas."
        ]
    },
    {
        version: "1.2.012",
        date: "2026-04-20",
        title: "Resúmenes & Columnas",
        changes: [
            "Reordenamiento de Grid: BOCENT ahora es siempre la primera columna de ubicación.",
            "Posición de Ventas: La columna de Ventas se ha movido al final para una mejor lectura del flujo.",
            "Totales en Encabezados: Se muestra la suma total de prendas debajo de cada nombre de bodega/almacen y en los totales generales.",
            "Optimización de Cuadratura: La columna Total (Stock + Ventas) ahora incluye su propio resumen global en el encabezado."
        ]
    },
    {
        version: "1.2.011",
        date: "2026-04-20",
        title: "Sincronización & Flexibilidad",
        changes: [
            "Ventas Flexibles: Se permite procesar ventas incluso si el sistema reporta stock 0 (ideal para cargas en desorden).",
            "Sincronización de Procesos: Unificada la lógica de importación entre la página de Inventario y Movimientos.",
            "Corrección de Stock Local: Reparado error que impedía ver cambios negativos (ventas) en tiempo real si no había registro previo.",
            "Normalización de IDs: Truncado inteligente de espacios en códigos de venta para evitar fallos de coincidencia."
        ]
    },
    {
        version: "1.2.010",
        date: "2026-04-20",
        title: "Ventas & Cuadratura",
        changes: [
            "Nueva columna 'Ventas': Seguimiento acumulativo de ventas por producto en la tabla principal.",
            "Columna Total mejorada: Ahora representa Stock + Ventas para cuadrar perfectamente con la carga inicial.",
            "Optimización de Pantalla: El sistema ahora oculta automáticamente las sucursales con stock 0 para despejar la vista.",
            "Diagnóstico de Importación: Mensajes de error mejorados al subir ventas, listando las sucursales válidas en caso de error de coincidencia."
        ]
    },
    {
        version: "1.2.009",
        date: "2026-04-20",
        title: "IVA Chile & Admin Controls",
        changes: [
            "Ajuste de Margen (IVA): El Dashboard ahora considera el IVA de Chile (19%) en el cálculo de margen esperado y tendencias.",
            "Restricción de Acceso: La función de 'Retorno Total a Bodega' ahora es exclusiva para administradores.",
            "Refinamiento Visual: Eliminado el texto redundante 'BOA IDEIA' debajo de los logos para una estética más limpia.",
            "Seguridad de Operaciones: Confirmación reforzada en procesos críticos de gestión de inventario."
        ]
    },
    {
        version: "1.2.008",
        date: "2026-04-20",
        title: "Logo Fix & Total Return",
        changes: [
            "Corrección de Logo: Estandarizado el servicio de logo vía /api/logo para evitar desapariciones.",
            "Retorno Total a Bodega: Nueva herramienta en Configuración > Ubicaciones para devolver todo el stock de una tienda a BODCENT con un clic.",
            "Mejoras de Seguridad: Reforzada la validación de archivos XLSX en el procesamiento de ventas.",
            "Sincronización Contextual: El sistema de versiones ahora se refleja correctamente en todos los componentes."
        ]
    },
    {
        version: "1.2.007",
        date: "2026-04-20",
        title: "BODCENT Scoring & Sales Groups",
        changes: [
            "Mejora de 'Smart Match': Búsqueda scoring-based para ubicaciones centrales (BODCEN/BODCENT).",
            "Consolidación de Errores en Ventas: Ahora las ventas también agrupan errores por tipo y cantidad.",
            "Persistencia Reforzada de Bodega: El backend asegura autoconfiguración de BODCENT si no existe.",
            "Sincronización de Nombres: Mejorada la detección de 'Bodega' vs 'Almacén' en importaciones masivas."
        ]
    },
    {
        version: "1.2.006",
        date: "2026-04-19",
        title: "Smart Match y Consolidación",
        changes: [
            "Implementación de 'Smart Match': Búsqueda inteligente de ubicaciones por nombre, ID o fragmentos (ej: 'CEN' coincide con Central).",
            "Consolidación de errores: Los fallos repetidos se agrupan en un resumen corto, eliminando las paredes de texto en notificaciones.",
            "Persistencia forzada de BODCEN: El sistema asegura que la Bodega Central exista siempre con su ID estandarizado.",
            "Mejora en Toasts: Resúmenes de carga masiva ahora muestran cuántas filas fallaron y por qué de forma agregada."
        ]
    },
    {
        version: "1.2.005",
        date: "2026-04-19",
        title: "Inteligencia de Datos y Alias",
        changes: [
            "Implementación de auto-alias para 'BODCEN' redirigiendo automáticamente a 'Bodega Central'.",
            "Limpieza de mensajes de error de ubicación: ahora muestran nombres legibles en lugar de IDs técnicos.",
            "Normalización profunda de encabezados en archivos Excel (.xlsx) y CSV.",
            "Mejora en la búsqueda de ubicaciones (ahora busca por nombre e ID de forma insensible a mayúsculas/minúsculas)."
        ]
    },
    {
        version: "1.2.001",
        date: "2026-04-19",
        title: "Mejoras de UI y Carga Masiva",
        changes: [
            "Ajuste de prioridad en rutas de servidor para evitar error 'Invalid entity' en importaciones.",
            "Visualización mejorada de ubicaciones con scroll y orden cronológico inverso.",
            "Inicialización automática de 'Bodega Central' como ubicación por defecto.",
            "Optimización de lógica de base de datos para modo JSON y PostgreSQL."
        ]
    },
    {
        version: "1.2.000",
        date: "2026-04-19",
        title: "Lanzamiento Estable (PostgreSQL & Logo Fix)",
        changes: [
            "Implementación definitiva de PostgreSQL con sistema de persistencia en volumen.",
            "Corrección crítica de autenticación en DB mediante comandos administrativos de Docker.",
            "Mejora del sistema de Logo con cache-busting automático.",
            "Limpieza de logs de depuración para entorno de producción.",
            "Soporte estático para archivos subidos (/uploads)."
        ]
    },
    {
        version: "1.1.000",
        date: "2026-04-18",
        title: "Mejoras de Infraestructura",
        changes: [
            "Migración de Express v4 a Express v5 (manejo de rutas comodín).",
            "Configuración de Docker multi-etapa para optimización de despliegue.",
            "Sistema de fallback JSON para resiliencia de datos."
        ]
    },
    {
        version: "1.0.000",
        date: "2026-04-15",
        title: "Lanzamiento Inicial",
        changes: [
            "Estructura base de la aplicación (Dashboard, Inventario, Movimientos).",
            "Soporte inicial para temas personalizados y gestión de usuarios."
        ]
    }
];

const SettingsPage: React.FC = () => {
    const { 
        locations, addLocation, updateLocation, deleteLocation,
        users, addUser, updateUser, deleteUser,
        clearAllData, clearProducts, clearLocations, clearUsers,
        backupData, restoreData,
        dbStatus, checkHealth, loading,
        logo, fetchLogo, returnAllToWarehouse, currentUser
    } = useInventory();
    const { addToast } = useToast();

    const [isLocationModalOpen, setLocationModalOpen] = useState(false);
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<any>({});
    
    const [isConfirmingClear, setIsConfirmingClear] = useState(false);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    useEffect(() => {
        if (!isConfirmingClear) return;
        const timer = setTimeout(() => {
            setIsConfirmingClear(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, [isConfirmingClear]);


    const handleClearData = () => {
        if (isConfirmingClear) {
            clearAllData();
            addToast('Todos los datos han sido eliminados exitosamente.', 'success');
            setIsConfirmingClear(false);
            setTimeout(() => window.location.reload(), 1500);
        } else {
            setIsConfirmingClear(true);
            addToast('Se requiere confirmación para eliminar TODOS los datos.', 'warning');
        }
    };

    const handleClearSpecific = async (type: 'products' | 'locations' | 'users') => {
        const messages = {
            products: '¿Está seguro de eliminar todos los productos, stock y movimientos?',
            locations: '¿Está seguro de eliminar todas las ubicaciones y el stock asociado?',
            users: '¿Está seguro de eliminar todos los usuarios? Esto cerrará su sesión.'
        };

        if (window.confirm(messages[type])) {
            try {
                if (type === 'products') await clearProducts();
                if (type === 'locations') await clearLocations();
                if (type === 'users') {
                    await clearUsers();
                    window.location.reload();
                    return;
                }
                addToast(`Base de datos de ${type} limpiada con éxito.`, 'success');
            } catch (error) {
                addToast(`Error al limpiar ${type}.`, 'error');
            }
        }
    };

    const handleCancelClear = () => {
        setIsConfirmingClear(false);
        addToast('La eliminación de datos ha sido cancelada.', 'info');
    };

    const handleDownloadBackup = async () => {
        try {
            const data = await backupData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `respaldo_inventario_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast('Respaldo descargado con éxito.', 'success');
        } catch (err) {
            addToast('Error al generar el respaldo.', 'error');
        }
    };

    const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('¿Está seguro de restaurar los datos? Esto SOBREESCRIBIRÁ todos los datos actuales.')) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const content = event.target?.result as string;
                const data = JSON.parse(content);
                await restoreData(data);
                addToast('Datos restaurados con éxito.', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                addToast('Error al restaurar el archivo. Asegúrese de que sea un JSON válido.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleLogoUpload = async () => {
        if (!logoFile) return;
        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('file', logoFile);
        try {
            const response = await fetch('/api/upload?type=logo', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                addToast('Logo actualizado correctamente.', 'success');
                setLogoFile(null);
                // Forzar actualización añadiendo un cache-buster
                await fetchLogo();
                // Opcional: recargar con timestamp si fetchLogo no es suficiente
            } else {
                const data = await response.json();
                addToast(data.error || 'Error al subir el logo.', 'error');
            }
        } catch (err) {
            addToast('Error de red al subir el logo.', 'error');
        } finally {
            setUploadingLogo(false);
        }
    };


    const openLocationModal = (location: Location | null = null) => {
        setEditingLocation(location);
        setFormData(location || { name: '', type: LocationType.FIXED_STORE_PERMANENT });
        setLocationModalOpen(true);
    };

    const handleReturnAll = async (location: Location) => {
        if (!window.confirm(`¿Está seguro de retornar TODO el stock remanente de "${location.name}" a la Bodega Central (BODCENT)? Esta acción generará múltiples movimientos de transferencia.`)) {
            return;
        }
        
        try {
            await returnAllToWarehouse(location.id);
            addToast(`Stock de "${location.name}" retornado exitosamente a Bodega Central.`, 'success');
        } catch (err: any) {
            addToast(`Error al retornar stock: ${err.message}`, 'error');
        }
    };

    const handleLocationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingLocation) {
            updateLocation({ ...editingLocation, ...formData });
        } else {
            addLocation(formData);
        }
        setLocationModalOpen(false);
    };

    const openUserModal = (user: User | null = null) => {
        setEditingUser(user);
        setFormData(user || { username: '', password: '', role: 'user' });
        setUserModalOpen(true);
    };

    const handleUserSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUser) {
            updateUser({ ...editingUser, ...formData });
        } else {
            addUser(formData);
        }
        setUserModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-primary">Configuración</h2>
                <span className="text-xs bg-accent text-primary px-2 py-1 rounded">v{APP_VERSION}</span>
            </div>

            <Card title="Identidad de Marca (Logo)">
                <div className="p-4 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-32 h-32 bg-background rounded-lg border-2 border-dashed border-accent flex items-center justify-center overflow-hidden">
                        <img 
                            src={logo || "/logo.png"} 
                            alt="Logo actual" 
                            className="max-w-full max-h-full object-contain" 
                            onError={(e) => {
                                if (!logo) {
                                    e.currentTarget.src = 'https://picsum.photos/seed/inventory/150/150?text=Logo';
                                }
                            }} 
                        />
                    </div>
                    <div className="flex-1 space-y-4">
                        <p className="text-sm text-text-light">Sube el logo de tu empresa. Se recomienda un archivo PNG con fondo transparente. El archivo se guardará como <code className="bg-background p-1 rounded">logo.png</code>.</p>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                className="text-sm text-text-main file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-primary hover:file:bg-accent/80"
                            />
                            <Button 
                                onClick={handleLogoUpload} 
                                disabled={!logoFile || uploadingLogo}
                                className="flex items-center gap-2"
                            >
                                <Upload size={16} />
                                {uploadingLogo ? 'Subiendo...' : 'Actualizar Logo'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Estado del Sistema (Conexión Base de Datos)">
                <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-full ${dbStatus?.database === 'connected' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                            <Database size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-text-main">Estado de la Base de Datos</h4>
                            <div className="flex items-center space-x-2">
                                {dbStatus?.database === 'connected' ? (
                                    <>
                                        <CheckCircle2 size={14} className="text-success" />
                                        <span className="text-sm text-success font-medium">Conectado a PostgreSQL</span>
                                    </>
                                ) : (
                                    <div className="flex flex-col">
                                        <div className="flex items-center space-x-2">
                                            <XCircle size={14} className="text-danger" />
                                            <span className="text-sm text-danger font-medium">Desconectado (Usando DB Local Temporal)</span>
                                        </div>
                                        {dbStatus?.error && (
                                            <p className="text-[10px] text-danger mt-1 font-mono bg-danger/5 p-1 rounded">
                                                Error: {dbStatus.error}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => {
                            addToast('Verificando conexión...', 'info');
                            checkHealth();
                        }}
                        className="flex items-center space-x-2"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Verificar Conexión</span>
                    </Button>
                </div>
            </Card>

            {dbStatus?.database === 'disconnected' && (
                <div className="bg-danger/10 border-2 border-danger p-6 rounded-xl flex flex-col md:flex-row items-center gap-6 animate-pulse">
                    <div className="bg-danger text-white p-4 rounded-full">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-xl font-bold text-danger mb-1">¡Atención! Base de Datos no Detectada</h3>
                        <p className="text-text-main">
                            La aplicación no está conectada a una base de datos externa. 
                            Esto puede causar que los datos se pierdan al reiniciar el servidor.
                        </p>
                    </div>
                </div>
            )}

            <Card title="Gestión de Ubicaciones">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-text-light">Gestiona las bodegas, tiendas y puntos de venta.</p>
                    <Button onClick={() => openLocationModal()} size="sm">Añadir Ubicación</Button>
                </div>
                
                <div className="overflow-y-auto max-h-80 border border-accent rounded-xl shadow-inner bg-background/30">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-primary uppercase bg-accent/80 backdrop-blur-sm sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3">Nombre</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-accent/30">
                            {locations.length > 0 ? (
                                [...locations].reverse().map(loc => (
                                    <tr key={loc.id} className="bg-white/50 hover:bg-accent/5 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-text-main">{loc.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-accent/20 text-primary text-[10px] uppercase font-bold rounded-full">
                                                {LOCATION_TYPE_MAP[loc.type]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {loc.id !== 'BODCENT' && currentUser?.role === 'admin' && (
                                                    <button onClick={() => handleReturnAll(loc)} className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors" title="Retornar Todo a Bodega"><RotateCcw size={16}/></button>
                                                )}
                                                <button onClick={() => openLocationModal(loc)} className="text-secondary hover:bg-secondary/10 p-1.5 rounded-lg transition-colors" title="Editar"><Edit size={16}/></button>
                                                <button onClick={() => deleteLocation(loc.id)} className="text-danger hover:bg-danger/10 p-1.5 rounded-lg transition-colors" title="Eliminar"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-text-light italic">No hay ubicaciones registradas.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="Gestión de Usuarios">
                <Button onClick={() => openUserModal()} className="mb-4">Añadir Usuario</Button>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-primary uppercase bg-accent">
                            <tr>
                                <th className="px-6 py-3">Nombre de Usuario</th>
                                <th className="px-6 py-3">Contraseña</th>
                                <th className="px-6 py-3">Rol</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="bg-background-light border-b border-background">
                                    <td className="px-6 py-4">{user.username}</td>
                                    <td className="px-6 py-4">••••••••</td>
                                    <td className="px-6 py-4 capitalize">{user.role}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => openUserModal(user)} className="text-secondary p-1"><Edit size={16}/></button>
                                        <button onClick={() => deleteUser(user.id)} className="text-danger p-1 ml-2"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card title="Historial de Versiones (Changelog)">
                <div className="p-4 space-y-6">
                    {CHANGELOG.map((release, idx) => (
                        <div key={release.version} className={`relative pl-8 ${idx !== CHANGELOG.length - 1 ? 'border-l-2 border-accent pb-6 ml-2' : 'ml-2'}`}>
                            <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-accent border-4 border-white shadow-sm"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                <h4 className="font-bold text-primary flex items-center">
                                    v{release.version} - {release.title}
                                    {idx === 0 && <span className="ml-3 text-[10px] bg-success text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Actual</span>}
                                </h4>
                                <span className="text-xs font-mono text-text-light">{release.date}</span>
                            </div>
                            <ul className="space-y-1">
                                {release.changes.map((change, cIdx) => (
                                    <li key={cIdx} className="text-sm text-text-main flex items-start">
                                        <span className="text-accent mr-2">•</span>
                                        {change}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Gestión de Datos (Respaldo y Limpieza)">
                <div className="space-y-6 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-accent pb-6">
                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                            <h4 className="font-bold text-primary flex items-center mb-2">
                                <Download size={18} className="mr-2" /> Exportar Respaldo
                            </h4>
                            <p className="text-xs text-text-light mb-4">Descarga un archivo JSON con todos los datos.</p>
                            <Button onClick={handleDownloadBackup} className="w-full flex items-center justify-center gap-2">
                                <Download size={16} /> Descargar Archivo de Respaldo
                            </Button>
                        </div>
                        <div className="p-4 bg-secondary/5 rounded-lg border border-secondary/20">
                            <h4 className="font-bold text-secondary flex items-center mb-2">
                                <FileUp size={18} className="mr-2" /> Restaurar Respaldo
                            </h4>
                            <p className="text-xs text-text-light mb-4">Carga un archivo de respaldo previamente descargado.</p>
                            <div className="relative">
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    onChange={handleRestoreBackup}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
                                    <FileUp size={16} /> Seleccionar Archivo y Restaurar
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-accent pb-4">
                        <div className="text-left">
                            <h4 className="font-bold text-primary">Base de Datos de Productos</h4>
                            <p className="text-sm text-text-light">Elimina productos, stock y movimientos asociados.</p>
                        </div>
                        <Button onClick={() => handleClearSpecific('products')} variant="danger">Limpiar Productos</Button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-accent pb-4">
                        <div className="text-left">
                            <h4 className="font-bold text-primary">Base de Datos de Ubicaciones</h4>
                            <p className="text-sm text-text-light">Elimina todas las ubicaciones y el stock asociado.</p>
                        </div>
                        <Button onClick={() => handleClearSpecific('locations')} variant="danger">Limpiar Ubicaciones</Button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-accent pb-4">
                        <div className="text-left">
                            <h4 className="font-bold text-primary">Base de Datos de Usuarios</h4>
                            <p className="text-sm text-text-light">Elimina todos los usuarios (requiere re-login).</p>
                        </div>
                        <Button onClick={() => handleClearSpecific('users')} variant="danger">Limpiar Usuarios</Button>
                    </div>

                    <div className="flex flex-col items-center justify-center pt-4 text-center">
                         <p className="text-text-light mb-4">
                            {isConfirmingClear
                                ? '¡ADVERTENCIA! ¿Está seguro de que desea eliminar permanentemente TODOS los datos del sistema?'
                                : 'Elimina absolutamente todos los datos de la aplicación.'
                            }
                         </p>
                         <div className="flex items-center justify-center gap-4">
                            {isConfirmingClear ? (
                                <>
                                    <Button
                                        onClick={handleClearData}
                                        variant="danger"
                                        className="animate-pulse"
                                    >
                                        Sí, Eliminar Todo
                                    </Button>
                                    <Button
                                        onClick={handleCancelClear}
                                        variant="secondary"
                                    >
                                        Cancelar
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    onClick={handleClearData}
                                    variant="danger"
                                >
                                    Limpiar Todos los Datos
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            <Modal isOpen={isLocationModalOpen} onClose={() => setLocationModalOpen(false)} title={editingLocation ? 'Editar Ubicación' : 'Añadir Ubicación'}>
                <form onSubmit={handleLocationSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main">Nombre</label>
                        <input type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1 w-full p-2 border border-accent rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Tipo</label>
                        <select value={formData.type || ''} onChange={(e) => setFormData({...formData, type: e.target.value})} className="mt-1 w-full p-2 border border-accent rounded-md bg-white">
                            {Object.entries(LOCATION_TYPE_MAP).map(([key, value]) => (
                                <option key={key} value={key}>{value}</option>
                            ))}
                        </select>
                    </div>
                    <div className="text-right">
                        <Button type="submit">{editingLocation ? 'Actualizar' : 'Guardar'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} title={editingUser ? 'Editar Usuario' : 'Añadir Usuario'}>
                 <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main">Nombre de Usuario</label>
                        <input type="text" value={formData.username || ''} onChange={(e) => setFormData({...formData, username: e.target.value})} className="mt-1 w-full p-2 border border-accent rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Contraseña</label>
                        <input type="password" value={formData.password || ''} onChange={(e) => setFormData({...formData, password: e.target.value})} className="mt-1 w-full p-2 border border-accent rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main">Rol</label>
                        <select value={formData.role || 'user'} onChange={(e) => setFormData({...formData, role: e.target.value})} className="mt-1 w-full p-2 border border-accent rounded-md bg-white">
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                        </select>
                    </div>
                    <div className="text-right">
                        <Button type="submit">{editingUser ? 'Actualizar' : 'Guardar'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SettingsPage;
