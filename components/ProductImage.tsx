import React, { useState, useEffect } from 'react';
import { Package, RefreshCw } from 'lucide-react';

interface ProductImageProps {
  factoryId: string;
  alt: string;
  className?: string;
  refreshKey?: number;
  image?: string; // Base64 string from DB
}

const ProductImage: React.FC<ProductImageProps> = ({ 
  factoryId, 
  alt, 
  className = "", 
  refreshKey = 0,
  image 
}) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Intentar cargar la imagen desde el servidor primero, luego el fallback
  const imageUrl = image ? image : `/api/products/${factoryId}/image?t=${refreshKey}`;

  useEffect(() => {
    setError(false);
    setLoading(true);
  }, [factoryId, refreshKey, image]);

  if (error || !factoryId) {
    return (
      <div className={`bg-accent/20 rounded-lg flex items-center justify-center text-primary ${className}`}>
        <Package size={24} className="opacity-30" />
      </div>
    );
  }

  return (
    <div className={`relative bg-background rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <RefreshCw size={16} className="text-primary animate-spin opacity-30" />
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
    </div>
  );
};

export default ProductImage;
