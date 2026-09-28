# Rancho El Soñado

Aplicación React/Vite para la operación de la granja. Los datos se guardan en Supabase mediante las tablas de `supabase_v2_actualizado.sql`; el repositorio no contiene datos de producción ni claves privadas.

## Desarrollo

1. `npm ci`
2. Copia `env.example` a `.env.local` y configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. `npm run dev`

Verificación: `node --test tests/*.test.js` y `npm run build`. Vercel publica los cambios integrados en `main`.

Los archivos `README-INSTALACION.md` y `README-MIGRACION-V6.md` describen pasos históricos de puesta en marcha; la fuente actual del esquema es `supabase_v2_actualizado.sql`.
