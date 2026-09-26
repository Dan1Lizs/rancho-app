// Las primeras consultas pueden coincidir con la restauración de la sesión o
// una conexión fría. Solo se muestra error después de varios intentos.
export async function cargarBaseConReintentos(leerBase, { intentos = 3, timeoutMs = 20000, pausas = [600, 1500] } = {}) {
  let ultimoError;
  for (let n = 0; n < intentos; n++) {
    let temporizador;
    try {
      const datos = await Promise.race([
        leerBase(),
        new Promise((_, rechazar) => { temporizador = setTimeout(() => rechazar(new Error("Tiempo de espera agotado")), timeoutMs); }),
      ]);
      if (Array.isArray(datos) && datos.every(x => x !== null && x !== undefined)) return datos;
      ultimoError = new Error("La base todavía no respondió a todas las consultas");
    } catch (error) { ultimoError = error; }
    finally { clearTimeout(temporizador); }
    if (n < intentos - 1) await new Promise(resolver => setTimeout(resolver, pausas[n] || 1500));
  }
  throw ultimoError;
}
