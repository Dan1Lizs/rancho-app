# Segunda auditoría — propuesta de backlog

Estado posterior: de esta lista se revisaron los puntos 6, 7, 9, 10, 11, 12, 13, 14, 15, 21, 23, 24, 25, 26, 28, 30, 35, 36, 37, 38, 39, 40, 43, 46, 47, 48, 52, 53, 54, 55, 56, 57, 58 y 59. Su estado actual está en [AUDITORIA-PUNTOS-SELECCIONADOS.md](AUDITORIA-PUNTOS-SELECCIONADOS.md); este documento conserva la propuesta original y no debe leerse como que los 60 puntos están pendientes.

## Alcance y hallazgos observables

Esta revisión parte del código y las pruebas del repositorio; no es una prueba en campo ni una auditoría en vivo de la base de producción. En esta revisión, las 71 pruebas automatizadas pasan y la compilación termina correctamente. El paquete principal aún genera una advertencia de tamaño (aprox. 597 kB minificados), `src/App.jsx` tiene 8,761 líneas y la auditoría anterior todavía se presenta como versión 8.5, por lo que debe actualizarse contra el sistema vigente. El repositorio ya contiene políticas RLS por rol, pruebas de reglas de negocio y componentes extraídos; conviene comprobar que las migraciones desplegadas coincidan con las del repositorio.

Los requisitos siguientes son propuestas para priorizar; no están implementados por este documento. P0 = protege datos, permisos o saldos; P1 = mejora directamente la operación diaria; P2 = evolución y pulido.

## Requisitos funcionales (40)

### Acceso, usuarios y captura

1. **F01 · P0** — Toda vista y toda acción deben validar el rol; una ruta no autorizada debe explicar que el acceso está restringido y cómo solicitarlo.
2. **F02 · P0** — Las acciones sensibles (borrar, corregir saldos, cambiar roles y cerrar inventarios) deben solicitar confirmación adecuada y registrar actor, fecha y motivo.
3. **F03 · P1** — Administración debe permitir invitar, cambiar rol, suspender y revocar usuarios, con una vista previa del alcance de cada rol.
4. **F04 · P1** — Borradores y preferencias deben permanecer separados por usuario, dispositivo y formulario, con recuperación y descarte visibles; Bodega solo debe pedir conservar un borrador tras una edición manual que siga siendo distinta de la base. *(La detección de Bodega se acaba de endurecer.)*
5. **F05 · P1** — La matriz diaria debe mostrar, por galpón y sección, si el dato está pendiente, en borrador, guardado o con error de sincronización.
6. **F06 · P0** — Guardar una captura debe ser idempotente: repetir el toque o reintentar la red no debe crear registros duplicados.
7. **F07 · P0** — Ante una edición concurrente, mostrar valores local y remoto y permitir recargar o comparar antes de decidir; nunca sobrescribir silenciosamente.
8. **F08 · P1** — Si se pierde conexión, conservar los cambios en una cola local, etiquetarlos como pendientes y ofrecer reintentar o descartar sin aparentar que quedaron compartidos.
9. **F09 · P1** — La captura debe validar en pantalla campos faltantes, rangos improbables y unidades antes de enviar, con un resumen de lo que sí se guardará.
10. **F10 · P1** — Los requisitos diarios deben depender de etapa, edad y condición del lote; levante, muda y tratamiento no deben generar exigencias productivas que no aplican.

### Lotes, producción y bienestar

