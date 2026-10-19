# Auditoría e integración de puntos seleccionados

Estado revisado el 18/10/2026. Se revisaron los 34 puntos pedidos del backlog de 60. “Implementado” significa que el flujo está en el código y tiene evidencia automatizada o verificación de base; “parcial” indica que existe una parte útil, pero no cubre toda la garantía prometida; “pendiente” requiere prueba o trabajo adicional.

## Acceso y captura

| Punto | Estado | Resultado y brecha restante |
|---|---|---|
| 6 · Guardado idempotente | Parcial | Se conservan las restricciones únicas de control/pesaje y los reintentos de fila; además, se reconocen altas idénticas repetidas. Las acciones que abarcan varias tablas todavía no son atómicas. |
| 7 · Edición concurrente | Parcial | Las colecciones y configuraciones usan comparación contra la versión leída; una lectura fallida bloquea el guardado de esa clave y se avisa si una escritura no se aplicó. Falta una resolución uniforme con comparación visible en todos los módulos. |
| 9 · Validaciones de captura | Parcial | El guardado de control diario bloquea números no válidos/negativos, fracciones en conteos de aves y mortalidad superior al saldo. El resumen previo y las validaciones no cubren todavía todos los campos de todos los módulos. |
| 10 · Requisitos según etapa | Implementado | La etapa histórica del lote determina si cuenta en postura y qué obligaciones corresponden; levante y estados especiales quedan fuera de los KPIs de postura. |
| 11 · Formulario de lote visible | Implementado | Crear y editar lote desplaza la pantalla hasta el formulario. |
| 12 · Ciclo e historial de lotes | Implementado | Alta, etapas fechadas, cierre/reapertura y consulta histórica conservan los registros por fecha. |

## Producción, planta e inventarios

| Punto | Estado | Resultado y brecha restante |
|---|---|---|
| 13 · Excepciones operativas | Parcial | Revisión ahora identifica registros de producción y pesajes futuros, cantidades negativas, duplicados y saldos fuera de rango con destinos al registro. No existe aún un catálogo exhaustivo para toda combinación de postura, mortalidad, alimento y agua. |
| 14 · KPIs explicables | Parcial | El cálculo de postura conserva lotes elegibles y muestra conteo y motivo de exclusión (levante, etapa especial, cierre o fecha incompleta). Falta explicar de la misma forma cada variable de todos los KPIs. |
| 15 · Referencias genéticas | Implementado | Se consultan por línea y semana con fuente; cuando falta una semana, no se extrapola silenciosamente. |
| 21 · Fórmula y núcleo por bache | Implementado | Cada bache conserva su receta y núcleo aplicados; cambiar la fórmula vigente no reescribe el pasado. |
| 23 · Corrección del historial de Planta | Implementado | Se pueden corregir campos operativos con motivo y auditoría; los cambios de cantidades recalculan movimientos derivados. |
| 24 · Alimento comprado separado | Implementado | Compras y consumos de alimento comprado no se mezclan con el saldo de producción propia. |
| 25 · Cierre del inventario comprado | Implementado | Se puede cerrar/archivar sin borrar movimientos; reapertura queda protegida por administración. |
| 26 · Conversión a kilos | Implementado | Las presentaciones convierten sacos y kilos a una unidad común de inventario. |
| 28 · Kardex por fecha | Implementado | El historial reconstruye saldos y ajustes en kg para la fecha consultada; tiene pruebas de recálculo. |
| 30 · Prevención de inconsistencias | Parcial | Control diario bloquea números negativos/no numéricos y Revisión detecta fechas futuras y cantidades negativas en producción, pesajes y Planta. Falta un validador único que cubra entradas, ajustes y presentaciones en cada módulo. |

## Alertas, permisos, reportes y enlaces

| Punto | Estado | Resultado y brecha restante |
|---|---|---|
| 35 · Ir al origen de la alerta | Parcial | Alertas de control diario, bodega, Planta y pesaje pueden abrir la fecha/sección y resaltar el registro exacto si tiene ID. Algunas alertas de resumen todavía llevan solo a la vista general. |
| 36 · Historial de alertas | Implementado | Desactivar, modificar y reactivar conserva responsable, razón y eventos anteriores. |
| 37 · Datos sensibles y exportación | Parcial | Las tablas financieras requieren rol administrador; además, el almacén legado `kv`, que conserva copias históricas, quedó limitado a administradores. Falta una matriz automatizada de permisos de lectura/exportación para cada rol. |
| 38 · Reportes segmentados | Implementado | Hay secciones seleccionables, impresión por sección y reporte integral en “Ver todo”. |
| 39 · Control diario imprimible | Implementado | El usuario confirma que ya probó la salida en su teléfono y funciona; se conserva la fecha elegida y el formato previsto. No requiere cambios en esta ronda. |
| 40 · Enlaces directos | Parcial | Los enlaces restauran la ruta al cargar, sub-sección, fecha, galpón, categoría/fórmula y algunos IDs; se añadieron pruebas de análisis/serialización. No cada formulario o filtro interno tiene URL propia. |

## Requisitos no funcionales seleccionados

