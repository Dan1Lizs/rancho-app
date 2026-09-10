# 🐔 Rancho El Soñado — Actualización a base de datos v6

Esto arregla de raíz los problemas de "se pierden datos", "multiusuario" y
"errores al guardar". Tiempo estimado: 15–20 minutos. No se pierde nada de
lo que ya tienes — la migración COPIA tus datos, no los borra ni los mueve.

**Hazlo en un momento tranquilo** (ej. de noche) y, si puedes, pide que
nadie use la app durante estos 20 minutos.

---

## PASO 1 — Crear las tablas nuevas · ~5 min

1. Entra a **supabase.com** → tu proyecto → menú **SQL Editor** → **New query**
2. Pega TODO el contenido del archivo `supabase_v2.sql` → botón **Run**
3. Debe decir "Success". Esto crea las tablas nuevas SIN tocar ni borrar
   la tabla vieja `kv` — tus datos actuales siguen intactos ahí.

---

## PASO 2 — Subir el código nuevo (GitHub) · ~5 min

1. Entra a tu repositorio `rancho-app` en GitHub
2. Sube (reemplazando los anteriores) estos archivos:
   - `src/App.jsx`
   - `src/storage.js`
   - `src/migracion.js` ← archivo nuevo
   - `package.json`
3. **Commit changes** → Vercel republicará solo en ~1 minuto

---

## PASO 3 — Migrar los datos · ~2 min

1. Abre la app ya actualizada, entra con tu usuario
2. Ve a **Historial** → busca el recuadro amarillo **"🔧 Migración a base
   de datos v6"**
3. Toca **"🔧 Migrar datos a la base de datos v6"** → toca otra vez para
   confirmar
4. Espera el mensaje final: te dirá qué se copió. Si todo salió bien, la
   app se recarga sola
5. Revisa que tus lotes, historial, bodega y saldos se vean igual que
   antes ✅

**¿Y si algo sale mal a mitad de camino?** No pasa nada — puedes tocar el
botón de migrar de nuevo las veces que quieras. Ya no vuelve a copiar lo
que ya copió, solo intenta lo que falte.

---

## ¿Qué cambió por dentro?

- Antes: **todo** vivía en una sola tabla (`kv`) como un bloque de texto
  gigante. Guardar UN dato reescribía TODO el historial completo.
- Ahora: cada lote, cada registro diario, cada pesaje, cada factura... es
  su propia fila en su propia tabla. Guardar un dato ya no toca los demás.
- **Multiusuario de verdad:** si dos personas guardan cosas distintas casi
  al mismo tiempo, ya no se pisan — cada quien guarda lo suyo.
- **Actualización en vivo:** si alguien más guarda algo, tu pantalla se
  refresca sola en unos segundos, sin que tengas que tocar el botón ⟳.
- **Historial de cambios:** ahora queda registrado quién cambió qué y
  cuándo, en una tabla de auditoría — por si algo alguna vez se ve raro,
  se puede revisar exactamente qué pasó.
- La tabla vieja `kv` queda intacta como respaldo. El día que quieras
  (sin prisa, meses después si gustas) se puede borrar desde Supabase.

## Preguntas frecuentes

**¿Perdí algo?** No — la migración solo COPIA. Si algo no coincide, la
tabla `kv` sigue teniendo el original.

**¿Puedo migrar dos veces por error?** Sí, es seguro. El botón se salta
las tablas que ya tengan datos.

**¿Sigue funcionando "Exportar TODOS los datos"?** Sí, exactamente igual
que antes.

**¿Se cayó algo / error al entrar?** → escríbele a Claude con una captura 😉
