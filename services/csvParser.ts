import { ParsedInitialInventory, ParsedSale, ParsedTransfer } from '../types';

const detectDelimiter = (line: string): string => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
};

export const parseInitialInventoryCSV = (csvContent: string): ParsedInitialInventory[] => {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];
  
  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
  
  // Soporte para variaciones de cabeceras
  const idVentaIdx = headers.findIndex(h => h === 'id_venta' || h === 'id venta' || h === 'codigo');
  const priceIdx = headers.findIndex(h => h === 'price' || h === 'precio');
  const costIdx = headers.findIndex(h => h === 'cost' || h === 'costo');
  const idFabricaIdx = headers.findIndex(h => h === 'id_fabrica' || h === 'id fabrica');
  const qtyIdx = headers.findIndex(h => h === 'qty' || h === 'cantidad' || h === 'stock');
  const descIdx = headers.findIndex(h => h === 'description' || h === 'descripcion');

  return lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim());
    return {
      id_venta: values[idVentaIdx] || '',
      price: parseInt(values[priceIdx] || '0', 10) || 0,
      cost: parseInt(values[costIdx] || '0', 10) || 0,
      id_fabrica: values[idFabricaIdx] || '',
      qty: parseInt(values[qtyIdx] || '0', 10) || 0,
      description: values[descIdx] || '',
    };
  });
};

export const parseTransferCSV = (csvContent: string): ParsedTransfer[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return [];

    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    
    const sitioInicIdx = headers.findIndex(h => h === 'sitio_inicial' || h === 'origen');
    const sitioFinalIdx = headers.findIndex(h => h === 'sitio_final' || h === 'destino');
    const idVentaIdx = headers.findIndex(h => h === 'id_venta' || h === 'id venta' || h === 'codigo');
    const qtyIdx = headers.findIndex(h => h === 'qty' || h === 'cantidad');

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim());
        return {
            sitio_inicial: values[sitioInicIdx] || '',
            sitio_final: values[sitioFinalIdx] || '',
            id_venta: values[idVentaIdx] || '',
            qty: parseInt(values[qtyIdx] || '0', 10) || 0
        };
    });
};

export const parseSalesCSV = (csvContent: string): ParsedSale[] => {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return [];

    const delimiter = detectDelimiter(lines[0]);
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    
    // Formato: timestamp; lugar; cod_fabrica; cod_venta; description; precio; qty
    const timestampIdx = headers.findIndex(h => h === 'timestamp' || h === 'fecha');
    const lugarIdx = headers.findIndex(h => h === 'lugar' || h === 'tienda');
    const codFabricaIdx = headers.findIndex(h => h === 'cod_fabrica' || h === 'cod fabrica');
    const codVentaIdx = headers.findIndex(h => h === 'cod_venta' || h === 'id_venta' || h === 'cod venta' || h === 'codigo');
    const descIdx = headers.findIndex(h => h === 'description' || h === 'descripcion');
    const precioIdx = headers.findIndex(h => h === 'precio' || h === 'price');
    const qtyIdx = headers.findIndex(h => h === 'qty' || h === 'cantidad');

    return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim());
        return {
            timestamp: values[timestampIdx] || '',
            lugar: values[lugarIdx] || '',
            cod_fabrica: values[codFabricaIdx] || '',
            cod_venta: values[codVentaIdx] || '',
            description: values[descIdx] || '',
            precio: parseInt(values[precioIdx] || '0', 10) || 0,
            qty: parseInt(values[qtyIdx] || '1', 10) || 1,
        };
    });
};
