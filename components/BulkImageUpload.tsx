import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';
import { useToast } from '../hooks/useToast';
import { useInventory } from '../context/InventoryContext';

interface BulkImageUploadProps {
  onSuccess?: () => void;
}

const BulkImageUpload: React.FC<BulkImageUploadProps> = ({ onSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const { addToast } = useToast();
  const { bulkUploadImages } = useInventory();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const stats = await bulkUploadImages(files);
      
      if (stats.success > 0) {
        addToast(`Carga masiva completada: ${stats.success} fotos vinculadas con éxito.`, 'success');
        onSuccess?.();
      } else if (stats.failed > 0) {
        addToast(`No se pudo procesar ninguna foto (${stats.failed} fallidas).`, 'error');
      }
    } catch (error) {
       addToast(`Error al procesar la carga masiva.`, 'error');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
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
              <span className="text-[10px] mt-1 font-bold">
                PROCESANDO ARCHIVOS...
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
