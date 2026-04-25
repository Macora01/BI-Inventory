# Master Prompt: Sistema de Gestión de Inventario "Boa Ideia" (v1.3.x)

## Objetivo
Desarrollar una aplicación full-stack de gestión de inventario profesional diseñada para operaciones minoristas con múltiples ubicaciones físicas (bodegas y tiendas), con un enfoque crítico en la integridad de datos, trazabilidad de movimientos y una estética premium.

---

## 1. Stack Tecnológico
- **Frontend**: React 18+ con TypeScript y Vite.
- **Estilo**: Tailwind CSS (esquema de colores: Marrón Café #3D2311, Dorado #C5A47E, Crema/Ivory #F5F2E8).
- **Iconografía**: Lucide React.
- **Backend**: Node.js con Express.
- **Base de Datos**: PostgreSQL (con persistencia física, no scripts temporales).
- **Integración**: Vite como middleware en el servidor Express.

---

## 2. Requerimientos Funcionales Core

### A. Gestión de Productos
- Catálogo detallado con: Código de Venta, Código de Fábrica, Descripción, Precio de Venta e Imagen.
- Soporte para carga masiva vía CSV (separado por punto y coma `;`).
- Filtros de búsqueda en tiempo real por cualquier atributo.

### B. Gestión de Inventario Multi-Ubicación
- Soporte para múltiples bodegas y almacenes (IDs personalizados: BODCENT, ALMVLT, etc.).
- Visualización matricial: Una fila por producto, múltiples columnas con el stock actual en cada ubicación.

### C. Motor de Movimientos (Trazabilidad)
- **Entradas**: Carga inicial de stock o compras.
- **Traslados**: Movimiento de mercancía entre ubicaciones.
- **Salidas/Ventas**: Descuento de stock por venta.
- **Regla de Oro**: Ningún stock debe cambiar sin un registro detallado en la tabla de `movements`.

### D. Inteligencia de Datos y Reportes
- **Dashboard Ejecutivo**: Resumen de valor de inventario, unidades totales, tendencia de ventas y alertas de bajo stock.
- **Reporte de Existencias**: Generador de inventario a fecha retroactiva basado en la reconstrucción del historial.
- **Sincronización Maestra**: Herramienta para recalcular el stock físico (`stock`) sumando todos los movimientos (`movements`) desde el inicio de los tiempos.

---

## 3. Lógica Crítica de Negocio (Instrucciones para la IA)

- **Deduplicación de Cargas**: Al importar CSV o registrar movimientos, implementar una lógica de deduplicación que evite duplicar cantidades si se pulsa el botón dos veces (usar timestamps o hashes de fila).
- **Normalización de IDs**: Forzar que todos los IDs de producto y ubicación se traten en mayúsculas (`UPPER`) y sin espacios (`TRIM`) tanto en el cliente como en el servidor para evitar discrepancias matemáticas (ej: "bodcent" == "BODCENT").
- **Integridad Atómica**: Al mover stock, la resta en el origen y la suma en el destino deben ocurrir dentro de una transacción de base de datos o asegurar consistencia total.
- **BODCENT**: Tratar a `BODCENT` como la ubicación raíz y principal del sistema.

---

## 4. Guía de Interfaz (Look & Feel)
- **Barra Lateral**: Fija, color café oscuro (#3D2311) con logotipos e indicadores de versión.
- **Tarjetas (Cards)**: Bordes suaves, fondo Ivory (#F5F2E8) y acentos dorados para los encabezados de tabla.
- **Toasts**: Notificaciones flotantes para confirmar acciones exitosas o errores.

---

## 5. Arquitectura de Despliegue e Infraestructura
- **Plataforma**: Aplicación web full-stack diseñada para ser hosteada en un **VPS de Hostinger**.
- **Gestión de Despliegue**: Desplegada mediante **Coolify**, aprovechando la automatización de Docker y CI/CD desde GitHub.
- **Base de Datos**: Se utiliza el servicio de **PostgreSQL nativo de Coolify**, vinculado a la aplicación mediante variables de entorno (`DATABASE_URL` o configuración individual de host, puerto, usuario y contraseña).
- **Contenedorización**:
  - Puerto de exposición: `3000`.
  - Proceso de Build: `npm install --include=dev` seguido de `npm run build`.
  - Runtime: Node.js 20+ ejecutando `server.ts` (vía `tsx`) o los archivos compilados en `dist/` en modo producción.
- **Persistencia**: La base de datos PostgreSQL en Coolify garantiza que los datos no se pierdan entre reinicios o nuevos despliegues del contenedor de la aplicación.
