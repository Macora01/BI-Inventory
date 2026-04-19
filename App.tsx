import React from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { ToastProvider } from './hooks/useToast';
import { useHashNavigation } from './hooks/useHashNavigation';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import MovementsPage from './pages/MovementsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import TraceabilityPage from './pages/TraceabilityPage';
import { motion, AnimatePresence } from 'motion/react';

const AppContent: React.FC = () => {
    const { isAuthenticated, currentUser, loading } = useInventory();
    const { currentHash } = useHashNavigation();

    if (loading) {
        return (
            <div className="min-h-screen bg-background-light flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-16 w-12 border-t-4 border-b-4 border-primary mx-auto"></div>
                    <p className="text-primary font-bold italic animate-pulse">INICIALIZANDO BOA IDEIA...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    const renderPage = () => {
        switch (currentHash) {
            case '#/dashboard': return <DashboardPage />;
            case '#/inventory': return <InventoryPage />;
            case '#/movements': return <MovementsPage />;
            case '#/traceability': return <TraceabilityPage />;
            case '#/reports': return <ReportsPage />;
            case '#/settings': return <SettingsPage />;
            default: return <DashboardPage />;
        }
    };

    return (
        <div className="flex min-h-screen bg-background-light font-sans text-text-main">
            <Sidebar />
            <main className="flex-1 p-6 md:p-10 lg:p-12 h-screen overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentHash}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {renderPage()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <InventoryProvider>
                <AppContent />
            </InventoryProvider>
        </ToastProvider>
    );
};

export default App;
