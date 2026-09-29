# Revisión de `App (2).jsx`

Se comparó con la rama principal de v9.0. El archivo adjunto es una variante completa de `App.jsx` (v9.1), no un parche pequeño. Sustituirlo entero quitaría una sección extensa del reporte gerencial que ya está en producción. También mezcla interfaz móvil y de computadora con barras horizontales similares.

## Integrado en v10

- La idea de agrupar la navegación, adaptada a menú lateral en computadora y barra inferior en teléfono.
- Búsqueda global con teclado; se amplió a galpones, fórmulas, insumos, materias primas y registros.
- Filtros por texto, tipo, categoría, fórmula y fechas para el historial de planta, conteo de resultados e impresión de lo filtrado.
- Corrección con motivo e historial de cambios para datos descriptivos de planta (detalle, número y responsable).

## Ajustado por integridad de datos

La edición propuesta cambiaba kilos, baches, porciones, fórmula y fecha y escribía movimientos de kardex antes de confirmar el movimiento de planta. Si fallaba una escritura, quedaban inventarios incoherentes. La eliminación propuesta revertía efectos después de borrar la fila y tampoco era atómica. Por eso la corrección nueva no modifica cantidades; para diferencias físicas se utiliza el ajuste por conteo que ya existe. Una edición de cantidades deberá ser una transacción en Supabase que cambie planta, kardex y núcleo como una unidad, con pruebas sobre fallos intermedios. La eliminación histórica existente de planta también requiere esa migración antes de considerarla completamente segura.

## Pendiente de verificación externa

Los roles, invitaciones y recuperación de contraseña tienen código y migración preparados, pero necesitan configuración en Supabase. Las pruebas locales no confirman datos ni permisos de la base de producción. La interfaz móvil y la de computadora deben probarse en dispositivos reales con usuarios de la granja.