11. **F11 · P1** — Crear o editar un lote debe conservar el desplazamiento hasta el formulario y ofrecer un acceso claro a cancelar y guardar. *(El desplazamiento automático se acaba de implementar.)*
12. **F12 · P1** — El ciclo del lote debe incluir alta, cambio de galpón, cambio de etapa, cierre y consulta histórica sin alterar registros anteriores.
13. **F13 · P1** — Las excepciones de postura, mortalidad, alimento y agua deben distinguir dato ausente, fuera de etapa y valor realmente anómalo.
14. **F14 · P1** — Los KPIs de postura deben explicar qué lotes se incluyeron, cuáles se excluyeron y por qué, usando la etapa histórica de la fecha consultada.
15. **F15 · P2** — Las referencias genéticas deben identificarse por línea, semana y fuente; si no existe referencia para una edad, el sistema debe decirlo sin extrapolarla.
16. **F16 · P1** — Pesajes deben mostrar evolución por lote frente a referencia, con detección de valores atípicos y opción de corregir conservando auditoría.
17. **F17 · P1** — Medicaciones deben asociarse a lote, producto, dosis, período y retiro; el control diario debe advertir sobre huevos bajo período de retiro.
18. **F18 · P1** — Vacunas y tratamientos deben contar con calendario, responsable, aplicación real y alertas de vencimiento configurables.
19. **F19 · P1** — Agua y alimento deben contrastarse con raciones y metas por lote, pero una desviación debe ser alerta informativa revisable, no un bloqueo automático.
20. **F20 · P2** — Actividades de bienestar y rutinas deben admitir programación recurrente, responsable, evidencia de realización y excepción justificada por lote.

### Planta, materia prima y bodega

21. **F21 · P0** — Cada bache debe guardar la versión de fórmula y núcleo aplicada ese día; cambiar la receta vigente no debe reescribir el pasado.
22. **F22 · P1** — Antes de guardar un bache, mostrar ingredientes, núcleo, kilos esperados y diferencias entre receta y producción real.
23. **F23 · P1** — El historial de planta debe permitir corregir los campos operativos pertinentes y recalcular sus efectos, conservando antes/después y motivo.
24. **F24 · P0** — Los inventarios de planta propia y alimento comprado deben quedar separados en movimientos, consumos, saldos y reportes.
25. **F25 · P1** — El inventario comprado debe poder cerrarse/archivarse sin borrar sus compras o consumos históricos, y permitir reabrirlo con permiso administrativo.
26. **F26 · P0** — Cada entrada de materia prima debe convertir sacos, presentación y unidades a kilos con conversión visible antes de confirmar.
27. **F27 · P1** — El conteo físico de materia prima debe aceptar una tabla completa o pegado desde Excel, validar códigos y mostrar diferencias antes de aplicar ajustes.
28. **F28 · P0** — El kardex consultado a una fecha debe presentar saldo inicial, entradas, consumos, ajustes y saldo final en una sola unidad coherente.
29. **F29 · P0** — Las correcciones históricas de movimientos deben recalcular saldos posteriores con fecha efectiva y sin duplicar movimientos derivados.
30. **F30 · P1** — Las entradas y ajustes deben advertir cantidades o fechas futuras, presentación incompatible, inventario negativo y posible duplicado, explicando cómo corregirlo.
31. **F31 · P0** — Bodega debe presentar por separado devolución buena y mala, señal, efecto proyectado y saldo resultante con el mismo criterio en captura, historial e impresión.
32. **F32 · P1** — La conciliación física de bodega debe mostrar diferencia, responsable y motivo, y permitir consultar el valor teórico anterior.
33. **F33 · P1** — Al importar producción o inventario, mostrar previsualización, conflictos, duplicados y un resumen de cambios antes de modificar datos.
34. **F34 · P1** — El cierre de día debe indicar qué se verificó, qué falta, quién cerró y si el cierre ya fue corregido después.

### Alertas, permisos y reportes

35. **F35 · P0** — Las alertas deben abrir directamente el registro, fecha y módulo que las originó, o explicar por qué el usuario no tiene acceso.
36. **F36 · P1** — Descartar, modificar y reactivar una alerta debe conservar motivo, responsable y evento histórico, sin duplicar entradas al refrescar.
37. **F37 · P0** — Alertas de facturas y otros datos sensibles deben respetar el mismo permiso en la vista, búsqueda, reportes, historial y exportación.
38. **F38 · P1** — Reporte debe tener secciones seleccionables; cada sección debe imprimir solo su contenido y “Ver todo” debe conservar el reporte gerencial integral.
39. **F39 · P0** — El control diario de operaciones debe usar la fecha elegida, mantener el formato de tres páginas y no insertar páginas vacías en móvil ni escritorio.
40. **F40 · P1** — Los enlaces compartidos deben conservar módulo, filtros, fecha y registro elegido, y comprobar permisos antes de mostrar datos.

