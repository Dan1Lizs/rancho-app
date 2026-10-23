import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buscarTiqueteDevuelto,
  cartonesUsadosTiquete,
  esCantidadMediaCarton,
  formatoCartones,
  fechaISODeTiquete,
  idRepartoBodega,
  rutasBodegaParaTiquetes,
  numeroCartones,
  rutaMismoDiaPorRepartidor,
} from "./tiquetesDevolucion.js";
import { historialDevolucionesSinTiquete } from "../../historial.js";

const fechaCorta = (fecha) => String(fecha || "").slice(0, 10).split("-").reverse().join("/");
const claveRuta = (ruta) => `${ruta.movimientoId}::${ruta.rutaId}`;
const cartonesDe = (movimiento) => Number(movimiento.cartones_delta ?? movimiento.cartonesDelta ?? 0);

function mensajeError(error) {
  const mensaje = String(error?.message || "");
  if (/duplicate key|unique constraint|ya está registrado/i.test(mensaje)) return "Ese número ya existe como tiquete de devolución. Revisa el número antes de guardarlo.";
  if (/saldo insuficiente/i.test(mensaje)) return mensaje;
  if (/no existe un tiquete/i.test(mensaje)) return "No encontramos ese número entre los tiquetes devueltos. Comprueba el número o registra primero la devolución.";
  if (/fecha.*anterior|todavía no estaba disponible/i.test(mensaje)) return mensaje;
  if (/motivo/i.test(mensaje)) return mensaje;
  if (/permiso/i.test(mensaje)) return "Tu usuario no tiene permiso para registrar o corregir estos movimientos.";
  return mensaje || "No se pudo guardar el movimiento. Actualiza y vuelve a intentarlo.";
}

