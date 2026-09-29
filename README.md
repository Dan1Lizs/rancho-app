# Rancho El Soñado

Aplicación React/Vite para la operación de la granja. Los datos se guardan en Supabase mediante las tablas de `supabase_v2_actualizado.sql`; el repositorio no contiene datos de producción ni claves privadas.

## Desarrollo

1. `npm ci`
2. Copia `env.example` a `.env.local` y configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. `npm run dev`

Verificación: `node --test tests/*.test.js` y `npm run build`. Vercel publica los cambios integrados en `main`.

## Versión 10.0

La interfaz usa navegación lateral por áreas en computadora y navegación inferior en teléfono. Incluye inicio operativo, búsqueda global, recuperación de contraseña y filtros e impresión del historial de planta. La corrección guiada de planta modifica únicamente detalle, número y responsable, con motivo e historial; los kilos, fórmulas y porciones requieren ajuste físico para conservar el inventario.

La administración de usuarios por invitación requiere dos pasos de despliegue adicionales **antes de utilizar sus botones**:

1. Revisar y ejecutar `MIGRACION-V10-USUARIOS.sql` en el proyecto Supabase. El script conserva los accesos existentes, crea roles y sustituye políticas RLS; comprobar en un proyecto de prueba que el usuario administrador conserva acceso y que una cuenta de consulta no puede escribir. La lista anterior `cfgAdmins` solo sirve para asignar roles iniciales.
2. Desplegar `supabase/functions/invite-user` en Supabase Edge Functions con verificación JWT activa y configurar `APP_ORIGIN` con la URL exacta de producción. La clave `SUPABASE_SERVICE_ROLE_KEY` queda exclusivamente en los secretos de Supabase. Añadir la URL de producción a los redirect URLs de Supabase Auth para invitaciones y recuperación de contraseña.

Si la migración no se ha aplicado, la interfaz conserva la lista anterior de administradores y muestra que las invitaciones aún no están configuradas. No se debe anunciar la administración de usuarios como activa hasta verificar esos pasos en Supabase.

Los archivos `README-INSTALACION.md` y `README-MIGRACION-V6.md` describen pasos históricos de puesta en marcha; la fuente actual del esquema es `supabase_v2_actualizado.sql`.
