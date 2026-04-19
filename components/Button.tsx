import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = "", 
  disabled, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-xs";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary/90 shadow-sm",
    secondary: "bg-accent/20 text-primary hover:bg-accent/30 border border-accent",
    danger: "bg-danger text-white hover:bg-danger/90 shadow-sm",
    success: "bg-green-600 text-white hover:bg-green-600/90 shadow-sm",
    warning: "bg-yellow-500 text-white hover:bg-yellow-500/90 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5",
    md: "px-5 py-2.5",
    lg: "px-8 py-4 text-sm",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