export function TiquetesDevolucionBodega({
  colores,
  estilos,
  fecha,
  tiquetes = [],
  movimientos = [],
  movimientosBodega = [],
  devolucionesSinTiquete = [],
  rutasOrigen = [],
  rutasDetalle = [],
  permitirEscritura = false,
  errorCarga = "",
  ocupado = false,
  onRegistrar,
  onRegistrarSinTiquete,
  onQuitarSinTiquete,
  onEditarSinTiquete,
  onCorregir,
}) {
  const fechaAnteriorRef = useRef(fecha);
  const [rutaOrigenKey, setRutaOrigenKey] = useState("");
  const [repartidorDevolucion, setRepartidorDevolucion] = useState("");
  const [sinTiquete, setSinTiquete] = useState(false);
  const [numeroDevolucion, setNumeroDevolucion] = useState("");
  const [cartonesDevolucion, setCartonesDevolucion] = useState("");
  const [cartonesMalosDevolucion, setCartonesMalosDevolucion] = useState("");
  const [edicionId, setEdicionId] = useState("");
  const [edicionNumero, setEdicionNumero] = useState("");
  const [edicionCartones, setEdicionCartones] = useState("");
  const [edicionCartonesMalos, setEdicionCartonesMalos] = useState("");
  const [edicionMotivo, setEdicionMotivo] = useState("");
  const [edicionSinTiquete, setEdicionSinTiquete] = useState(null);
  const [edicionSinTiqueteBuenos, setEdicionSinTiqueteBuenos] = useState("");
  const [edicionSinTiqueteMalos, setEdicionSinTiqueteMalos] = useState("");
  const [edicionSinTiqueteRuta, setEdicionSinTiqueteRuta] = useState("");
  const [edicionSinTiqueteMotivo, setEdicionSinTiqueteMotivo] = useState("");
  const [busquedaRutaEdicion, setBusquedaRutaEdicion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const origenesPorClave = useMemo(() => new Map(rutasOrigen.map(ruta => [claveRuta(ruta), ruta])), [rutasOrigen]);
  const recibidosHoy = tiquetes.filter(t => String(t.fecha_recepcion).slice(0, 10) === fecha);
  const movimientosAplicadosHoy = movimientos.filter(m => String(m.fecha).slice(0, 10) === fecha);
  const movimientosHoy = movimientos.filter(m => String(m.fecha).slice(0, 10) === fecha || String(m.fecha_recepcion || "").slice(0, 10) === fecha);
  const netoHoy = movimientosAplicadosHoy.reduce((total, movimiento) => total + cartonesDe(movimiento), 0);
  const tiquetesPorId = useMemo(() => new Map(tiquetes.map(t => [String(t.id), t])), [tiquetes]);
  const detalleRutas = rutasDetalle.map(ruta => ({
    ruta,
    devoluciones: tiquetes.filter(t => String(t.ruta_mov_id) === String(ruta.movimientoId) && String(t.ruta_id) === String(ruta.rutaId)),
    devolucionesMalas: movimientos.filter(m => m.tipo === "devolucion_mala" && String(m.ruta_mov_id) === String(ruta.movimientoId) && String(m.ruta_id) === String(ruta.rutaId)),
    usos: movimientos.filter(m => m.tipo === "uso" && String(m.ruta_mov_id) === String(ruta.movimientoId) && String(m.ruta_id) === String(ruta.rutaId)),
  })).filter(item => item.devoluciones.length || item.devolucionesMalas.length || item.usos.length);
  const historialSinTiquete = useMemo(() => historialDevolucionesSinTiquete(movimientosBodega), [movimientosBodega]);
  const rutasHistorial = useMemo(() => {
    const porClave = new Map(rutasBodegaParaTiquetes(movimientosBodega)
      .map(ruta => [`${ruta.movimientoId}::${ruta.rutaId}`, ruta]));
    movimientosBodega.forEach(movimiento => (movimiento.repartos || []).forEach((reparto, indice) => {
      const fechaRuta = fechaISODeTiquete(movimiento.fecha);
      if (!fechaRuta) return;
      const rutaId = idRepartoBodega(movimiento.id, reparto, indice);
      const clave = `${movimiento.id}::${rutaId}`;
      if (!porClave.has(clave)) porClave.set(clave, {
        movimientoId: String(movimiento.id), rutaId, fecha: fechaRuta,
        repartidor: String(reparto.nombre || "Repartidor"), salida: Number(reparto.salida || 0),
      });
    }));
    return [...porClave.values()];
  }, [movimientosBodega]);
  const rutasEdicionVisibles = useMemo(() => {
    if (!edicionSinTiquete) return [];
    const corte = fechaISODeTiquete(edicionSinTiquete.fecha);
    const consulta = busquedaRutaEdicion.trim().toLocaleLowerCase("es");
    return rutasHistorial
      .filter(ruta => fechaISODeTiquete(ruta.fecha) && fechaISODeTiquete(ruta.fecha) <= corte)
      .filter(ruta => !consulta || `${ruta.repartidor} ${fechaCorta(ruta.fecha)}`.toLocaleLowerCase("es").includes(consulta))
      .sort((a, b) => fechaISODeTiquete(b.fecha).localeCompare(fechaISODeTiquete(a.fecha))
        || String(a.repartidor).localeCompare(String(b.repartidor), "es"));
  }, [rutasHistorial, edicionSinTiquete, busquedaRutaEdicion]);
  const rutasEdicionPorClave = useMemo(() => new Map(rutasHistorial.map(ruta => [`${ruta.movimientoId}::${ruta.rutaId}`, ruta])), [rutasHistorial]);

  useEffect(() => {
    if (fechaAnteriorRef.current !== fecha) {
      fechaAnteriorRef.current = fecha;
      setRutaOrigenKey("");
      setRepartidorDevolucion("");
    }
  }, [fecha]);

  useEffect(() => {
    if (rutaOrigenKey && !origenesPorClave.has(rutaOrigenKey)) {
      setRutaOrigenKey("");
      setRepartidorDevolucion("");
    }
  }, [origenesPorClave, rutaOrigenKey]);

  useEffect(() => {
    if (rutaOrigenKey) return;
    const rutasDelDia = rutasOrigen.filter(ruta => String(ruta.fecha).slice(0, 10) === fecha);
    if (rutasDelDia.length === 1 && (!repartidorDevolucion
      || String(rutasDelDia[0].repartidor || "").trim().toLocaleLowerCase("es") === repartidorDevolucion.trim().toLocaleLowerCase("es"))) {
      setRutaOrigenKey(claveRuta(rutasDelDia[0]));
      setRepartidorDevolucion(rutasDelDia[0].repartidor || "");
    }
  }, [rutasOrigen, fecha, rutaOrigenKey, repartidorDevolucion]);

  const mostrarOpcionRuta = (ruta) => `${fechaCorta(ruta.fecha)} · ${ruta.repartidor}${ruta.salida > 0 ? ` · ${formatoCartones(ruta.salida, "0")} cart` : ""}`;
  const ejecutar = async (accion, exito) => {
    setMensaje("");
    setGuardando(true);
    try {
      await accion();
      setMensaje(exito);
      return true;
    } catch (error) {
      console.error("Tiquetes devueltos:", error);
      setMensaje(mensajeError(error));
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const guardarDevolucion = async (evento) => {
    evento.preventDefault();
    const ruta = origenesPorClave.get(rutaOrigenKey);
    if (!ruta) { setMensaje("Selecciona la ruta de origen de esta devolución."); return; }
    if (!sinTiquete && !numeroDevolucion.trim()) { setMensaje("Escribe el número físico del tiquete o marca que esta devolución no tiene tiquete."); return; }
    if (!sinTiquete && buscarTiqueteDevuelto(tiquetes, numeroDevolucion)) { setMensaje("Ese número ya está registrado como tiquete de devolución."); return; }
    const cantidad = numeroCartones(cartonesDevolucion || 0);
    const cantidadMala = numeroCartones(cartonesMalosDevolucion || 0);
    if (!Number.isFinite(cantidad) || cantidad < 0 || !Number.isFinite(cantidadMala) || cantidadMala < 0
      || cantidad + cantidadMala <= 0 || !esCantidadMediaCarton(cantidad) || !esCantidadMediaCarton(cantidadMala)) {
      setMensaje("Indica cartones buenos o malos con cantidades enteras o terminadas en .5."); return;
    }
    const guardado = sinTiquete
      ? await ejecutar(() => onRegistrarSinTiquete({ cartonesBuenos: cantidad, cartonesMalos: cantidadMala, ruta }), "Devolución sin tiquete añadida a Bodega. Guarda el movimiento del día para confirmarla.")
      : await ejecutar(() => onRegistrar({
        numero: numeroDevolucion.trim(),
        cartones: cantidad,
        cartonesMalos: cantidadMala,
        ruta,
      }), "Devolución registrada: los buenos entran hoy; los malos quedan anotados y no cambian el inventario.");
    if (guardado) {
      setNumeroDevolucion("");
      setCartonesDevolucion("");
      setCartonesMalosDevolucion("");
      if (!sinTiquete) setNumeroDevolucion("");
    }
  };

  const comenzarEdicion = (tiquete) => {
    setEdicionId(String(tiquete.id));
    setEdicionNumero(tiquete.numero);
    setEdicionCartones(String(tiquete.cartones_iniciales));
    setEdicionCartonesMalos(String(tiquete.cartones_malos || 0));
    setEdicionMotivo("");
    setMensaje("");
  };

  const guardarCorreccion = async (evento, tiquete) => {
    evento.preventDefault();
    const usados = cartonesUsadosTiquete(tiquete, movimientos);
    if (usados > 0 && !edicionMotivo.trim()) { setMensaje("Escribe el motivo de la corrección; el tiquete ya se usó en una ruta."); return; }
    const cantidad = numeroCartones(edicionCartones || 0);
    const cantidadMala = numeroCartones(edicionCartonesMalos || 0);
    if (!Number.isFinite(cantidad) || cantidad < 0 || !Number.isFinite(cantidadMala) || cantidadMala < 0
      || cantidad + cantidadMala <= 0 || !esCantidadMediaCarton(cantidad) || !esCantidadMediaCarton(cantidadMala)) {
      setMensaje("Las cantidades buenas y malas deben ser enteras o terminar en .5, y el total debe ser mayor que cero."); return;
    }
    const guardado = await ejecutar(() => onCorregir({
      tiquete,
      numero: edicionNumero.trim(),
      cartones: cantidad,
      cartonesMalos: cantidadMala,
      motivo: edicionMotivo.trim(),
    }), "Tiquete corregido y movimiento guardado en el historial.");
    if (guardado) setEdicionId("");
  };

  const comenzarEdicionSinTiquete = devolucion => {
    setEdicionSinTiquete(devolucion);
    setEdicionSinTiqueteBuenos(String(devolucion.buenos));
    setEdicionSinTiqueteMalos(String(devolucion.malos));
    setEdicionSinTiqueteRuta(`${devolucion.rutaMovId}::${devolucion.rutaId}`);
    setEdicionSinTiqueteMotivo("");
    setBusquedaRutaEdicion("");
    setMensaje("");
  };

  const guardarEdicionSinTiquete = async evento => {
    evento.preventDefault();
    const ruta = rutasEdicionPorClave.get(edicionSinTiqueteRuta);
    if (!ruta) { setMensaje("Selecciona una ruta de origen válida."); return; }
    const buenos = numeroCartones(edicionSinTiqueteBuenos || 0);
    const malos = numeroCartones(edicionSinTiqueteMalos || 0);
    if (!Number.isFinite(buenos) || buenos < 0 || !Number.isFinite(malos) || malos < 0
      || buenos + malos <= 0 || !esCantidadMediaCarton(buenos) || !esCantidadMediaCarton(malos)) {
      setMensaje("Los cartones buenos y malos deben ser enteros o terminar en .5, y el total debe ser mayor que cero."); return;
    }
    if (!edicionSinTiqueteMotivo.trim()) { setMensaje("Escribe el motivo de la corrección para conservar la auditoría."); return; }
    const guardado = await ejecutar(() => onEditarSinTiquete({
      registro: edicionSinTiquete,
      ruta,
      cartonesBuenos: buenos,
      cartonesMalos: malos,
      motivo: edicionSinTiqueteMotivo.trim(),
    }), "Devolución corregida; los saldos de Bodega y la ruta quedaron recalculados.");
    if (guardado) setEdicionSinTiquete(null);
  };

  const estiloInput = { ...estilos.input, minWidth: 0 };
  const estiloBoton = { ...estilos.boton, width: "auto", margin: 0, padding: "10px 14px", fontSize: 13 };

  return (
    <section style={{ marginTop: 16, padding: 14, border: `1px solid ${colores.borde}`, borderRadius: 12, background: colores.superficie }} aria-labelledby="titulo-tiquetes-devueltos">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h4 id="titulo-tiquetes-devueltos" style={{ margin: 0, fontSize: 15 }}>Devoluciones e inventario reutilizable</h4>
          <div style={{ marginTop: 4, fontSize: 12, color: colores.textoSuave }}>Las devoluciones con tiquete conservan su saldo reutilizable; las devoluciones sin tiquete pueden corregirse desde el historial con motivo y recalculan Bodega y la ruta asignada.</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: netoHoy >= 0 ? colores.verde : colores.alerta }}>
          Movimiento neto hoy: {netoHoy > 0 ? "+" : ""}{formatoCartones(netoHoy, "0")} cart
        </div>
      </div>

      <div style={{ padding: 9, margin: "12px 0", borderRadius: 8, background: colores.verdeSuave, color: colores.texto, fontSize: 12 }}>Los cartones buenos pasan al inventario y se agregan a la ruta desde el campo normal de tiquetes que se lleva.</div>

      {errorCarga && <div role="alert" style={{ padding: 10, marginBottom: 10, borderRadius: 8, background: colores.alertaSuave, color: colores.alerta, fontSize: 12.5 }}>No se pudo cargar el kardex de tiquetes devueltos. Actualiza los datos antes de registrar un movimiento. {errorCarga}</div>}

      {!permitirEscritura && <div style={{ padding: 9, marginBottom: 10, borderRadius: 8, background: colores.fondo, color: colores.textoSuave, fontSize: 12 }}>Tu perfil puede consultar los saldos, pero no registrar ni corregir devoluciones.</div>}

      <form onSubmit={guardarDevolucion} style={{ display: "grid", gap: 9 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Repartidor que trae la devolución
          <select value={repartidorDevolucion} onChange={evento => {
            const nombre = evento.target.value;
            setRepartidorDevolucion(nombre);
            const coincidencia = rutaMismoDiaPorRepartidor(rutasOrigen, fecha, nombre);
            setRutaOrigenKey(coincidencia ? claveRuta(coincidencia) : "");
          }} style={estiloInput}>
            <option value="">Seleccionar repartidor…</option>
            {[...new Set(rutasOrigen.map(ruta => ruta.repartidor).filter(Boolean))].map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
          </select>
          <span style={{ display: "block", marginTop: 3, color: colores.textoSuave, fontSize: 11 }}>Si coincide con una única ruta de la fecha elegida, la vinculación se hará automáticamente.</span>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Ruta de origen de la devolución
          <select required value={rutaOrigenKey} onChange={evento => {
            const clave = evento.target.value;
            setRutaOrigenKey(clave);
            setRepartidorDevolucion(origenesPorClave.get(clave)?.repartidor || "");
          }} style={estiloInput}>
            <option value="">Seleccionar entre las últimas rutas…</option>
            {rutasOrigen.map(ruta => <option key={claveRuta(ruta)} value={claveRuta(ruta)}>{mostrarOpcionRuta(ruta)}</option>)}
          </select>
          <span style={{ display: "block", marginTop: 3, color: colores.textoSuave, fontSize: 11 }}>Se muestran hasta cuatro rutas elegibles hasta la fecha seleccionada en Bodega. Si hay más de una ruta del mismo repartidor ese día, elige la correcta aquí.</span>
        </label>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {!sinTiquete && <label style={{ flex: "1 1 150px", fontSize: 12, fontWeight: 600 }}>Número del tiquete físico de devolución
            <input required value={numeroDevolucion} onChange={evento => setNumeroDevolucion(evento.target.value)} placeholder="Ej. DEV-1042" style={estiloInput} />
          </label>}
          <label style={{ flex: "1 1 130px", fontSize: 12, fontWeight: 600 }}>Cartones buenos reutilizables
            <input required type="text" inputMode="decimal" value={cartonesDevolucion} onChange={evento => setCartonesDevolucion(evento.target.value)} placeholder="0" style={estiloInput} />
          </label>
          <label style={{ flex: "1 1 130px", fontSize: 12, fontWeight: 600 }}>Cartones malos (solo informativo)
            <input type="text" inputMode="decimal" value={cartonesMalosDevolucion} onChange={evento => setCartonesMalosDevolucion(evento.target.value)} placeholder="0" style={estiloInput} />
          </label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
          <input type="checkbox" checked={sinTiquete} onChange={evento => setSinTiquete(evento.target.checked)} />
          Esta devolución no tiene tiquete físico
        </label>
        {sinTiquete && <div role="alert" style={{ padding: 9, border: "1px solid #E58A16", borderRadius: 8, background: "#FFF1D6", color: "#8A4B08", fontSize: 12, fontWeight: 700 }}>
          ⚠ Sin tiquete: los cartones buenos aumentarán el saldo de Bodega en esta fecha. Los malos solo se anotarán como quebrados y no afectarán el saldo. Este registro queda en el historial de Bodega.
        </div>}
        <div style={{ padding: 9, borderRadius: 8, background: colores.verdeSuave, color: colores.texto, fontSize: 12 }}>
          Registra juntos los buenos y los malos. Los buenos reutilizables aumentan el inventario en esta fecha; los malos quedan como dato de control de la ruta y no modifican el inventario.
        </div>
        <button type="submit" disabled={!permitirEscritura || ocupado || guardando || !!errorCarga || (sinTiquete && !onRegistrarSinTiquete)} style={estiloBoton}>{guardando ? "Registrando…" : sinTiquete ? "Agregar devolución a Bodega" : "Registrar devolución con tiquete"}</button>
      </form>

      {mensaje && <div role="status" aria-live="polite" style={{ padding: 9, marginTop: 9, borderRadius: 8, background: /registrad|corregido/i.test(mensaje) ? colores.verdeSuave : colores.alertaSuave, color: /registrad|corregido/i.test(mensaje) ? colores.verde : colores.alerta, fontSize: 12.5 }}>{mensaje}</div>}

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Tiquetes y movimientos de {fechaCorta(fecha)} ({recibidosHoy.length} devoluciones, {movimientosHoy.length} movimientos)</summary>
        {recibidosHoy.length > 0 && <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
            <thead><tr><th style={{ textAlign: "left", padding: 6 }}>Tiquete</th><th style={{ textAlign: "right", padding: 6 }}>Buenos</th><th style={{ textAlign: "right", padding: 6 }}>Malos</th><th style={{ textAlign: "right", padding: 6 }}>Saldo</th><th style={{ padding: 6 }}>Ruta de origen</th><th style={{ padding: 6 }}></th></tr></thead>
            <tbody>{recibidosHoy.map(tiquete => {
              const usados = cartonesUsadosTiquete(tiquete, movimientos);
              const editando = edicionId === String(tiquete.id);
              return <React.Fragment key={tiquete.id}>
                <tr>
                  <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, fontWeight: 700 }}>#{tiquete.numero}</td>
                  <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, textAlign: "right" }}>{formatoCartones(tiquete.cartones_iniciales)}</td>
                  <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, textAlign: "right" }}>{formatoCartones(tiquete.cartones_malos || 0, "0")}</td>
                  <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, textAlign: "right", fontWeight: 700 }}>{formatoCartones(tiquete.saldo_cartones)}</td>
                  <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}` }}>{fechaCorta(tiquete.fecha_ruta_origen)} · {tiquete.repartidor}</td>
                  <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, textAlign: "right" }}>
                    {permitirEscritura && <button type="button" onClick={() => editando ? setEdicionId("") : comenzarEdicion(tiquete)} style={{ padding: "5px 8px", fontSize: 11, borderRadius: 7, border: `1px solid ${colores.borde}`, background: colores.superficie, color: colores.texto, cursor: "pointer" }}>{editando ? "Cancelar" : "Corregir"}</button>}
                  </td>
                </tr>
                {editando && <tr><td colSpan={6} style={{ padding: 8, background: colores.fondo }}>
                  <form onSubmit={evento => guardarCorreccion(evento, tiquete)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                    <label style={{ flex: "1 1 120px", fontSize: 11, fontWeight: 600 }}>Número
                      <input required disabled={usados > 0} value={edicionNumero} onChange={evento => setEdicionNumero(evento.target.value)} style={estiloInput} />
                    </label>
                    <label style={{ flex: "1 1 120px", fontSize: 11, fontWeight: 600 }}>Cartones buenos
                      <input required type="text" inputMode="decimal" value={edicionCartones} onChange={evento => setEdicionCartones(evento.target.value)} style={estiloInput} />
                    </label>
                    <label style={{ flex: "1 1 120px", fontSize: 11, fontWeight: 600 }}>Cartones malos
                      <input type="text" inputMode="decimal" value={edicionCartonesMalos} onChange={evento => setEdicionCartonesMalos(evento.target.value)} style={estiloInput} />
                    </label>
                    {usados > 0 && <label style={{ flex: "2 1 200px", fontSize: 11, fontWeight: 600 }}>Motivo obligatorio (ya se usaron {formatoCartones(usados, "0")} cartones)
                      <input required value={edicionMotivo} onChange={evento => setEdicionMotivo(evento.target.value)} placeholder="Explica la corrección" style={estiloInput} />
                    </label>}
                    <button type="submit" disabled={!permitirEscritura || ocupado || guardando || !!errorCarga} style={estiloBoton}>{guardando ? "Guardando…" : usados > 0 ? "Registrar corrección" : "Guardar cambio"}</button>
                  </form>
                </td></tr>}
              </React.Fragment>;
            })}</tbody>
          </table>
        </div>}
        {movimientosHoy.length > 0 && <div style={{ display: "grid", gap: 5, marginTop: 9 }}>
          {movimientosHoy.map(movimiento => {
            const tiquete = tiquetesPorId.get(String(movimiento.tiquete_id));
            const delta = cartonesDe(movimiento);
            const esMala = movimiento.tipo === "devolucion_mala";
            const cantidadVisible = esMala ? Math.abs(delta) : delta;
            const nombre = movimiento.tipo === "devolucion" ? "Devolución buena recibida" : esMala ? "Cartones malos anotados (informativo)" : movimiento.tipo === "uso" ? "Usado en ruta" : "Corrección";
            return <div key={movimiento.id} style={{ padding: "7px 9px", background: colores.fondo, borderRadius: 7, fontSize: 11.5 }}>
              <b>{nombre}</b> · #{movimiento.numero || tiquete?.numero} · <b style={{ color: esMala ? "#A75A00" : delta >= 0 ? colores.verde : colores.alerta }}>{esMala ? formatoCartones(cantidadVisible) : `${delta > 0 ? "+" : ""}${formatoCartones(delta)}`} cart{esMala ? " · no modifica inventario" : ""}</b>
              {esMala ? <> · recibido {fechaCorta(movimiento.fecha_recepcion)}; vinculado a ruta origen {fechaCorta(movimiento.fecha_ruta)} · {movimiento.repartidor}</> : movimiento.tipo === "devolucion" ? <> · ruta origen {fechaCorta(movimiento.fecha_ruta)} · {movimiento.repartidor}</> : <> · ruta {fechaCorta(movimiento.fecha_ruta)} · {movimiento.repartidor}</>}
              {!!movimiento.motivo && <div style={{ color: colores.textoSuave, marginTop: 2 }}>{movimiento.motivo}</div>}
            </div>;
          })}
        </div>}
        {!recibidosHoy.length && !movimientosHoy.length && <div style={{ color: colores.textoSuave, marginTop: 8, fontSize: 12 }}>Aún no hay devoluciones ni usos de tiquetes en esta fecha.</div>}
      </details>

      {devolucionesSinTiquete.length > 0 && <div style={{ marginTop: 9, padding: 9, borderRadius: 8, background: colores.fondo, fontSize: 12 }}>
        <b>Devoluciones sin tiquete en esta fecha</b>
        <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
          {devolucionesSinTiquete.map(devolucion => <div key={devolucion.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span>{devolucion.repartidor} · ruta {fechaCorta(devolucion.fechaRutaOrigen)} · buenos +{formatoCartones(devolucion.cartonesBuenos, "0")} · malos {formatoCartones(devolucion.cartonesMalos, "0")}</span>
            {permitirEscritura && onQuitarSinTiquete && <button type="button" onClick={() => onQuitarSinTiquete(devolucion.id)} style={{ padding: "4px 8px", border: `1px solid ${colores.borde}`, borderRadius: 6, background: colores.superficie, color: colores.alerta, cursor: "pointer" }}>Quitar</button>}
          </div>)}
        </div>
        <div style={{ marginTop: 6, color: colores.alerta, fontWeight: 600 }}>Pendiente de confirmar: pulsa “Guardar movimiento del día” para conservarlo.</div>
      </div>}

      {tiquetes.length > recibidosHoy.length && <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Consultar otros tiquetes devueltos ({tiquetes.length - recibidosHoy.length})</summary>
        <div style={{ display: "grid", gap: 5, marginTop: 7 }}>
          {tiquetes.filter(t => String(t.fecha_recepcion).slice(0, 10) !== fecha).map(t => <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 8px", background: colores.fondo, borderRadius: 7, fontSize: 11.5 }}><span>#{t.numero} · recibido {fechaCorta(t.fecha_recepcion)} · ruta {fechaCorta(t.fecha_ruta_origen)} ({t.repartidor})</span><b>{formatoCartones(t.saldo_cartones)} cart disponibles</b></div>)}
        </div>
      </details>}

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Detalle de tiquetes vinculados a las rutas de esta fecha ({detalleRutas.length})</summary>
        {!detalleRutas.length ? <div style={{ color: colores.textoSuave, marginTop: 7, fontSize: 12 }}>Estas rutas no tienen devoluciones ni reutilizaciones registradas.</div> : <div style={{ display: "grid", gap: 7, marginTop: 7 }}>
          {detalleRutas.map(({ ruta, devoluciones, devolucionesMalas, usos }) => <div key={claveRuta(ruta)} style={{ padding: 8, background: colores.fondo, borderRadius: 8, fontSize: 11.5 }}>
            <b>{ruta.repartidor}</b> · ruta {fechaCorta(ruta.fecha)}
            {devoluciones.map(t => <div key={`d-${t.id}`} style={{ marginTop: 4 }}>↩ Devolución #{t.numero}: {formatoCartones(t.cartones_iniciales)} buenos y {formatoCartones(t.cartones_malos || 0, "0")} malos; recibidos el {fechaCorta(t.fecha_recepcion)}{Number(t.cartones_iniciales) > 0 ? ` · saldo disponible ${formatoCartones(t.saldo_cartones)}` : " · sin saldo reutilizable"}</div>)}
            {devolucionesMalas.filter(m => !devoluciones.some(t => String(t.id) === String(m.tiquete_id))).map(m => <div key={`m-${m.id}`} style={{ marginTop: 4 }}>↩ Cartones malos de #{m.numero}: {formatoCartones(Math.abs(cartonesDe(m)))} anotados como quebrados; recibidos el {fechaCorta(m.fecha_recepcion)} · vinculados a esta ruta, sin afectar inventario</div>)}
            {usos.map(m => <div key={m.id} style={{ marginTop: 4 }}>↗ Usó #{m.numero}: {formatoCartones(Math.abs(cartonesDe(m)))} cart el {fechaCorta(m.fecha)}{tiquetesPorId.get(String(m.tiquete_id)) ? ` · saldo actual ${formatoCartones(tiquetesPorId.get(String(m.tiquete_id)).saldo_cartones)}` : ""}</div>)}
          </div>)}
        </div>}
      </details>

      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Historial de devoluciones sin tiquete ({historialSinTiquete.length})</summary>
        {!historialSinTiquete.length ? <div style={{ color: colores.textoSuave, marginTop: 7, fontSize: 12 }}>No hay devoluciones sin tiquete guardadas.</div> : <div style={{ overflowX: "auto", marginTop: 7 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 440 }}>
            <thead><tr>
              <th style={{ textAlign: "left", padding: 6 }}>Recibida</th>
              <th style={{ textAlign: "left", padding: 6 }}>Ruta origen</th>
              <th style={{ textAlign: "left", padding: 6 }}>Repartidor</th>
              <th style={{ textAlign: "right", padding: 6 }}>Buenos</th>
              <th style={{ textAlign: "right", padding: 6 }}>Malos</th>
              <th style={{ textAlign: "left", padding: 6 }}>Registro / acciones</th>
            </tr></thead>
            <tbody>{historialSinTiquete.map(devolucion => <React.Fragment key={devolucion.id}>
              <tr>
                <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}` }}>{fechaCorta(devolucion.fecha)}</td>
                <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}` }}>{fechaCorta(devolucion.fechaRuta)}</td>
                <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}` }}>{devolucion.repartidor}</td>
                <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, textAlign: "right", color: colores.verde, fontWeight: 700 }}>+{formatoCartones(devolucion.buenos, "0")}</td>
                <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, textAlign: "right", color: colores.alerta, fontWeight: 700 }}>{formatoCartones(devolucion.malos, "0")}</td>
                <td style={{ padding: 6, borderTop: `1px solid ${colores.borde}`, color: colores.textoSuave }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span>{devolucion.origenHistorico ? "Histórico" : "Bodega"}</span>
                    {permitirEscritura && onEditarSinTiquete && <button type="button" disabled={ocupado || guardando} onClick={() => edicionSinTiquete?.id === devolucion.id ? setEdicionSinTiquete(null) : comenzarEdicionSinTiquete(devolucion)} style={{ padding: "4px 8px", border: `1px solid ${colores.borde}`, borderRadius: 6, background: colores.superficie, color: colores.texto, cursor: "pointer" }}>{edicionSinTiquete?.id === devolucion.id ? "Cancelar" : "Editar"}</button>}
                  </div>
                  {!!devolucion.original?.historialEdiciones?.length && <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: "pointer", fontSize: 11 }}>Ver correcciones ({devolucion.original.historialEdiciones.length})</summary>
                    {devolucion.original.historialEdiciones.map((cambio, indice) => <div key={`${devolucion.id}-cambio-${indice}`} style={{ marginTop: 4, color: colores.texto, fontSize: 11 }}>
                      {cambio.fechaHora ? new Date(cambio.fechaHora).toLocaleString("es") : "Corrección"} · {cambio.por || "Sin indicar"} · {cambio.motivo || "Sin motivo"}
                    </div>)}
                  </details>}
                </td>
              </tr>
              {edicionSinTiquete?.id === devolucion.id && <tr><td colSpan={6} style={{ padding: 8, borderTop: `1px solid ${colores.borde}`, background: colores.fondo}}>
                <form onSubmit={guardarEdicionSinTiquete} style={{ display: "grid", gap: 8 }}>
                  <b>Corregir devolución recibida el {fechaCorta(devolucion.fecha)}</b>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Ruta de origen
                    <input type="search" value={busquedaRutaEdicion} onChange={evento => setBusquedaRutaEdicion(evento.target.value)} placeholder="Filtrar por repartidor o fecha…" style={estiloInput} />
                    <select required value={edicionSinTiqueteRuta} onChange={evento => setEdicionSinTiqueteRuta(evento.target.value)} style={{ ...estiloInput, marginTop: 5 }}>
                      <option value="">Seleccionar ruta…</option>
                      {edicionSinTiqueteRuta && !rutasEdicionVisibles.some(ruta => `${ruta.movimientoId}::${ruta.rutaId}` === edicionSinTiqueteRuta) && rutasEdicionPorClave.has(edicionSinTiqueteRuta) && <option value={edicionSinTiqueteRuta}>{mostrarOpcionRuta(rutasEdicionPorClave.get(edicionSinTiqueteRuta))} · selección actual</option>}
                      {rutasEdicionVisibles.map(ruta => <option key={`${ruta.movimientoId}::${ruta.rutaId}`} value={`${ruta.movimientoId}::${ruta.rutaId}`}>{mostrarOpcionRuta(ruta)}</option>)}
                    </select>
                    {!rutasEdicionVisibles.length && <span style={{ display: "block", color: colores.alerta, marginTop: 4 }}>No hay rutas anteriores a la fecha de recepción que coincidan con el filtro.</span>}
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ flex: "1 1 120px", fontSize: 12, fontWeight: 600 }}>Cartones buenos
                      <input type="text" inputMode="decimal" value={edicionSinTiqueteBuenos} onChange={evento => setEdicionSinTiqueteBuenos(evento.target.value)} style={estiloInput} />
                    </label>
                    <label style={{ flex: "1 1 120px", fontSize: 12, fontWeight: 600 }}>Cartones malos
                      <input type="text" inputMode="decimal" value={edicionSinTiqueteMalos} onChange={evento => setEdicionSinTiqueteMalos(evento.target.value)} style={estiloInput} />
                    </label>
                  </div>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Motivo de corrección (obligatorio)
                    <input required value={edicionSinTiqueteMotivo} onChange={evento => setEdicionSinTiqueteMotivo(evento.target.value)} placeholder="Explica qué se corrigió" style={estiloInput} />
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button type="submit" disabled={ocupado || guardando || !permitirEscritura} style={estiloBoton}>{guardando ? "Guardando…" : "Guardar corrección y recalcular saldos"}</button>
                    <span style={{ color: colores.textoSuave, fontSize: 11 }}>La fecha recibida se conserva. Solo se permiten rutas de esa fecha o anteriores.</span>
                  </div>
                </form>
              </td></tr>}
            </React.Fragment>)}</tbody>
          </table>
        </div>}
        <div style={{ marginTop: 7, fontSize: 11, color: colores.textoSuave }}>Toda corrección requiere motivo y queda auditada. Se recalcula el inventario por los cartones buenos; los malos permanecen como dato informativo.</div>
      </details>
    </section>
  );
}
