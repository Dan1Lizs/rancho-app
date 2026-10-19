export default function DatosRespaldosView({ onExportar, onImportar, ocupado }) {
  return <section className="v10-settings-card">
    <h3>Datos y respaldos</h3>
    <p>Guarda una copia completa antes de cambios importantes. El archivo contiene datos operativos y financieros; consérvalo en un lugar privado.</p>
    <button type="button" className="v10-primary-action" onClick={onExportar} disabled={ocupado}>
      💾 Exportar todos los datos (respaldo JSON)
    </button>
    <div style={{ marginTop: 16 }}>
      <label htmlFor="archivo-respaldo-rancho" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Importar respaldo JSON</label>
      <input id="archivo-respaldo-rancho" type="file" accept="application/json,.json" disabled={ocupado} onChange={onImportar} style={{ display: "block", width: "100%", marginBottom: 6 }} />
      <small className="v10-help">Primero muestra una vista previa y no cambia nada. Al confirmar, solo agrega registros faltantes; las fechas que ya existen se pueden revisar aparte antes de reemplazarlas.</small>
    </div>
  </section>;
}
