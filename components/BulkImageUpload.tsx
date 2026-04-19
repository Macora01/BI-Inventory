import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';
import { useToast } from '../hooks/useToast';

interface BulkImageUploadProps {
  onSuccess?: () => void;
}

const BulkImageUpload: React.FC<BulkImageUploadProps> = ({ onSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
  const { addToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setProgress({ current: 0, total: files.length });

    const total = files.length;
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      // El nombre del archivo debe ser factoryId.jpg o factoryId.png o similar
      const factoryId = file.name.split('.')[0];
      
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`/api/upload?type=product&factoryId=${factoryId}`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
      
      setProgress({ current: i + 1, total });
    }

    setIsUploading(false);
    setProgress(null);
    
    if (successful > 0) {
      addToast(`Carga masiva completada: ${successful} exitosas, ${failed} fallidas.`, 'success');
      onSuccess?.();
    } else if (failed > 0) {
      addToast(`Error en carga masiva: ${failed} imágenes fallaron.`, 'error');
    }

    if (e.target) e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          onChange={handleFileChange}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <Button 
          variant="secondary" 
          className="w-full h-24 flex flex-col items-center justify-center dashed border-2"
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <RefreshCw size={24} className="animate-spin mb-2" />
              <div className="w-full max-w-[150px] bg-accent/30 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                    className="bg-primary h-full transition-all duration-300" 
                    style={{ width: `${(progress?.current || 0) / (progress?.total || 1) * 100}%` }}
                ></div>
              </div>
              <span className="text-[10px] mt-1 font-bold">
                PROCESANDO {progress?.current} / {progress?.total}
              </span>
            </>
          ) : (
            <>
              <Upload size={24} className="mb-2" />
              <span className="text-xs font-bold uppercase">Seleccionar Múltiples Fotos</span>
            </>
          )}
        </Button>
      </div>
      <p className="text-[10px] text-text-light text-center">
        Los archivos deben coincidir con el <strong>CÓDIGO DE FÁBRICA</strong> del producto.
      </p>
    </div>
  );
};

export default BulkImageUpload;
