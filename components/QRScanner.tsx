import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, title = "Escanear Código" }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScan(decodedText);
      },
      (error) => {
        // Ignorar errores de escaneo continuo
      }
    );

    return () => {
      scanner.clear().catch(error => console.error("Error clearing scanner", error));
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/75 z-[100] flex justify-center items-center p-4">
      <div className="bg-background-light rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
        <div className="flex justify-between items-center p-4 border-b border-accent bg-primary text-white">
          <h3 className="text-lg font-bold italic uppercase tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <div id="qr-reader" className="overflow-hidden rounded-lg border-2 border-accent"></div>
          <p className="text-center text-xs text-text-light mt-4 italic">
            Coloca el código QR o código de barras frente a la cámara.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
