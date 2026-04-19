import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, icon: Icon, className = "" }) => {
  return (
    <div className={`bg-background-light rounded-xl shadow-sm border border-accent p-6 ${className}`}>
      {title && (
        <div className="flex items-center space-x-2 mb-4 border-b border-accent pb-2">
          {Icon && <Icon className="text-primary" size={20} />}
          <h3 className="text-lg font-bold text-primary italic uppercase tracking-tight">{title}</h3>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Card;
