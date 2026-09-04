# 🐔 Rancho El Soñado — Guía de publicación en app.ranchosonado.cr

Todo se hace desde el navegador, sin programar. Tiempo estimado: 60–90 minutos.
Costo: $0 (planes gratuitos).

---

## PARTE 1 — Base de datos (Supabase) · ~20 min

1. Entra a **supabase.com** → "Start your project" → crea cuenta con tu correo
2. **New project** → Nombre: `rancho-el-sonado` → Region: la más cercana (East US) →
   inventa una contraseña de base de datos y **guárdala** → Create
3. Cuando termine de crear (2 min), ve al menú **SQL Editor** → New query →
   pega TODO el contenido del archivo `supabase.sql` → botón **Run** → debe decir "Success"
4. Menú **Authentication → Users → Add user → Create new user**:
   - Crea un usuario por cada persona (tú, Roxana, el encargado)
   - Email + contraseña (invéntala tú y compártela con cada uno)
   - ✅ Marca "Auto Confirm User"
5. Menú **Project Settings (engranaje) → API** y copia dos valores:
   - **Project URL** (ej. https://abcd1234.supabase.co)
   - **anon public** key (un texto largo que empieza con eyJ...)

---

## PARTE 2 — Subir el código (GitHub) · ~15 min

1. Entra a **github.com** → crea cuenta si no tienes
2. Botón **+ → New repository** → Nombre: `rancho-app` → **Private** → Create
3. En el repositorio: **uploading an existing file** → arrastra TODOS los archivos
   y carpetas de este paquete (package.json, index.html, vite.config.js,
   supabase.sql, la carpeta src completa...) → **Commit changes**
   - ⚠ NO subas ningún archivo .env con claves reales

---

## PARTE 3 — Publicar (Vercel) · ~15 min

1. Entra a **vercel.com** → Sign up → **Continue with GitHub** (conecta tu cuenta)
2. **Add New → Project** → Import el repositorio `rancho-app`
3. Antes de Deploy, abre **Environment Variables** y agrega las 2 variables:
   - `VITE_SUPABASE_URL` → pega el Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → pega la anon key
4. **Deploy** → en ~1 minuto tendrás la app en una dirección tipo
   `rancho-app.vercel.app` → ábrela y prueba iniciar sesión ✅

---

## PARTE 4 — Tu dominio app.ranchosonado.cr · ~10 min + espera

1. En Vercel: tu proyecto → **Settings → Domains** → escribe `app.ranchosonado.cr` → Add
2. Vercel te mostrará un registro **CNAME** (algo como `cname.vercel-dns.com`)
3. Entra al panel donde administras **ranchosonado.cr** → zona DNS → agrega:
   - Tipo: `CNAME` · Nombre/Host: `app` · Valor: `cname.vercel-dns.com`
4. Espera 10 min – 2 horas (propagación) → Vercel activará el candadito 🔒 solo
5. ¡Listo! La app vive en **https://app.ranchosonado.cr**

---

## PARTE 5 — Migrar los datos de la prueba · ~5 min

1. En la app VIEJA (artifact): Historial → **💾 Exportar TODOS los datos** → guarda el JSON
2. En la app NUEVA (app.ranchosonado.cr): inicia sesión → Historial →
   **📥 Importar respaldo JSON** → elige el archivo → (te pedirá confirmar: vuelve a elegirlo)
3. Verifica: lotes, saldos de bodega y planta, fórmulas, historial ✅
4. Una semana en paralelo con el papel → y después, adiós papel 🎉

---

## Preguntas frecuentes

**¿Cómo agrego o quito usuarios después?** → Supabase → Authentication → Users
**¿Cómo actualizo la app cuando Claude haga cambios?** → sube el App.jsx nuevo al
repositorio de GitHub (Add file → Upload) reemplazando el anterior → Vercel
republica solo en 1 minuto
**¿Respaldos?** → Supabase gratuito guarda tus datos con redundancia; además sigue
usando el botón 💾 Exportar semanalmente. Al pasar a Supabase Pro ($25/mes, opcional)
tendrás respaldos automáticos diarios
**¿Se cayó algo / error al entrar?** → escríbele a Claude con una captura 😉
