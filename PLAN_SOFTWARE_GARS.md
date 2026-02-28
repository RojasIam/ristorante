# Plan de Arquitectura y Funcionalidad del Sistema (GARS Ristorante)

Este documento describe la estructura lógica, roles y flujo operativo del software que estamos construyendo. Su objetivo es asegurar que la implementación técnica refleje fielmente la operación real del restaurante.

## 1. Visión General

El sistema está diseñado para gestionar las operaciones críticas de un restaurante de alta gama (`Dellicatesen`), centrándose en la **seguridad**, **escalabilidad** y **control granular de datos** (inventarios y horarios) por áreas específicas.

## 2. Módulos Principales (Estructura del Software)

### A. Gestión de Sala (Front of House)

- **Responsable:** Maître (Capo Sala).
- **Funciones Clave:**
  - **Inventario de Bebidas:** Control de stock de vinos, licores y suministros de sala.
  - **Horarios de Camareros:** Asignación de turnos al personal de servicio.
  - **Personal:** Camareros (apoyan en inventario y cumplen horarios).

### B. Gestión de Cocina (Back of House)

- **Responsable:** Executive Chef.
- **Estructura Jerárquica:** El Chef tiene visión y control total sobre 5 sub-áreas críticas:
  1.  **Salumeria**
  2.  **Primi**
  3.  **Secondi**
  4.  **Dolci**
  5.  **Antipasto**

- **Funciones por Área:**
  - **Inventario Dual:** Cada área gestiona dos tipos de stock independientes:
    1.  **Materia Prima (Raw Materials):** Ingredientes básicos (harina, carne cruda, vegetales).
    2.  **Preparaciones (Insumos):** Elementos procesados (salsas, masas, cortes listos).

### C. Sistema de Personal y Roles

El software refleja la jerarquía operativa mediante un sistema de permisos estricto.

| Rol en Sistema               | Rol Operativo   | Permisos y Responsabilidades                                                                                                             |
| :--------------------------- | :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| **Super Admin / Tecnología** | Dueño / CTO     | Acceso total al sistema y configuración global.                                                                                          |
| **Amministratore**           | Gerente         | Gestión administrativa general.                                                                                                          |
| **Executive Chef**           | Jefe de Cocina  | **Control Total Cocina:** Asigna horarios a todos los cocineros, ve todos los inventarios de cocina, define menús y recetas.             |
| **Maître (Capo Sala)**       | Jefe de Sala    | **Control Sala:** Asigna horarios a camareros, gestiona inventario de vinos/bebidas.                                                     |
| **Cuoco (Encargado)**        | Jefe de Partida | **Gestión de Área:** Asignado a una o más áreas (ej. Primi). Puede _modificar_ inventarios (materia prima y preparaciones) de _su_ área. |
| **Cuoco (Ayudante)**         | Cocinero Línea  | **Visualización:** Asignado a un área. Puede _ver_ recetas y stocks, pero NO modificar inventarios.                                      |
| **Cameriere**                | Camarero        | **Operativo Sala:** Visualiza sus horarios y apoya en conteos de inventario de sala (si se le asigna permiso).                           |

## 3. Flujos de Trabajo ("Workflows")

### Flujo 1: Gestión de Inventarios (La "Cocina Digital")

1.  **Recepción:** Ingreso de materia prima al almacén general o directo a un área (Salumeria).
2.  **Producción:** El Cuoco Encargado registra la transformación de _Materia Prima_ -> _Preparación_ (ej. Carne + Especias -> Ragú).
3.  **Servicio:** El sistema descuenta stock basado en los platos vendidos (Menú) o mermas reportadas.
4.  **Auditoría:** El Chef puede auditar el stock de cualquier área en tiempo real.

### Flujo 2: Gestión de Horarios ("Orario")

1.  **Configuración:** El sistema permite definir turnos (Mañana, Tarde, Noche).
2.  **Asignación:**
    - El **Chef** asigna turnos a los Cuocos Encargados y Ayudantes, distribuyéndolos por las 5 áreas.
    - El **Maître** asigna turnos a los Camareros en el área de Sala.
3.  **Visualización:** Cada empleado (Cuoco/Cameriere) accede al sistema y ve _solo_ su propio horario y área asignada.

## 4. Arquitectura Técnica Actual

- **Base de Datos (Supabase):**
  - `profiles`: Usuarios y roles globales.
  - `areas`: Definición de las 5 estaciones + Sala + Chef.
  - `area_assignments`: Tabla pivote clave que vincula `Usuario` <-> `Área` <-> `Rol en Área` (Encargado vs Ayudante).
  - `inventory_raw` / `inventory_preparations` / `inventory_wines`: Tablas de stock segmentadas.
  - `work_shifts`: Tabla de turnos.
- **Frontend (Next.js):**
  - **Tablero de Mando (Dashboard):** Vistas personalizadas según el rol.
  - **Módulos Dinámicos:** Las pestañas de "Cocina" cargan datos filtrados por el área seleccionada (Primi, Dolci, etc.).

---

Este plan asegura que el desarrollo no sea solo una lista de tareas, sino la construcción de una herramienta que modela y optimiza el funcionamiento real de `Dellicatesen`.
