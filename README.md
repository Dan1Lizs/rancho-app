# Rancho El Soñado

Aplicación React/Vite para la operación de la granja. Los datos se guardan en Supabase mediante las tablas de `supabase_v2_actualizado.sql`; el repositorio no contiene datos de producción ni claves privadas.

## Desarrollo

1. `npm ci`
2. Copia `env.example` a `.env.local` y configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. `npm run dev`

Verificación: `node --test tests/*.test.js` y `npm run build`. Vercel publica los cambios integrados en `main`.

## Versión 10.1.1

La interfaz usa navegación lateral por áreas en computadora y navegación inferior en teléfono. Incluye inicio operativo, búsqueda global, reportes segmentados, historial de Planta y control diario imprimible. La importación JSON ahora ofrece vista previa y confirmación explícita; el guardado evita pisar configuraciones editadas en paralelo y bloquea secciones con lecturas fallidas. Los enlaces restauran filtros y resaltan registros concretos cuando hay un identificador disponible.

La administración de usuarios por invitación usa roles con RLS en Supabase. Para preparar otro entorno:

1. Aplicar las migraciones versionadas de `supabase/migrations/` en orden. En el proyecto conectado, el historial de migraciones ya está aplicado.
2. Para invitar usuarios, desplegar `supabase/functions/invite-user` con verificación JWT activa y configurar `APP_ORIGIN` como secreto de la función. `SUPABASE_SERVICE_ROLE_KEY` debe quedar exclusivamente en los secretos de Supabase.

Las copias JSON incluyen información operativa y financiera. Solo un administrador puede acceder a **Administración → Datos y respaldos**; conserva los archivos en un lugar privado. La exportación mensual a Excel permanece en Historial.

La matriz vigente de puntos revisados está en `AUDITORIA-PUNTOS-SELECCIONADOS.md`. `MIGRACION-V10-USUARIOS.sql`, `README-INSTALACION.md`, `README-MIGRACION-V6.md` y `supabase_v2_actualizado.sql` conservan valor histórico; el historial actual de cambios de base está en `supabase/migrations/`.