## Requisitos no funcionales (20)

1. **N01 · P0** — La base debe imponer unicidad para claves operativas críticas (fecha/lote, número de tiquete u otras reglas definidas), no depender solo de la interfaz.
2. **N02 · P0** — Operaciones que afectan varias tablas deben ejecutarse en una transacción SQL/RPC con reversión completa ante cualquier fallo.
3. **N03 · P0** — Toda edición compartida debe usar revisión/versión remota o comparación atómica para detectar cambios concurrentes.
4. **N04 · P0** — Todas las escrituras con reintento deben usar claves idempotentes y resultados verificables.
5. **N05 · P0** — Las políticas RLS deben cubrir lectura, alta, edición y borrado por rol, con pruebas negativas para cada rol y tabla sensible.
6. **N06 · P0** — Los permisos de UI son solo presentación; el servidor debe volver a validar cada acción protegida.
7. **N07 · P1** — Las consultas deben solicitar solo campos necesarios y limitar exposición de datos personales y financieros.
8. **N08 · P0** — Una falla de red, permiso o esquema debe diferenciarse de una colección realmente vacía; nunca se debe mostrar “cero” como si fuera un saldo confirmado.
9. **N09 · P1** — Cada módulo debe mostrar último guardado, estado de sincronización, origen local/remoto y hora del último refresco.
10. **N10 · P1** — La cola sin conexión debe sobrevivir recarga y cierre del navegador, con reintentos controlados y resolución de conflicto sin pérdida.
11. **N11 · P1** — En teléfonos de campo, textos y datos deben conservar contraste legible al sol, con controles táctiles de tamaño adecuado.
12. **N12 · P1** — Formularios, diálogos y navegación deben poder usarse con teclado y lector de pantalla; foco y errores deben ser anunciados correctamente.
13. **N13 · P1** — La impresión debe probarse en Android, iOS, Chrome y escritorio con saltos de página, escala, orientación y nombre del archivo verificables.
14. **N14 · P1** — La aplicación debe dividirse por vistas y cargar bajo demanda; fijar un presupuesto para el paquete inicial y revisar cualquier aumento.
15. **N15 · P1** — Historiales extensos deben paginarse o cargarse progresivamente sin bloquear la captura ni descargar todo el almacén de una vez.
16. **N16 · P0** — La cobertura debe combinar pruebas unitarias, componentes, integración contra Supabase de prueba y recorridos móviles críticos.
17. **N17 · P1** — CI debe ejecutar formato, pruebas, compilación y verificación de migraciones antes de publicar; el despliegue debe poder rastrearse a un commit.
18. **N18 · P1** — Deben existir exportación y restauración probadas, con vista previa, control de duplicados, registro de resultado y plan de recuperación.
19. **N19 · P1** — Migraciones y versión de esquema deben ser repetibles, idempotentes y visibles; la documentación debe corresponder al estado vigente, no a una versión antigua.
20. **N20 · P1** — Fechas de operación deben respetar el calendario local de Guatemala y las marcas de auditoría UTC, con pruebas de cambio de día y horario.

## Orden sugerido para el siguiente sprint

1. N01–N05: unicidad, transacciones, concurrencia e integración de permisos en base.
2. F05–F09 y N08–N10: captura, borradores y sincronización honesta bajo cortes de red.
3. F28–F31: saldos de materia prima, Planta y bodega consistentes de punta a punta.
4. F35–F39: alertas enlazadas y reportes/impresión por fecha y sección.
5. N11–N16: pruebas de campo, accesibilidad, rendimiento y cobertura de flujos completos.

El alcance real de cada requisito debe estimarse y aprobarse antes de programarlo; el backlog es amplio a propósito y no implica ejecutar los 60 en una sola entrega.
