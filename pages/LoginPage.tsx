/**
 * LoginPage.tsx
 * Version: 1.1.000
 */
import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import Button from '../components/Button';
import Card from '../components/Card';
import { LogIn, Lock, User as UserIcon } from 'lucide-react';
import { APP_VERSION } from '../version';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useInventory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (!success) {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen bg-background-light flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex p-4 rounded-full bg-primary mb-6 shadow-lg rotate-3 hover:rotate-0 transition-transform">
            <Archive size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold italic text-primary uppercase tracking-tighter">
            Boa Ideia
          </h1>
          <p className="text-text-light mt-2 font-medium">SISTEMA DE GESTIÓN DE INVENTARIO</p>
        </div>

        <Card className="p-8 shadow-2xl border-t-4 border-primary">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-text-light uppercase tracking-widest mb-1">Nombre de Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-light">
                  <UserIcon size={18} />
                </div>
                <input 
                  type="text" 
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-accent rounded-lg bg-white focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-light uppercase tracking-widest mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-light">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-accent rounded-lg bg-white focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-danger/10 rounded-md flex items-center gap-3 text-danger text-sm font-medium animate-bounce">
                <X size={18} />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full flex items-center justify-center gap-2 py-4 text-lg">
              <LogIn size={20} />
              ENTRAR AL SISTEMA
            </Button>
          </form>
        </Card>

        <div className="text-center space-y-4">
            <p className="text-[10px] text-text-light uppercase font-bold tracking-widest">
                VERSIÓN {APP_VERSION}
            </p>
            <div className="flex justify-center gap-6 opacity-30">
                <Zap size={16} />
                <Eye size={16} />
                <BarChart3 size={16} />
            </div>
        </div>
      </div>
    </div>
  );
};

// Internal icons needed
const Archive = ({ size, className }: { size: number, className: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 8V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
    </svg>
);
const Zap = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
);
const Eye = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
);
const BarChart3 = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20V14" />
    </svg>
);
const X = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export default LoginPage;
