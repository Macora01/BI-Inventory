import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import { useInventory } from '../context/InventoryContext';
import { Location, User, LocationType, LOCATION_TYPE_MAP } from '../types';
import Modal from '../components/Modal';
import { Edit, Trash2, Database, CheckCircle2, XCircle, RefreshCw, AlertTriangle, Upload, Download, FileUp, RotateCcw, History } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { APP_VERSION } from '../version';

const CHANGELOG = [
    {
        version: "1.3.021",
        title: "Arquitectura de Reportes Anti-Duplicación",
        date: "2026-04-23",
        changes: [
            "Fusión de Identidades: Se unificaron registros que existían duplicados por ID y por Nombre, corrigiendo el error de inventario duplicado en el total global.",
            "Búsqueda Inclusiva: Los reportes de almacenes específicos ahora recuperan datos tanto por ID como por Nombre del sitio, eliminando los reportes en cero.",
            "Consolidación Maestra: El total de 'Todos los Almacenes' ahora coincide exactamente con la suma de las partes individuales.",
            "Estilo: Limpieza de la barra lateral para mejor visibilidad."
        ]
    },
    {
        version: "1.3.020",
        title: "Normalización de Base de Datos y Reportes",
        date: "2026-04-22",
        changes: [
            "Normalización de IDs: Ahora el sistema trata 'Almdom', 'ALMDOM' y 'ALMDOM ' como la misma ubicación para evitar duplicidades y ceros.",
            "Blindaje de Stock: El reporte de hoy ignora el historial sumado y usa exclusivamente el stock físico consolidado.",
            "Corrección de Duplicados: Se eliminó el riesgo de suma doble al consolidar todos los almacenes.",
            "Visibilidad de Versión: Mejorada la legibilidad de la versión en la barra lateral."
        ]
    },
    {
        version: "1.3.019",
        title: "Sincronización Definitiva de Reportes",
        date: "2026-04-22",
        changes: [
            "Alineación de Stock: Los reportes generados con fecha actual ahora consultan directamente el stock físico. Esto garantiza que la información en Inventario y Reportes sea idéntica al 100%.",
            "Manejo de Cargas Históricas: Se eliminó la dependencia exclusiva de logs para reportes del día actual, resolviendo el problema de 'reportes en cero' por falta de historial de movimientos.",
            "Optimización de Consultas: Mejora en la velocidad de generación de existencias para almacenes específicos."
        ]
    },
    {
        version: "1.3.018",
        title: "Unificación de Identidades de Almacén",
        date: "2026-04-22",
        changes: [
            "Mapeo Inclusivo: Los reportes ahora unifican movimientos bajo ID, Nombre y Alias (ej. busca VLT y ALMVLT simultáneamente). Esto recupera los reportes que aparecían en cero por discrepancias de ID históricas.",
            "Blindaje Numérico (v2): Mantenida la suma matemática estricta para evitar concatenaciones.",
            "Integridad de Datos: Confirmado que no existe borrado de información, solo mejora en la lectura del historial."
        ]
    },
    {
        version: "1.3.017",
        title: "Reparación Crítica: Integridad Matemática",
        date: "2026-04-22",
        changes: [
            "Bug Fix Crítico: Corregido error de concatenación de texto en los reportes. Ahora el sistema fuerza la suma numérica (Number()) eliminando los errores donde '1' se convertía en '11'.",
            "Consolidación de Totales: El resumen de existencia a fecha vuelve a ser 100% confiable y fiel a los movimientos reales.",
            "Blindaje de Tipos: Forzada la tipificación numérica en todo el flujo de cálculo de inventario por ubicación."
        ]
    },
    {
        version: "1.3.016",
        title: "Claridad Visual y Consolidación",
        date: "2026-04-22",
        changes: [
            "Contraste de UI: Aumentada la legibilidad de la versión y etiquetas en la barra lateral con colores más brillantes y blancos puros.",
            "Estabilidad de Reportes: Confirmada la visualización correcta de stock en almacenes periféricos (como ALMDOM).",
            "Refinamiento Estético: Ajuste de espaciados y tipografía en el encabezado del sistema."
        ]
    },
    {
        version: "1.3.015",
        title: "Exactitud Matemática en Reportes",
        date: "2026-04-22",
        changes: [
            "Motor de Reportes V3: Reescrita la lógica de cálculo por almacén basada en flujo neto absoluto (Entradas minus Salidas).",
            "Consistencia ALMDOM: Verificado que los almacenes de destino sumen correctamente en todos los reportes.",
            "Auditoría Visual: Mejorado el acceso a la trazabilidad por celda para diagnóstico inmediato."
        ]
    },
    {
        version: "1.3.014",
        title: "Inspector de Historial y Reportes Corregidos",
        date: "2026-04-22",
        changes: [
            "Auditoría por Celda: Implementada la 'Lupa' en la tabla de inventario para ver el historial exacto de cada celda.",
            "Corrección de Filtros: Eliminada la restricción que causaba que reportes de almacenes específicos aparecieran vacíos.",
            "Restauración de Visión: Repuesto el indicador de versión en la barra lateral."
        ]
    },
    {
        version: "1.3.013",
        title: "Integridad de Datos y Restauración de UI",
        date: "2026-04-22",
        changes: [
            "Mapeo Estricto de Ubicaciones: Eliminada la lógica de 'adivinanza'. Ahora el sistema requiere coincidencia exacta (Nombre o ID) para evitar confusiones entre LIN y VLT.",
            "Restauración de UI: Se ha repuesto el indicador de versión en la barra lateral debajo del logo para visibilidad permanente.",
            "Blindaje de Importación: Se han añadido validaciones adicionales en la carga de inventario inicial para asegurar que ningún movimiento se asigne a un almacén incorrecto por error."
        ]
    },
    {
        version: "1.3.012",
        title: "Corrección Crítica de Importación y Saneamiento",
        date: "2026-04-22",
        changes: [
            "Bug Fix Importador: Corregida la ceguera del importador de Inventario Inicial. Ahora lee correctamente el almacén del archivo en lugar de volcar todo en BODCENT.",
            "Normalización de Búsqueda: 'findLoc' ahora es insensible a mayúsculas y caracteres especiales, unificando IDs como VLT y ALMVLT.",
            "Sincronización Inteligente: El botón de sincronización en Configuración ahora detecta movimientos mal asignados y crea los ajustes necesarios para que los reportes de almacenes específicos dejen de aparecer vacíos.",
            "Mejora de Precisión: Sello de garantía en el conteo total de unidades (previniendo diferencias como la de 480 vs 486)."
        ]
    },
    {
        version: "1.3.011",
        title: "Sincronización y Diagnóstico de Existencias",
        date: "2026-04-22",
        changes: [
            "Herramientas de Consistencia: Añadido selector en Configuración para sincronizar reportes con inventario real (y viceversa).",
            "Soporte para Cargas Históricas: Permite generar logs automáticos para inventarios cargados antes de la activación de la bitácora.",
            "Detector de Conflictos: Nueva herramienta para identificar ubicaciones con nombres duplicados pero IDs diferentes (ej: ALMLIN vs ALMVLT).",
            "Validación de Discrepancias: Mejorada la precisión en el cálculo de reportes para transferencias internas."
        ]
    },
    {
        version: "1.3.010",
        title: "Saneamiento Estético y Simplificación",
        date: "2026-04-22",
        changes: [
            "Limpieza de Interfaz: Eliminada la etiqueta 'MAESTRO' de las ubicaciones, permitiendo una gestión más unificada.",
            "Despeje de Sidebar: Se eliminó el indicador de versión lateral para reducir el ruido visual en la navegación principal.",
            "Normalización de Ubicaciones: 'BODCENT' ahora se comporta visualmente como cualquier otra bodega oficial.",
            "Mejoras de Espaciado: Ajustes menores en la tabla de configuraciones para una lectura más fluida."
        ]
    },
    {
        version: "1.3.009",
        title: "Bitácora de Auditoría y Logs",
        date: "2026-04-22",
        changes: [
            "Sistema de Bitácora: Nueva pestaña en Configuración para rastrear actividades del sistema (cargas, purgas, errores).",
            "Registro de Marcha Blanca: Se registran tanto éxitos como errores críticos para facilitar el soporte técnico.",
            "Descarga de Log: Opción para exportar toda la actividad a un archivo CSV para auditoría externa.",
            "Trazabilidad de Cargas: Cada registro de importación masiva ahora deja una huella digital en la bitácora."
        ]
    },
    {
        version: "1.3.008",
        title: "Limpieza Profunda e Histórica",
        date: "2026-04-22",
        changes: [
            "Purga de Movimientos Históricos: Ahora el saneamiento elimina no solo las bodegas duplicadas, sino también su historial de movimientos, evitando que el Reporte de Existencias muestre datos 'fantasma'.",
            "Corrección de BI6606CL: Se eliminaron registros erróneos (>100k unidades) del producto BI6606CL en BODCENT resultantes de importaciones fallidas previas.",
            "Estabilidad en Transferencias Excel: Se mejoró la lectura de archivos XLSX para asegurar que las transferencias entre almacenes se procesen correctamente.",
            "Garantía de Nombre Único: Se forza que 'BODCENT' siempre tenga el nombre 'BODCENT' para evitar confusiones en los reportes."
        ]
    },
    {
        version: "1.3.007",
        title: "Precisión en Fechas de Venta",
        date: "2026-04-22",
        changes: [
            "Respeto a Fechas de Archivo: Se corrigió el error que asignaba la fecha de procesamiento a las ventas importadas. Ahora se utiliza la fecha real del archivo Excel/CSV.",
            "Parser Multi-Formato: Soporte robustecido para fechas en formato DD-MM-AAAA, DD/MM/AAAA y números seriales de Excel.",
            "Normalización de Columnas: Mejora en la detección de columnas (Fecha, Lugar, ID Venta, etc.) ignorando variaciones de nombre y caracteres especiales.",
            "Fuzzy Search de Ubicaciones: Búsqueda inteligente de almacenes para reducir errores de importación por discrepancias menores en los nombres."
        ]
    },
    {
        version: "1.3.006",
        title: "Saneamiento Definitivo de Bodegas",
        date: "2026-04-22",
        changes: [
            "Purga Permanente: Implementada una limpieza agresiva que elimina cualquier ubicación similar a esa que no sea el ID oficial 'BODCENT'.",
            "Eliminación de Stock Residual: Se borraron todas las existencias vinculadas a IDs de bodega obsoletos, asegurando que el reporte de existencias solo muestre datos reales.",
            "Consolidación de Identidad: 'BODCENT' queda como el único identificador maestro."
        ]
    },
    {
        version: "1.3.005",
        title: "Estabilidad de Despliegue",
        date: "2026-04-22",
        changes: [
            "Optimización de Construcción: Limpieza de scripts auxiliares y mejora en la configuración de empaquetado para asegurar el despliegue correcto.",
            "Consolidación Final: Confirmada la eliminación de datos duplicados y sincronización de base de datos."
        ]
    },
    {
        version: "1.3.004",
        title: "Consolidación de BODCENT",
        date: "2026-04-22",
        changes: [
            "Limpieza de Ubicaciones: Eliminada la duplicidad entre 'BODCENT' y otros registros. Ahora 'BODCENT' es la única ubicación maestra.",
            "Saneamiento de Existencias: Se eliminó el stock erróneo (1.089 unidades) que estaba atrapado en la ubicación duplicada, sin afectar el stock real en BODCENT u otros almacenes.",
            "Optimización de Base de Datos: Scripts de mantenimiento ejecutados automáticamente al iniciar el sistema."
        ]
    },
    {
        version: "1.3.003",
        title: "Corrección de Lógica de Visibilidad",
        date: "2026-04-21",
        changes: [
            "Reversión de Filtros: Restaurada la lógica estrictamente solicitada: las ubicaciones con stock cero total en el sistema NO se muestran en la tabla principal.",
            "Estabilidad de Trazabilidad: Corregido el error de importación que causaba la pantalla en blanco al buscar productos."
        ]
    },
    {
        version: "1.3.002",
        title: "Robustez en Inventario y Almacenes",
        date: "2026-04-21",
        changes: [
            "Protección de Almacenes: Las bodegas centrales ahora son siempre visibles en el inventario, evitando que 'desaparezcan' al llegar a stock cero.",
            "Integridad Histórica: El borrado de ubicaciones ya no elimina el historial de movimientos, preservando la trazabilidad de por vida.",
            "Filtro de Reversiones: Se restringe la reversión de ajustes de sistema para prevenir bucles de corrección infinitos.",
            "Mejora Visual: Iconografía actualizada en la página de trazabilidad para mayor claridad."
        ]
    },
    {
        version: "1.3.001",
        title: "Integridad y Transparencia en Trazabilidad",
        date: "2026-04-21",
        changes: [
            "Herramientas de Recuperación: Añadido botón 'REVERTIR' explícito en el historial de trazabilidad.",
            "Corrección Automática: Implementado botón de sincronización directa para discrepancias de stock.",
            "Visibilidad de Versión: Ahora la versión del sistema es visible en la barra lateral para seguimiento preciso.",
            "Enfoque Global: El resumen de trazabilidad ahora ignora transferencias para evitar ruido en el conteo total."
        ]
    },
    {
        version: "1.3.000",
        title: "Salto de Versión: Mejoras Visuales y Dashboard",
        date: "2026-04-21",
        changes: [
            "Dashboard Interactivo: El gráfico de los más vendidos ahora muestra el código y la imagen del producto al pasar el ratón.",
            "Consolidación de Mejoras: Se alcanza un hito importante en la estabilidad y usabilidad del sistema.",
            "Limpieza de Datos: Optimizada la integridad referencial al eliminar ubicaciones o productos."
        ]
    },
    {
        version: "1.2.022",
        title: "Corrección Crítica de Stock y Mejoras UI",
        date: "2026-04-21",
        changes: [
            "Corregido error crítico de concatenación de stock en modo JSON (agregado de dígitos).",
            "Mejorada la experiencia de edición rápida de stock en la tabla (auto-selección y feedback visual).",
            "Implementada limpieza automática de stock y movimientos al eliminar ubicaciones.",
            "Optimización de estabilidad en transferencias masivas."
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
        logo, fetchLogo, returnAllToWarehouse, currentUser,
        checkConsistency, syncStockFromMovements, fixMovementsFromStock
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

    const [activeSection, setActiveSection] = useState<'profile' | 'locations' | 'logs' | 'changelog'>('profile');
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const fetchLogs = React.useCallback(async () => {
        setIsLoadingLogs(true);
        try {
            const resp = await fetch('/api/logs');
            const data = await resp.json();
            setLogs(data);
        } catch (err) {
            addToast('Error al cargar la bitácora', 'error');
        } finally {
            setIsLoadingLogs(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (activeSection === 'logs') {
            fetchLogs();
        }
    }, [activeSection, fetchLogs]);

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
                await fetchLogo();
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
        if (!window.confirm(`¿Está seguro de retornar TODO el stock remanente de "${location.name}" a BODCENT? Esta acción generará múltiples movimientos de transferencia.`)) {
            return;
        }
        
        try {
            await returnAllToWarehouse(location.id);
            addToast(`Stock de "${location.name}" retornado exitosamente a BODCENT.`, 'success');
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

            {/* Navegación por Pestañas */}
            <div className="flex bg-background border-b border-accent overflow-x-auto no-scrollbar gap-4 px-1">
                {[
                    { id: 'profile', label: 'General', icon: <Database size={16} /> },
                    { id: 'locations', label: 'Ubicaciones', icon: <Upload size={16} /> },
                    { id: 'logs', label: 'Bitácora', icon: <History size={16} /> },
                    { id: 'changelog', label: 'Versión', icon: <CheckCircle2 size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all whitespace-nowrap ${
                            activeSection === tab.id 
                                ? 'border-primary text-primary font-bold bg-accent/20' 
                                : 'border-transparent text-text-light hover:text-text-main hover:bg-accent/10'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeSection === 'profile' && (
                <div className="space-y-6">
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
                                <p className="text-sm text-text-light">Sube el logo de tu empresa. Se recomienda un archivo PNG con fondo transparente.</p>
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

                    <Card title="Saneamiento y Diagnóstico de Datos">
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-text-light">
                                Utilice estas herramientas si detecta discrepancias entre los Reportes y la pestaña de Inventario, 
                                o si sospecha que hay datos duplicados.
                            </p>
                            
                            <div className="bg-accent/20 p-4 rounded-lg border border-accent">
                                <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                                    <AlertTriangle size={18} /> Herramientas de Sincronización
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 bg-white rounded border border-accent/30">
                                        <div>
                                            <p className="text-sm font-bold">Generar Logs desde Stock</p>
                                            <p className="text-xs text-text-light">Crea movimientos de ajuste para que los reportes coincidan con el inventario actual. Úselo si cargó datos antes de tener logs.</p>
                                        </div>
                                        <Button size="sm" onClick={async () => {
                                            if(window.confirm("¿Seguro? Esto creará movimientos de ajuste automáticos para todas las diferencias detectadas.")) {
                                                try {
                                                    // @ts-ignore
                                                    await fixMovementsFromStock();
                                                    addToast("Sincronización completada. Los reportes ahora coincidirán con el inventario.", "success");
                                                } catch(e) { addToast("Error al sincronizar", "error"); }
                                            }
                                        }}>Sincronizar Reportes</Button>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 bg-white rounded border border-accent/30">
                                        <div>
                                            <p className="text-sm font-bold">Corregir Stock desde Logs</p>
                                            <p className="text-xs text-text-light">Ajusta el inventario para que coincida exactamente con la suma de movimientos. ADVERTENCIA: Puede borrar stock si faltan logs.</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={async () => {
                                            if(window.confirm("¡ADVERTENCIA! Esto ajustará su inventario físico basándose en el historial de movimientos. Si le faltan movimientos, perderá datos de stock. ¿Desea continuar?")) {
                                                try {
                                                    // @ts-ignore
                                                    await syncStockFromMovements();
                                                    addToast("Inventario ajustado según historial de movimientos.", "success");
                                                } catch(e) { addToast("Error al sincronizar", "error"); }
                                            }
                                        }}>Sincronizar Stock</Button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-secondary/10 p-4 rounded-lg border border-secondary/20">
                                <h4 className="font-bold text-secondary mb-2">Detección de Conflictos de Ubicación</h4>
                                <Button size="sm" variant="secondary" onClick={() => {
                                    const namesCount: Record<string, string[]> = {};
                                    locations.forEach(l => {
                                        const name = l.name.toLowerCase().trim();
                                        if(!namesCount[name]) namesCount[name] = [];
                                        namesCount[name].push(l.id);
                                    });
                                    const duplicates = Object.entries(namesCount).filter(([name, ids]) => ids.length > 1);
                                    if(duplicates.length > 0) {
                                        const msg = duplicates.map(([name, ids]) => `• "${name}" se repite en IDs: ${ids.join(', ')}`).join('\n');
                                        alert(`Se detectaron nombres de ubicación duplicados:\n\n${msg}\n\nSe recomienda unificar estas ubicaciones usando el ID maestro deseado.`);
                                    } else {
                                        addToast("No se detectaron nombres de ubicación duplicados.", "success");
                                    }
                                }}>Verificar Duplicados</Button>
                                <p className="text-[10px] text-text-light mt-2 italic">Recomendación: Si tiene "ALMLIN" y "ALMVLT" con el mismo nombre, cámbieles el nombre para distinguirlos o únalos.</p>
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
                                            <Button onClick={handleClearData} variant="danger" className="animate-pulse">Sí, Eliminar Todo</Button>
                                            <Button onClick={handleCancelClear} variant="secondary">Cancelar</Button>
                                        </>
                                    ) : (
                                        <Button onClick={handleClearData} variant="danger">Limpiar Todos los Datos</Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {activeSection === 'locations' && (
                <Card title="Gestión de Ubicaciones">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-text-light">Gestiona las bodegas, tiendas y puntos de venta.</p>
                        <Button onClick={() => openLocationModal()} size="sm" className="flex items-center gap-2">
                            <Upload size={14} /> Añadir Ubicación
                        </Button>
                    </div>
                    
                    <div className="overflow-x-auto">
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
                                    locations.sort((a, b) => {
                                        if (a.id === 'BODCENT') return -1;
                                        if (b.id === 'BODCENT') return 1;
                                        return a.name.localeCompare(b.name);
                                    }).map(loc => (
                                        <tr key={loc.id} className="bg-white/50 hover:bg-accent/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-text-main">{loc.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-accent/20 text-primary text-[10px] uppercase font-bold rounded-full">
                                                    {LOCATION_TYPE_MAP[loc.type]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-100 transition-opacity">
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
            )}

            {activeSection === 'logs' && (
                <Card 
                    title="Bitácora de Actividades (Marcha Blanca)"
                    actions={
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={fetchLogs} className="flex items-center gap-1">
                                <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} /> Actualizar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => window.open('/api/logs/download', '_blank')} className="flex items-center gap-1 text-primary">
                                <Download size={14} /> Descargar CSV
                            </Button>
                        </div>
                    }
                >
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-accent/30 text-text-light font-medium border-b border-accent">
                                <tr>
                                    <th className="px-6 py-4">Fecha/Hora</th>
                                    <th className="px-6 py-4">Nivel</th>
                                    <th className="px-6 py-4">Categoría</th>
                                    <th className="px-6 py-4">Mensaje</th>
                                    <th className="px-6 py-4">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-accent/30">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-text-light">No hay registros de actividad aún.</td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-accent/5 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    log.level === 'ERROR' ? 'bg-danger/10 text-danger' :
                                                    log.level === 'WARNING' ? 'bg-warning/10 text-warning' :
                                                    'bg-info/10 text-info'
                                                }`}>
                                                    {log.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium uppercase text-[10px] tracking-wider text-text-light">{log.category}</td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={log.message}>{log.message}</td>
                                            <td className="px-6 py-4">
                                                {log.details && (
                                                    <details className="text-[10px] cursor-pointer">
                                                        <summary className="text-primary hover:underline">Ver JSON</summary>
                                                        <pre className="mt-2 bg-background p-2 rounded border border-accent overflow-auto max-h-32 shadow-inner">
                                                            {JSON.stringify(log.details, null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeSection === 'changelog' && (
                <Card title="Historial de Versiones (Changelog)">
                    <div className="p-4 space-y-6">
                        {CHANGELOG.map((release, idx) => (
                            <div key={release.version} className={`relative pl-8 ${idx !== CHANGELOG.length - 1 ? 'border-l-2 border-accent pb-6 ml-2' : 'ml-2'}`}>
                                <div className="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-accent border-4 border-white shadow-sm"></div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-primary text-lg">v{release.version}: {release.title}</h4>
                                    <span className="text-xs font-medium bg-accent/50 px-3 py-1 rounded-full text-primary">{release.date}</span>
                                </div>
                                <ul className="space-y-2">
                                    {release.changes.map((change, cIdx) => (
                                        <li key={cIdx} className="flex items-start gap-2 text-sm text-text-main leading-relaxed">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0"></div>
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Modal
                isOpen={isLocationModalOpen}
                onClose={() => setLocationModalOpen(false)}
                title={editingLocation ? "Editar Ubicación" : "Añadir Ubicación"}
            >
                <form onSubmit={handleLocationSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Nombre</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-background-light border border-accent rounded-lg px-4 py-2 text-text-main"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Tipo</label>
                        <select
                            className="w-full bg-background-light border border-accent rounded-lg px-4 py-2 text-text-main"
                            value={formData.type || ''}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as LocationType })}
                        >
                            {Object.entries(LocationType).map(([key, value]) => (
                                <option key={value} value={value}>{LOCATION_TYPE_MAP[value]}</option>
                            ))}
                        </select>
                    </div>
                    <Button type="submit" className="w-full">
                        {editingLocation ? "Guardar Cambios" : "Crear Ubicación"}
                    </Button>
                </form>
            </Modal>

            <Modal
                isOpen={isUserModalOpen}
                onClose={() => setUserModalOpen(false)}
                title={editingUser ? "Editar Usuario" : "Añadir Usuario"}
            >
                <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Nombre de Usuario</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-background-light border border-accent rounded-lg px-4 py-2 text-text-main"
                            value={formData.username || ''}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Contraseña</label>
                        <input
                            type="password"
                            required={!editingUser}
                            className="w-full bg-background-light border border-accent rounded-lg px-4 py-2 text-text-main"
                            value={formData.password || ''}
                            placeholder={editingUser ? "Dejar en blanco para mantener actual" : ""}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Rol</label>
                        <select
                            className="w-full bg-background-light border border-accent rounded-lg px-4 py-2 text-text-main"
                            value={formData.role || 'user'}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <Button type="submit" className="w-full">
                        {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                    </Button>
                </form>
            </Modal>
        </div>
    );
};

export default SettingsPage;
