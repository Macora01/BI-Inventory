# PRD: Sistema de Gestión de Inventario - Boa Ideia

## 1. Visión General
Este sistema ha sido diseñado para gestionar el inventario multicanal de **Boa Ideia**, permitiendo el control de existencias en tiempo real a través de diversas ubicaciones (Bodegas, Tiendas Fijas, Tiendas Móviles y Venta Online).

### Objetivo Principal
Mantener la "armonía entre lo digital y lo real", garantizando que el stock físico reportado coincida exactamente con los registros del sistema, superando las discrepancias históricas causadas por registros fragmentados o nombres de ubicación inconsistentes.

---

## 2. Arquitectura Técnica (Stack)
- **Frontend:** React 18+ con TypeScript y Vite.
- **Backend:** Node.js (Express) con un entry point unificado en `server.ts`.
- **Base de Datos:** 
    - **Primaria:** PostgreSQL (utilizando `pg` pool).
    - **Fallback/Persistencia Local:** Archivos JSON gestionados por `localDb.ts`.
- **Estilos:** Tailwind CSS para una interfaz limpia y responsiva.
- **Herramientas de Reporte:** `jspdf` y `jspdf-autotable` para exportación de datos.
- **Iconografía:** `lucide-react`.

---

## 3. Lógica de Negocio Crítica (El "Core")

### A. Gestión de Ubicaciones (Identidad Dual)
El sistema maneja las ubicaciones mediante un **ID** (ej. `BODCENT`) y un **Nombre** (ej. `Bodega Central`).
- **Regla Oro:** El sistema debe ser agnóstico a variaciones menores (mayúsculas, espacios o uso de ID vs Nombre). 
- **Normalización (v1.3.021):** Para evitar "ceros" en reportes, las búsquedas se realizan siempre en `.trim().toUpperCase()` y comparando simultáneamente ID y Nombre.

### B. Motor de Reportes (Evolución v1.3.021)
A diferencia de sistemas tradicionales que solo suman movimientos, este motor utiliza una **Lógica de Verdad Híbrida**:
1. **Reporte de Hoy:** Consulta directamente la tabla de `stock` consolidada. Si existen registros duplicados por inconsistencia de nombres en la DB, el código los **fusiona (deduplicación)** antes de mostrar el resultado.
2. **Reporte Histórico:** Reconstruye el stock sumando/restando movimientos previos a la fecha objetivo.

### C. Tipos de Movimientos
- `INITIAL_LOAD`: Carga masiva de inventario.
- `TRANSFER_IN` / `TRANSFER_OUT`: Movimientos pareados entre almacenes.
- `SALE`: Descuento de stock por venta.
- `ADJUSTMENT`: Correcciones manuales realizadas por el usuario.
- `REVERSION`: Anulación de movimientos previos.

---

## 4. Estado Actual: Versión 1.3.021 (Baseline Estable)
Esta versión es el punto de partida sólido. Ha resuelto los siguientes problemas críticos:
- **Duplicidad de Inventario:** Se eliminó el error que sumaba dos veces el stock cuando un producto aparecía registrado bajo el ID y el Nombre del almacén simultáneamente.
- **Reportes en Cero:** Se corrigió el fallo que impedía ver existencias en almacenes específicos (como `ALMVLT` o `ALMDGO`) debido a desajustes en el mapeo de IDs.
- **Consistencia:** El total global de "Todos los Almacenes" es ahora la suma exacta de sus partes individuales.

---

## 5. Instrucciones para el Próximo Desarrollador (AI o Humano)
1. **No tocar la lógica de normalización** en `ReportsPage.tsx` sin entender el impacto en la deduplicación.
2. **Priorizar `id_venta`** como llave primaria para productos.
3. **Mantenimiento de IDs:** Siempre que se añada una funcionalidad de escritura en `stock`, asegurar que el `locationId` sea transformado a mayúsculas para mantener la integridad.

---

## 6. Infraestructura de Datos
Las tablas clave en Postgres son:
- `products`: Catálogo maestro.
- `locations`: Registro de sitios autorizados.
- `stock`: Tabla de existencias actuales (PK: `productId`, `locationId`).
- `movements`: Registro histórico de logs (Audit Trail).

---
**Documento autogenerado para preservar la integridad del proyecto Boa Ideia.**