| Punto | Estado | Resultado y brecha restante |
|---|---|---|
| 43 · N03 Comparación atómica | Parcial | Colecciones y claves de configuración usan compare-and-set; un fallo de lectura impide escribir sobre un valor de reserva. Una acción que toca varias tablas aún puede quedar parcialmente aplicada si falla a mitad. |
| 46 · N06 Permisos en servidor | Implementado | RLS vuelve a validar las escrituras por rol; `kv` también quedó restringido a administradores en Supabase. |
| 47 · N07 Minimizar datos leídos | Parcial | Algunas consultas solicitan campos concretos, pero las colecciones JSON siguen descargándose completas en varios flujos. |
| 48 · N08 Error distinto de vacío | Parcial | Los fallos se identifican por sección y permiten reintentar; mientras persiste el error, no se permiten escrituras sobre ese valor de reserva. Algunas vistas pueden seguir mostrando la reserva junto con el aviso global. |
| 52 · N12 Teclado y lector | Parcial | Los diálogos comunes ahora tienen trampa de foco, nombre accesible por título, Escape y restauración del foco. Falta auditar formularios y diálogos que no usan el componente compartido. |
| 53 · N13 Pruebas de impresión | Implementado | El usuario confirma la prueba satisfactoria en teléfono. Se retira de los pendientes y no se modifica este flujo. |
| 54 · N14 Modularización y tamaño | Parcial | Administración, Preferencias y el gráfico de postura se cargan bajo demanda; el gráfico pesado ya no forma parte de la descarga inicial. `App.jsx` todavía concentra la mayoría del sistema y el paquete principal sigue sobre 500 kB minificados. |
| 55 · N15 Historiales grandes | Parcial | Las consultas paginan la lectura de Supabase, pero después reúnen la colección completa y filtran periodos principalmente en el cliente. |
| 56 · N16 Cobertura | Parcial | 86 pruebas unitarias pasan, incluidas concurrencia, rutas, importación, permisos y migraciones locales. Faltan pruebas de componentes, Supabase autenticado y recorridos móviles. |
| 57 · N17 Integración continua | Parcial | GitHub Actions ejecuta pruebas y compilación; la suite comprueba formato/nombres y políticas de migraciones locales. No consulta todavía el historial remoto ni una base temporal. |
| 58 · N18 Respaldo y restauración | Parcial | Exportar/importar siguen en **Administración → Datos y respaldos**. Antes de escribir, la importación muestra colecciones, cantidades y conflictos y exige confirmación; aún es aditiva por filas, no una transacción global, y no incluye restauración/deshacer verificado. |
| 59 · N19 Migraciones visibles | Parcial | CI valida nombres, versiones únicas, orden y presencia de migraciones clave de seguridad/unicidad. Aún no compara automáticamente ese historial con Supabase remoto. |

## Cambios de esta ronda y verificación

- Supabase ya impone índices únicos para controles y pesajes por lote/fecha; se comprobó que no había duplicados antes de aplicarlos.
- Se protegió el almacén histórico `kv` para que solo administradores puedan leerlo o modificarlo. No se borró ningún dato.
- Se endurecieron las escrituras de colecciones para impedir una actualización o eliminación si el registro remoto cambió desde su lectura, y se agregó aviso de error de lectura.
- Se aplicó comparación concurrente también a ajustes/configuraciones. Un fallo de lectura bloquea guardados basados en valores de reserva y el aviso identifica las claves afectadas.
- Control diario bloquea cantidades no válidas y Revisión enlaza fechas futuras y cantidades negativas de producción/pesajes al registro exacto.
- La postura ahora explica cuántos lotes entran y los motivos por los que otros quedan fuera. Los enlaces iniciales restauran filtros y resaltan filas específicas cuando hay ID.
- Los diálogos comunes retienen el foco dentro de la ventana y la importación de respaldos primero ofrece una vista previa sin escrituras.
- Gráficos de postura, Administración y Preferencias se descargan cuando se abren, no al entrar a la aplicación.
- GitHub Actions incluye pruebas estáticas de nombres/orden de migraciones y políticas críticas.
- Exportar/importar datos dejó de estar oculto en el resumen mensual de Historial y pasó a **Administración → Datos y respaldos**. El Excel mensual permanece en Historial. Se detectó que el antiguo “Deshacer importación” no persistía el estado previo y por eso no se ofrece como una reversión segura.
- La versión funcional es **10.1.1**.
- Verificación local: 86/86 pruebas y compilación correctas. pnpm intentó crear un symlink bloqueado por el entorno, así que ejecuté directamente el mismo runner Node; Vite todavía advierte que el paquete principal mide aproximadamente 609 kB minificado, mientras que los gráficos y Excel están en chunks separados.
- La revisión de seguridad de Supabase mantiene una recomendación pendiente: activar la protección de contraseñas filtradas en Auth. No bloquea el uso actual.

La lista original de los 60 puntos permanece en [AUDITORIA-SEGUNDO-SPRINT.md](AUDITORIA-SEGUNDO-SPRINT.md). Esta matriz es la referencia actual para los 34 puntos seleccionados.
