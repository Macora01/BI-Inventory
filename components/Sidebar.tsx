import React from 'react';
import { 
    LayoutDashboard, 
    Package, 
    RefreshCw, 
    BarChart3, 
    Settings, 
    LogOut,
    Eye,
    Zap
} from 'lucide-react';
import { useHashNavigation } from '../hooks/useHashNavigation';
import { User } from '../types';
import { useInventory } from '../context/InventoryContext';
import { APP_VERSION } from '../version';

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Inventario', icon: Package, path: '/inventory' },
    { name: 'Movimientos', icon: RefreshCw, path: '/movements' },
    { name: 'Trazabilidad', icon: Eye, path: '/traceability' },
    { name: 'Reportes', icon: BarChart3, path: '/reports' },
    { name: 'Configuración', icon: Settings, path: '/settings' },
];

interface SidebarProps {
    user: User;
    onLogout: () => void;
}

const Sidebar: React.FC = () => {
    const { currentHash: currentPath } = useHashNavigation();
    const { logo, currentUser, logout } = useInventory();

    if (!currentUser) return null;

    return (
        <aside className="w-64 bg-primary text-white flex flex-col shadow-xl">
            <div className="p-8 flex flex-col items-center border-b border-white/10">
                {logo ? (
                    <img src={logo} alt="Boa Ideia Logo" className="h-16 w-auto mb-4 object-contain max-h-16" />
                ) : (
                    <>
                        <Zap className="text-secondary mb-2" size={40} />
                        <h1 className="text-2xl font-black italic tracking-tighter text-white">BOA IDEIA</h1>
                    </>
                )}
                <div className="flex flex-col items-center">
                    <p className="text-[10px] uppercase font-black text-secondary tracking-[0.2em] mt-1 shadow-sm">Inventory System</p>
                    <p className="text-[10px] font-mono bg-white/20 border border-white/20 px-2 py-0.5 rounded-full mt-3 text-white font-bold shadow-inner">
                        v{APP_VERSION}
                    </p>
                </div>
            </div>
            
            <nav className="flex-1 mt-6 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = currentPath === `#${item.path}` || (currentPath === '#/dashboard' && item.path === '/');
                    return (
                        <a
                            key={item.path}
                            href={`#${item.path}`}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                                isActive 
                                    ? 'bg-secondary text-primary font-bold shadow-md' 
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <item.icon size={20} className={isActive ? 'text-primary' : 'text-secondary/80 group-hover:text-secondary'} />
                            <span className="uppercase text-xs tracking-wider">{item.name}</span>
                        </a>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/10 space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary font-black text-xs">
                        {currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold truncate uppercase">{currentUser.username}</p>
                        <p className="text-[9px] opacity-60 truncate uppercase">{currentUser.role}</p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-white/80 hover:bg-danger/20 hover:text-danger rounded-lg transition-all duration-200"
                >
                    <LogOut size={20} />
                    <span className="uppercase text-xs tracking-wider font-bold">Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
