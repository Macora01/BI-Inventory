import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center overflow-y-auto">
      <div className="bg-background-light rounded-lg shadow-xl w-full max-w-4xl m-4">
        <div className="flex justify-between items-center p-4 border-b border-accent">
          <h3 className="text-xl font-bold text-primary italic uppercase tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1 text-text-light hover:text-primary transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
