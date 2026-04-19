import { GoogleGenAI } from "@google/genai";
import { Product, Stock, Movement } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeInventoryData(products: Product[], stock: Stock[], movements: Movement[]): Promise<string> {
  const prompt = `
    Analiza los siguientes datos de inventario y genera exactamente 3 insights estratégicos en formato JSON.
    El formato de salida DEBE ser un array de objetos con las propiedades: "title", "insight" y "recommendation".
    
    PRODUCTOS: ${JSON.stringify(products.map(p => ({ id: p.id_venta, desc: p.description, cost: p.cost, price: p.price })))}
    STOCK: ${JSON.stringify(stock)}
    MOVIMIENTOS (Últimos 100): ${JSON.stringify(movements.slice(0, 100).map(m => ({ id: m.productId, type: m.type, qty: m.quantity, time: m.timestamp })))}

    Responde únicamente con el JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    let text = response.text.trim();
    
    // Limpieza básica de markdown si la IA lo incluye
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return JSON.stringify([
      {
        title: "Análisis no disponible",
        insight: "No se pudo realizar el análisis de IA en este momento.",
        recommendation: "Verifica la configuración de la API Key o intenta más tarde."
      }
    ]);
  }
}
