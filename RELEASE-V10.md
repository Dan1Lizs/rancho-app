# Rancho El Soñado 10.0

## Entrega

- Roles de acceso aplicados en Supabase: `admin`, `encargado`, `bodega`, `planta`, `bienestar` y `consulta`.
- Políticas RLS por tabla y funciones auxiliares alojadas en un esquema privado.
- Función `invite-user` desplegable con JWT obligatorio y origen permitido.
- Guardado de colecciones protegido frente a cambios concurrentes.
- Matriz diaria corregida: agua/chequeo y mortalidad cero forman parte del estado completo.
- Pegado masivo con detección de duplicados existentes y dentro del bloque pegado.
- Navegación por URL compatible con la advertencia de cambios pendientes.
- Componentes de captura separados en `src/components` y `src/features/captura`.
- CSS crítico trasladado a `src/v10.css`.
- SheetJS actualizado a 0.20.3 y cargado bajo demanda; auditoría de dependencias sin vulnerabilidades conocidas.

## Verificación

```bash
pnpm install --frozen-lockfile
pnpm build
node --test tests/*.test.js
pnpm audit --prod
```

## Configuración

La aplicación acepta `VITE_SUPABASE_PUBLISHABLE_KEY` (recomendado) y conserva compatibilidad con `VITE_SUPABASE_ANON_KEY`.

En Supabase Auth debe habilitarse manualmente **Leaked password protection**. Es el único aviso de seguridad pendiente del asesor y no existe una operación disponible en la integración para cambiarlo.
