# Revisión del proyecto — septiembre de 2026

Alcance: archivos versionados en `main`, flujo de bodega, persistencia, esquema SQL, autenticación, historiales, documentación, pruebas y compilación. Esta revisión es estática: no incluye una consulta autenticada a la base de producción ni confirma los valores concretos de los movimientos del 25.

## Resuelto en v8.5

- **Duplicados de bodega:** el formulario creaba un objeto sin `id` cada vez que guardaba y la tabla `bodega_movs` solo exigía unicidad por `id`. Dos clientes podían insertar dos filas con la misma fecha. Los días nuevos usan ahora `bodega-AAAA-MM-DD`; las ediciones conservan el ID elegido y leen la colección actual antes de escribir. Los duplicados existentes se pueden unificar desde el historial tras elegir la fila que se conserva y escribir un motivo. La fila conservada guarda los valores anteriores y los duplicados retirados. La auditoría SQL de la base también registra los cambios si está instalada.
- **Consulta histórica:** listas antes limitadas a 8–20 filas tienen períodos de 30 días, 90 días, mes actual, un año o todo. El historial de bodega muestra fecha completa para distinguir años.
- **Fecha local:** los formularios usaban la fecha UTC para el valor predeterminado, que puede ser mañana durante la tarde/noche en Costa Rica. Ahora usan el calendario local del dispositivo; las marcas de tiempo de auditoría siguen en UTC.
- **Limpieza:** se sustituyó el archivo `download` por `.gitignore`; documentación y mensaje de instalación ahora apuntan al esquema existente. No había claves privadas ni archivos `dist` versionados.

## Riesgos pendientes

1. **Unicidad en la base:** `bodega_movs` aún no tiene una restricción única sobre la fecha dentro de `data`. El ID estable protege los guardados de esta versión, pero una pestaña antigua o una escritura externa puede seguir creando otra fila con distinto ID. El archivo `MIGRACION-BODEGA-UNICA.sql` deja preparado un índice único normalizando formatos D/M/A e ISO; debe ejecutarse en Supabase después de resolver los duplicados existentes. No se aplicó a la base de producción desde esta revisión.
2. **Guardados de varias tablas:** varias acciones escriben colecciones sucesivamente (`registros`, `lotes`, medicamentos, insumos, etc.). Si falla una petición intermedia, puede quedar una operación parcial. Conviene trasladar operaciones críticas a transacciones SQL/RPC y agregar pruebas de fallo intermedio.
3. **Cambios simultáneos:** la capa `storage.js` compara contra un caché local por ID, sin control de versión (`updated_at`) al actualizar una misma fila. Dos usuarios que cambien esa fila a la vez pueden sobrescribirse. La lectura inmediata antes de guardar bodega reduce la ventana, pero no la elimina.
4. **Permisos:** las políticas SQL conceden lectura, inserción, actualización y eliminación de todas las tablas a cualquier usuario autenticado. El control de administrador en la interfaz no impide cambios directos a la API. Si habrá distintos niveles de acceso, se necesitan políticas RLS basadas en roles.
5. **Mantenibilidad y cobertura:** `src/App.jsx` concentra la mayoría de la lógica y el paquete principal supera 1,5 MB antes de compresión. Las pruebas actuales cubren reglas puras, pero no los flujos de sesión, sincronización y fallos reales de Supabase. Extraer módulos y añadir pruebas de integración ayudará a detectar regresiones.

La versión 8.5 verifica las pruebas automatizadas y `npm run build`. El estado del movimiento del 25 deberá revisarse en la app: si las dos filas difieren, la persona responsable debe elegir cuál conservar antes de guardar la corrección.
