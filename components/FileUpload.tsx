import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import Button from './Button';

interface FileUploadProps {
  onFileProcess: (content: string, file: File) => Promise<void> | void;
  title?: string;
  acceptedTypes?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileProcess, 
  title = "Arrastra y suelta tu archivo CSV o XLSX",
  acceptedTypes = ".csv,.xlsx" 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setStatus('loading');
    setFileName(file.name);
    
    try {
        // Para CSV leemos como texto, para XLSX el procesador se encargará o usaremos la librería en el contexto
        // Pero aquí lo pasamos al padre para que decida cómo leerlo
        if (file.name.endsWith('.xlsx')) {
             // El contexto maneja XLSX directamente en sus funciones si se le pasa el objeto File
             // Pero las funciones actuales reciben 'content' (string).
             // Vamos a estandarizar: si es XLSX, mandamos un string vacío y el File original.
             await onFileProcess('', file);
        } else {
            const content = await file.text();
            await onFileProcess(content, file);
        }
        setStatus('success');
        setTimeout(() => {
            setStatus('idle');
            setFileName(null);
        }, 3000);
    } catch (error) {
        console.error('File process error:', error);
        setStatus('error');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div 
      className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-300 text-center ${
        isDragging ? 'border-secondary bg-secondary/10 scale-[1.02]' : 'border-accent hover:border-primary'
      } ${
        status === 'loading' ? 'opacity-70 pointer-events-none' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={acceptedTypes}
        className="hidden"
      />

      <div className="flex flex-col items-center space-y-3">
        {status === 'idle' && (
          <>
            <div className="p-3 bg-accent/20 rounded-full text-primary">
              <Upload size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-primary uppercase tracking-tight">{title}</p>
              <p className="text-[10px] text-text-light mt-1">SOPORTA .CSV Y .XLSX</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Seleccionar Archivo
            </Button>
          </>
        )}

        {status === 'loading' && (
          <>
            <div className="animate-spin text-primary">
              <Upload size={32} />
            </div>
            <p className="text-sm font-bold text-primary animate-pulse">PROCESANDO {fileName?.toUpperCase()}...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-success scale-125 transition-transform duration-500">
              <CheckCircle size={40} />
            </div>
            <div>
              <p className="text-sm font-bold text-success">¡PROCESADO CON ÉXITO!</p>
              <p className="text-[10px] text-text-light mt-1">{fileName}</p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-danger">
              <AlertCircle size={40} />
            </div>
            <div>
              <p className="text-sm font-bold text-danger">ERROR AL PROCESAR</p>
              <p className="text-[10px] text-text-light mt-1">Revisa el formato del archivo</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => setStatus('idle')}>Reintentar</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
