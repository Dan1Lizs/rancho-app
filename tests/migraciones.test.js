import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/migrations");

test("las migraciones tienen nombres válidos y versiones únicas en orden cronológico", async () => {
  const archivos = (await readdir(raiz)).filter(nombre => nombre.endsWith(".sql")).sort();
  assert.ok(archivos.length > 0, "debe existir un historial local de migraciones");
  const versiones = archivos.map(nombre => {
    assert.match(nombre, /^\d{14}_[a-z0-9_]+\.sql$/, `nombre inválido: ${nombre}`);
    return nombre.slice(0, 14);
  });
  assert.equal(new Set(versiones).size, versiones.length, "no se permiten timestamps de migración duplicados");
  assert.deepEqual(versiones, [...versiones].sort(), "el orden del historial debe ser cronológico");
});

test("el historial local conserva las migraciones críticas de unicidad y seguridad", async () => {
  const archivos = await readdir(raiz);
  const nombreUnicidad = archivos.find(nombre => nombre.includes("operational_record_uniqueness"));
  const nombreKv = archivos.find(nombre => nombre.includes("restrict_legacy_kv_to_admin"));
  assert.ok(nombreUnicidad, "falta la migración de unicidad operativa");
  assert.ok(nombreKv, "falta la migración de permisos del almacén legado");
  const [unicidad, kv] = await Promise.all([
    readFile(path.join(raiz, nombreUnicidad), "utf8"),
    readFile(path.join(raiz, nombreKv), "utf8"),
  ]);
  assert.match(unicidad, /create unique index if not exists registros_lote_fecha_unica_idx/i);
  assert.match(unicidad, /create unique index if not exists pesajes_lote_fecha_unica_idx/i);
  assert.match(kv, /create policy kv_admin_select/i);
  assert.doesNotMatch(kv, /create policy .* for select to authenticated\s+using\s*\(\s*true\s*\)/i);
});
