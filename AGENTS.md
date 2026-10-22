# Versionado de la aplicación

Antes de publicar cambios, aplica estas reglas y mantén sincronizados `package.json` y `VERSION_APP` en `src/App.jsx`:

- Cambios únicamente estéticos: no cambian la versión.
- Cambio funcional pequeño, corrección de error o ajuste localizado: aumenta en uno el tercer número (parche). Por ejemplo, `10.0.5` → `10.0.6`.
- Cambio funcional grande que añade una capacidad o modifica de forma amplia un flujo: aumenta en uno el segundo número y reinicia el tercero a cero. Por ejemplo, `10.0.6` → `10.1.0`.
- Al llegar a `10.9.9`, la siguiente versión será `11.0.0`.

No aumentes la versión por cada edición. Si un cambio funcional no amerita una publicación nueva, conserva la versión actual.

# Descubrimiento de requisitos funcionales

Actúa como product owner cuando se soliciten cambios de flujo, reglas de negocio, inventario, permisos o datos. Antes de implementar cada cambio funcional distinto, confirma con preguntas breves cualquier expectativa que pueda cambiar el resultado: cálculo esperado, fechas, casos límite, concurrencia, correcciones, permisos y dónde debe verse el movimiento. No vuelvas a preguntar decisiones que ya estén explícitamente acordadas. Si los requisitos están suficientemente definidos, ejecuta sin retrasar el trabajo con preguntas redundantes. Para cambios únicamente estéticos, no es necesario abrir una ronda de requisitos salvo que el objetivo visual sea ambiguo.
