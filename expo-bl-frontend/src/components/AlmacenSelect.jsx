// ── Agregar este componente DENTRO de Reportes.jsx, antes del return ──

const AlmacenSelect = ({ value, onChange, onSave }) => {
  const [query, setQuery] = useState(value || "");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMostrar(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sincronizar si value cambia externamente
  useEffect(() => { setQuery(value || ""); }, [value]);

  const buscar = (q) => {
    clearTimeout(debounceRef.current);
    setQuery(q);
    onChange(q); // actualiza igual mientras escribe
    setNoEncontrado(false);

    if (q.trim().length < 2) { setResultados([]); setMostrar(false); return; }

    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`${API_URL}/api/mantenedores/almacenistas`);
        if (res.ok) {
          const data = await res.json();
          const filtrados = data.filter(a =>
            a.nombre.toLowerCase().includes(q.toLowerCase())
          ).slice(0, 8);
          setResultados(filtrados);
          setMostrar(true);
          setNoEncontrado(filtrados.length === 0);
        }
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 300);
  };

  const seleccionar = (almacenista) => {
    setQuery(almacenista.nombre);
    onChange(almacenista.nombre);
    setMostrar(false);
    setNoEncontrado(false);
    onSave?.(); // dispara el autosave
  };

  const crearNuevo = async () => {
    setMostrar(false);
    const result = await Swal.fire({
      title: "Almacenista no encontrado",
      html: `
        <p style="color:#64748b; font-size:14px; margin-bottom:16px;">
          "<strong>${query}</strong>" no existe en el Mantenedor de Almacenistas.<br/>
          ¿Deseas agregarlo como nuevo almacenista?
        </p>
        <div style="text-align:left; display:grid; gap:10px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151;">RUT *</label>
            <input id="alm-rut" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="Ej: 76451351-7">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151;">Código Almacén *</label>
            <input id="alm-codigo" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="Ej: A-84">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151;">Nación ID</label>
            <input id="alm-nacion" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="CL" value="CL" maxlength="2">
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, crear",
      cancelButtonText: "No, solo guardar el nombre",
      confirmButtonColor: "#0F2A44",
      cancelButtonColor: "#64748b",
      width: "480px",
      preConfirm: () => {
        const rut = document.getElementById("alm-rut")?.value?.trim();
        const codigo = document.getElementById("alm-codigo")?.value?.trim();
        const nacion = document.getElementById("alm-nacion")?.value?.trim().toUpperCase() || "CL";
        if (!rut) { Swal.showValidationMessage("El RUT es obligatorio"); return null; }
        if (!codigo) { Swal.showValidationMessage("El Código Almacén es obligatorio"); return null; }
        return { rut, codigo_almacen: codigo, nacion_id: nacion };
      }
    });

    if (result.isConfirmed && result.value) {
      try {
        const res = await fetch(`${API_URL}/api/mantenedores/almacenistas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: query.trim(),
            rut: result.value.rut,
            nacion_id: result.value.nacion_id,
            codigo_almacen: result.value.codigo_almacen,
          }),
        });
        if (res.ok) {
          await Swal.fire({
            icon: "success",
            title: "Almacenista creado",
            text: `"${query}" fue agregado al mantenedor`,
            timer: 2000,
            showConfirmButton: false,
          });
          onSave?.();
        } else {
          throw new Error("Error al crear");
        }
      } catch {
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo crear el almacenista", confirmButtonColor: "#0F2A44" });
      }
    } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
      // Solo guarda el nombre sin crear en BD
      onSave?.();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          value={query}
          onChange={e => buscar(e.target.value)}
          onFocus={() => query.length >= 2 && setMostrar(true)}
          className="w-full min-w-[160px] bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
          placeholder="Buscar almacenista..."
        />
        {buscando && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <RefreshCw size={10} className="animate-spin text-blue-400" />
          </div>
        )}
      </div>

      {/* Dropdown resultados */}
      {mostrar && resultados.length > 0 && (
        <div className="absolute z-50 w-64 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {resultados.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => seleccionar(a)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
            >
              <p className="text-xs font-medium text-slate-800 truncate">{a.nombre}</p>
              <p className="text-[10px] text-slate-500">
                {a.codigo_almacen && <span className="font-mono">ALM: {a.codigo_almacen}</span>}
                {a.rut && <span className="ml-2">RUT: {a.rut}</span>}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* No encontrado */}
      {mostrar && noEncontrado && query.trim().length >= 2 && (
        <div className="absolute z-50 w-64 mt-1 bg-white border border-orange-200 rounded-lg shadow-lg">
          <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
            No existe "<strong>{query}</strong>" en el mantenedor
          </div>
          <button
            type="button"
            onClick={crearNuevo}
            className="w-full text-left px-3 py-2 text-xs text-orange-700 font-semibold hover:bg-orange-50 transition-colors"
          >
            + Agregar como nuevo almacenista
          </button>
        </div>
      )}
    </div>
  );
};