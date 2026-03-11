import { useState, useRef, useEffect } from "react";
import { Download, Upload, RefreshCw, FileSpreadsheet, CheckCircle, AlertCircle, Ship, Search } from "lucide-react";
import XLSX from "xlsx-js-style";
import Sidebar from "../components/Sidebar";
import Swal from "sweetalert2";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const COLUMNS = [
  { key: "nombre_nave", label: "Nombre de Nave" },
  { key: "codigo_nave", label: "Lloyd / IMO Nave" },
  { key: "viaje", label: "Viaje" },
  { key: "puerto_embarque", label: "Puerto de Embarque" },
  { key: "puerto_desembarque", label: "Puerto de Desembarque" },
  { key: "bl", label: "BL" },
  { key: "n_contenedor", label: "N° Contenedor" },
  { key: "tipo_contenedor", label: "Tipo de Contenedor" },
  { key: "almacen", label: "Almacén" },
  { key: "deposito", label: "Depósito" },
  { key: "operador", label: "Operador" },
  { key: "nombre_cliente", label: "Nombre Cliente" },
];

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function exportToExcel(rowsToExport, filename) {
  const wsData = [
    COLUMNS.map((c) => c.label),
    ...rowsToExport.map((r) => COLUMNS.map((c) => r[c.key] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = COLUMNS.map((_, i) => ({ wch: i >= 10 ? 30 : 22 }));

  // ── Estilo encabezado celeste (#00B0F0) ──
  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "00B0F0" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      bottom: { style: "thin", color: { rgb: "FFFFFF" } },
    },
  };

  COLUMNS.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellAddr]) return;
    ws[cellAddr].s = headerStyle;
  });

  // Altura de fila del encabezado
  ws["!rows"] = [{ hpt: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");

  // xlsx-js-style soporta estilos — si usas xlsx normal, instala xlsx-js-style
  XLSX.writeFile(wb, filename);
}

// ── Columnas plantilla TATC ──
const TATC_COLUMNS = [
  { key: "nave_codigo", label: "Nave" },
  { key: "viaje", label: "Viaje" },
  { key: "imo_nave", label: "Lloyd" },      // ya tenía esto — NO tocar
  { key: "n_contenedor_tatc", label: "Nro Contenedor" },  // antes n_contenedor
  { key: "tipo_bulto", label: "Tipo Bulto" },
  { key: "tam_contenedor", label: "Tamaño Contenedor" },  // antes tam_contenedor vacío
  { key: "tipo_cnt_sna", label: "Tipo Contenedor" },      // antes tipo_contenedor
  { key: "cod_iso", label: "Código ISO Contenedor" },
  { key: "estado_cnt", label: "Estado Contenedor" },
  { key: "tara", label: "Tara Contenedor" },
  { key: "anio_fab", label: "Año Fabricación Contenedor" },
  { key: "pais_fab", label: "País Fabricación Contenedor" },
  { key: "estado_emb", label: "Estado Embarque" },        // ahora con valor real
  { key: "num_reserva", label: "Número Reserva Armador" },
  { key: "almacen", label: "Almacén" },
  { key: "deposito", label: "Deposito Devolución" },
  { key: "aduana", label: "Aduana" },
  { key: "fecha_ingreso_pais", label: "Fecha Ingreso al País" },
  { key: "fecha_ingreso_dep", label: "Fecha Ingreso al Depósito" },
  { key: "fecha_emision_tatc", label: "Fecha Emisión TATC" },
  { key: "eir", label: "EIR" },
  { key: "ingreso_doc", label: "Ingreso Documento" },
];

function exportTATC(rowsToExport, filename) {
  // Encabezado naranja igual al de la imagen (#F4801A es el naranja de Excel)
  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "F4801A" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } },
  };

  // Mapear filas — solo los campos que tenemos, el resto vacío
  const wsData = [
    TATC_COLUMNS.map((c) => c.label),
    ...rowsToExport.map((r) => TATC_COLUMNS.map((c) => r[c.key] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = TATC_COLUMNS.map(() => ({ wch: 24 }));
  ws["!rows"] = [{ hpt: 22 }];

  // Aplicar estilo naranja al encabezado
  const grayKeys = ["tipo_bulto", "estado_cnt", "tara", "anio_fab", "pais_fab", "fecha_ingreso_pais", "fecha_ingreso_dep", "fecha_emision_tatc", "eir", "ingreso_doc"];

  const grayStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "808080" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } },
  };

  TATC_COLUMNS.forEach((col, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellAddr]) return;
    ws[cellAddr].s = grayKeys.includes(col.key) ? grayStyle : headerStyle;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TATC");
  XLSX.writeFile(wb, filename);
}

function formatCodigo(cnt) {
  if (cnt.sigla && cnt.numero && cnt.digito) return `${cnt.sigla} ${cnt.numero}-${cnt.digito}`;
  if (cnt.codigo && cnt.codigo.length === 11) {
    return `${cnt.codigo.slice(0, 4)} ${cnt.codigo.slice(4, 10)}-${cnt.codigo.slice(10, 11)}`;
  }
  return cnt.codigo || "";
}

const CNT_TYPE_MAP = {
  "22G0": "20DC", "22G1": "20DC", "22G2": "20DC", "22G3": "20DC", "22GP": "20DC",
  "42G0": "40DC", "42G1": "40DC", "42G2": "40DC", "42GP": "40DC",
  "45G0": "40HC", "45G1": "40HC", "45GP": "40HC",
  "22R0": "20RF", "22R1": "20RF", "22RT": "20RF",
  "42R0": "40RF", "42R1": "40RF", "42RT": "40RF",
  "45R0": "40HR", "45R1": "40HR", "45RT": "40HR",
  "22U0": "20OT", "22U1": "20OT", "22UT": "20OT",
  "42U0": "40OT", "42U1": "40OT", "42UT": "40OT",
  "22P0": "20FR", "22P1": "20FR", "22P3": "20FR", "22PF": "20FR", "22PC": "20FR",
  "42P0": "40FR", "42P1": "40FR", "42P3": "40FR", "42PF": "40FR", "42PC": "40FR",
  "22T0": "20TK", "22T6": "20TK", "42T0": "40TK", "42T6": "40TK",
};

function formatTipoCnt(isoCod) {
  if (!isoCod) return "";
  const key = isoCod.toString().trim().toUpperCase();
  return CNT_TYPE_MAP[key] || key;
}

// BD: tipo_operacion "I" = IMPO, "S" = EXPO
const TIPO_OP_MAP = { IMPO: "I", EXPO: "S" };

// ↓↓↓ PEGA AQUÍ ↓↓↓
const AlmacenSelect = ({ value, onChange, onSave }) => {
  const [query, setQuery] = useState(value || "");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMostrar(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setQuery(value || ""); }, [value]);

  const buscar = (q) => {
    clearTimeout(debounceRef.current);
    setQuery(q);
    onChange(q);
    setNoEncontrado(false);
    if (q.trim().length < 2) { setResultados([]); setMostrar(false); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(`${API_URL}/api/mantenedores/almacenistas`);
        if (res.ok) {
          const data = await res.json();
          const filtrados = data.filter(a => a.nombre.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
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
    onSave?.();
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
            <input id="alm-nacion" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="CL" maxlength="2">
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
      preConfirm: async () => {
        const rut = document.getElementById("alm-rut")?.value?.trim();
        const codigo = document.getElementById("alm-codigo")?.value?.trim();
        const nacion = document.getElementById("alm-nacion")?.value?.trim().toUpperCase() || "CL";
        if (!rut) { Swal.showValidationMessage("El RUT es obligatorio"); return null; }
        if (!codigo) { Swal.showValidationMessage("El Código Almacén es obligatorio"); return null; }
        try {
          const res = await fetch(`${API_URL}/api/mantenedores/almacenistas`);
          if (res.ok) {
            const lista = await res.json();
            const duplicado = lista.find(a => a.codigo_almacen?.toLowerCase() === codigo.toLowerCase());
            if (duplicado) {
              Swal.showValidationMessage(
                `El código "${duplicado.codigo_almacen}" ya existe — ` +
                `Nombre: ${duplicado.nombre} · RUT: ${duplicado.rut || "—"} · Nación: ${duplicado.nacion_id || "—"}`
              );
              return null;
            }
          }
        } catch { /* el backend validará igual */ }
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
          await Swal.fire({ icon: "success", title: "Almacenista creado", text: `"${query}" fue agregado al mantenedor`, timer: 2000, showConfirmButton: false });
          onSave?.();
        } else {
         const errData = await res.json().catch(() => ({}));
          if (res.status === 409) {
            const [existing] = await fetch(`${API_URL}/api/mantenedores/almacenistas`)
              .then(r => r.json()).catch(() => []);
            const duplicado = existing;
            Swal.fire({
              icon: "warning",
              title: "Código de almacén ya registrado",
              html: `
                <p style="color:#64748b; font-size:13px; margin-bottom:14px;">
                  El código <strong style="color:#d97706;">"${query}"</strong> ya está asignado a:
                </p>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; text-align:left; font-size:13px; display:grid; gap:6px;">
                  <div><span style="color:#94a3b8; font-size:11px; font-weight:600;">NOMBRE</span><br/><strong style="color:#1e293b;">${duplicado?.nombre || "—"}</strong></div>
                  <div><span style="color:#94a3b8; font-size:11px; font-weight:600;">RUT</span><br/><span style="color:#334155;">${duplicado?.rut || "—"}</span></div>
                  <div><span style="color:#94a3b8; font-size:11px; font-weight:600;">CÓDIGO ALMACÉN</span><br/><span style="color:#334155;">${duplicado?.codigo_almacen || "—"}</span></div>
                  <div><span style="color:#94a3b8; font-size:11px; font-weight:600;">NACIÓN</span><br/><span style="color:#334155;">${duplicado?.nacion_id || "—"}</span></div>
                </div>
              `,
              confirmButtonText: "Entendido",
              confirmButtonColor: "#0F2A44",
              width: "420px",
            });
          } else {
            Swal.fire({ icon: "error", title: "No se pudo crear", text: errData.error || "Error al crear el almacenista", confirmButtonColor: "#0F2A44" });
          }
        }
      } catch {
        Swal.fire({ icon: "error", title: "Error", text: "No se pudo crear el almacenista", confirmButtonColor: "#0F2A44" });
      }
    } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) {
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
        {buscando && <div className="absolute right-2 top-1/2 -translate-y-1/2"><RefreshCw size={10} className="animate-spin text-blue-400" /></div>}
      </div>
      {mostrar && resultados.length > 0 && (
        <div className="absolute z-50 w-64 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {resultados.map(a => (
            <button key={a.id} type="button" onClick={() => seleccionar(a)} className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors">
              <p className="text-xs font-medium text-slate-800 truncate">{a.nombre}</p>
              <p className="text-[10px] text-slate-500">
                {a.codigo_almacen && <span className="font-mono">ALM: {a.codigo_almacen}</span>}
                {a.rut && <span className="ml-2">RUT: {a.rut}</span>}
              </p>
            </button>
          ))}
        </div>
      )}
      {mostrar && noEncontrado && query.trim().length >= 2 && (
        <div className="absolute z-50 w-64 mt-1 bg-white border border-orange-200 rounded-lg shadow-lg">
          <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">No existe "<strong>{query}</strong>" en el mantenedor</div>
          <button type="button" onClick={crearNuevo} className="w-full text-left px-3 py-2 text-xs text-orange-700 font-semibold hover:bg-orange-50 transition-colors">
            + Agregar como nuevo almacenista
          </button>
        </div>
      )}
    </div>
  );
};
// ↑↑↑ FIN AlmacenSelect ↑↑↑

export default function Reportes() {
  const [allManifiestos, setAllManifiestos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingBLs, setLoadingBLs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [step, setStep] = useState(1);
  const fileInputRef = useRef(null);
  const [comboSearch, setComboSearch] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef(null);
  const [tableSearch, setTableSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("todos");
  const [tipoOp, setTipoOp] = useState("IMPO");

  // ── Filas filtradas para la tabla ──
  const filteredRows = rows.filter((r) => {
    const q = tableSearch.toLowerCase();
    const matchSearch = !q ||
      (r.bl || "").toLowerCase().includes(q) ||
      (r.nombre_nave || "").toLowerCase().includes(q) ||
      (r.n_contenedor || "").toLowerCase().includes(q) ||
      (r.nombre_cliente || "").toLowerCase().includes(q) ||
      (r.operador || "").toLowerCase().includes(q) ||
      (r.tipo_contenedor || "").toLowerCase().includes(q) ||
      (r.puerto_embarque || "").toLowerCase().includes(q) ||
      (r.puerto_desembarque || "").toLowerCase().includes(q);
    const matchFilter =
      tableFilter === "todos" ||
      (tableFilter === "con_contenedor" && r.n_contenedor) ||
      (tableFilter === "sin_contenedor" && !r.n_contenedor);
    return matchSearch && matchFilter;
  });

  // ── Combo filtrado por tipoOp + texto ──
  const comboFiltered = allManifiestos.filter((m) => {
    const tipoNorm = (m.tipoOperacion ?? m.tipo_operacion ?? "").toString().trim().toUpperCase();
    const matchTipo = tipoNorm === TIPO_OP_MAP[tipoOp];
    const q = comboSearch.toLowerCase().trim();
    const matchSearch = !q ||
      (m.nave || m.nombre_nave || "").toLowerCase().includes(q) ||
      (m.viaje || "").toLowerCase().includes(q) ||
      (m.codigo_nave || "").toLowerCase().includes(q);
    return matchTipo && matchSearch;
  }).slice(0, 8);

  const manifiestosTipo = allManifiestos.filter(
    (m) => (m.tipoOperacion ?? m.tipo_operacion ?? "").toString().trim().toUpperCase() === TIPO_OP_MAP[tipoOp]
  );
  const handleExportAll = async () => {
    if (!rows.length) { showToast("error", "No hay datos para exportar"); return; }

    const isEmpty = (val) => !val || val.toString().trim() === "" || val.toString().trim() === "—";

    const colsConVacios = COLUMNS
      .map((col) => ({
        label: col.label,
        count: rows.filter(r => isEmpty(r[col.key])).length,
      }))
      .filter(({ count }) => count > 0);

    if (colsConVacios.length > 0) {
      const result = await Swal.fire({
        title: "Datos incompletos",
        html: `
        <p style="color:#64748b; margin-bottom:12px; font-size:14px;">Algunas filas no tienen datos completos:</p>
        <ul style="text-align:left; padding-left:20px; margin-bottom:8px;">
          ${colsConVacios.map(({ label, count }) =>
          `<li style="color:#dc2626; font-size:13px; margin-bottom:4px;">• <strong>${label}</strong>: ${count} fila(s) vacía(s)</li>`
        ).join("")}
        </ul>
        <p style="color:#64748b; font-size:13px;">¿Exportar de todas formas?</p>
      `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#0F2A44",
        cancelButtonColor: "#ef4444",
        confirmButtonText: "Sí, exportar igual",
        cancelButtonText: "Cancelar",
        width: "480px",
      });
      if (!result.isConfirmed) return;
    }

    const nave = selectedInfo?.nombre_nave || selectedInfo?.nave || "nave";
    const viaje = selectedInfo?.viaje || "viaje";
    exportToExcel(rows, `Reporte_${nave}_${viaje}_${today()}.xlsx`);
    showToast("success", "Excel exportado");
  };

  const handleExportTATC = async () => {
    if (!rows.length) { showToast("error", "No hay datos para exportar"); return; }

    const nombresLegibles = {
      nombre_nave: "Nave",
      viaje: "Viaje",
      codigo_nave: "Lloyd / IMO",
      n_contenedor: "Nro Contenedor",
      tipo_contenedor: "Tipo Contenedor",
      almacen: "Almacén",
      deposito: "Depósito",
    };

    const camposVacios = Object.keys(nombresLegibles).filter(
      (campo) => rows.every((r) => !r[campo])
    );

    if (camposVacios.length > 0) {
      const result = await Swal.fire({
        title: "Columnas sin datos",
        html: `
        <p style="color:#64748b; margin-bottom:12px; font-size:14px;">Las siguientes columnas están completamente vacías:</p>
        <ul style="text-align:left; padding-left:20px; margin-bottom:8px;">
          ${camposVacios.map(c => `<li style="color:#dc2626; font-size:13px; margin-bottom:4px;">• <strong>${nombresLegibles[c]}</strong></li>`).join("")}
        </ul>
        <p style="color:#64748b; font-size:13px;">¿Exportar la plantilla TATC de todas formas?</p>
      `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#F97316",
        cancelButtonColor: "#ef4444",
        confirmButtonText: "Sí, exportar igual",
        cancelButtonText: "Cancelar",
        width: "480px",
      });
      if (!result.isConfirmed) return;
    }

    const nave = selectedInfo?.nombre_nave || selectedInfo?.nave || "nave";
    const viaje = selectedInfo?.viaje || "viaje";
    exportTATC(rows, `TATC_${nave}_${viaje}_${today()}.xlsx`);
    showToast("success", "Plantilla TATC exportada");
  };

  // ── Cerrar combo al click fuera ──
  useEffect(() => {
    const handler = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setComboOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Cargar todos los manifiestos al montar ──
  useEffect(() => {
    const fetchAll = async () => {
      setLoadingAll(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/manifiestos`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAllManifiestos(Array.isArray(data) ? data : data.data ?? []);
      } catch { /* silencioso */ }
      finally { setLoadingAll(false); }
    };
    fetchAll();
  }, []);

  // ── Seleccionar manifiesto → cargar BLs + depósitos guardados ──
  const handleSelectManifiesto = async (manifiesto) => {
    setSelectedId(manifiesto.id);
    setSelectedInfo(manifiesto);
    setLoadingBLs(true);
    setStep(2);
    try {
      const token = localStorage.getItem("token");
      const [resBls, resDepositos] = await Promise.all([
        fetch(`${API_URL}/api/manifiestos/${manifiesto.id}/bls`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/manifiestos/${manifiesto.id}/depositos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const bls = await resBls.json();
      const depositosGuardados = resDepositos.ok ? await resDepositos.json() : [];

      // Índice para lookup O(1)
      const depositoMap = {};
      depositosGuardados.forEach((d) => {
        depositoMap[`${d.bl}||${d.n_contenedor ?? ""}`] = d;
      });

      const mapped = bls.flatMap((bl) => {
        const contenedores = bl.contenedores ?? [];

        if (contenedores.length === 0) {
          const key = `${bl.bl_number || ""}||`;
          const saved = depositoMap[key] || {};
          return [{
            nombre_nave: manifiesto.nave || manifiesto.nombre_nave || "",
            codigo_nave: manifiesto.imo || "",
            nave_codigo: manifiesto.codigo_nave || "",
            imo_nave: manifiesto.imo || "",
            viaje: manifiesto.viaje || "",
            puerto_embarque: bl.codigo_puerto_embarque || "",
            puerto_desembarque: bl.codigo_puerto_descarga || "",
            bl: bl.bl_number || "",
            total_contenedores: 0,
            n_contenedor: "",
            n_contenedor_tatc: "",
            tipo_contenedor: "",
            tam_contenedor: "",
            tipo_cnt_sna: "",
            estado_emb: bl.tipo_servicio || "",
            aduana: bl.aduana_embarque || "",
            almacen: saved.almacen ?? bl.almacenador ?? "",
            deposito: saved.deposito ?? "",
            operador: bl.operador_nave || "",
            nombre_cliente: bl.consignee || "",
          }];
        }

        return contenedores.map((cnt) => {
          const nCnt = formatCodigo(cnt);
          const key = `${bl.bl_number || ""}||${nCnt}`;
          const saved = depositoMap[key] || {};
          return {
            nombre_nave: manifiesto.nave || manifiesto.nombre_nave || "",
            codigo_nave: manifiesto.imo || "",
            nave_codigo: manifiesto.codigo_nave || "",
            imo_nave: manifiesto.imo || "",
            viaje: manifiesto.viaje || "",
            puerto_embarque: bl.codigo_puerto_embarque || "",
            puerto_desembarque: bl.codigo_puerto_descarga || "",
            bl: bl.bl_number || "",
            total_contenedores: bl.total_contenedores ?? contenedores.length,
            n_contenedor: nCnt,
            n_contenedor_tatc: cnt.codigo_raw || "",
            tipo_contenedor: formatTipoCnt(cnt.tipo_cnt),
            tam_contenedor: cnt.tam_contenedor || "",
            tipo_cnt_sna: cnt.tipo_cnt_sna || "",
            tipo_bulto: cnt.tipo_bulto || "",
            estado_emb: bl.tipo_servicio || "",
            aduana: bl.aduana_embarque || "",
            almacen: saved.almacen ?? bl.almacenador ?? "",
            deposito: saved.deposito ?? "",
            operador: bl.operador_nave || "",
            nombre_cliente: bl.consignee || "",
          };
        });
      });

      setRows(mapped);
      const totalConts = mapped.filter(r => r.n_contenedor).length;
      showToast("success", `${totalConts} contenedores cargados (${bls.length} BLs)`);
    } catch {
      showToast("error", "Error al cargar BLs");
    } finally {
      setLoadingBLs(false);
    }
  };

  // ── Auto-save con debounce de 800ms ──
  const autoSaveTimers = useRef({});

  const latestRows = useRef(rows);

  useEffect(() => {
    latestRows.current = rows;
  }, [rows]);

  const handleCellEdit = (rowIdx, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)));
    if (!selectedId) return;

    clearTimeout(autoSaveTimers.current[rowIdx]);
    autoSaveTimers.current[rowIdx] = setTimeout(async () => {
      setRows((prev) => {
        const row = prev[rowIdx];
        if (!row) return prev;
        const token = localStorage.getItem("token");

        // Guardar en tabla reportes (ya existía)
        fetch(`${API_URL}/api/manifiestos/${selectedId}/depositos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            bl: row.bl,
            n_contenedor: row.n_contenedor ?? "",
            deposito: row.deposito ?? "",
            almacen: row.almacen ?? "",
          }),
        }).catch(() => { });

        // ── Si cambió el almacén, actualizar el BL también ──
        if (key === "almacen" && value && row.bl) {
          (async () => {
            try {
              const resAlm = await fetch(`${API_URL}/api/mantenedores/almacenistas`);
              if (!resAlm.ok) return;
              const almacenistas = await resAlm.json();
              const encontrado = almacenistas.find(
                a => a.nombre.toLowerCase() === value.toLowerCase()
              );

              await fetch(`${API_URL}/api/bls/${row.bl}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(encontrado ? {
                  almacenista_id: encontrado.id,
                  almacenista_nombre: encontrado.nombre,
                  almacenista_rut: encontrado.rut,
                  almacenista_nacion_id: encontrado.nacion_id,
                  almacenista_codigo_almacen: encontrado.codigo_almacen,
                } : {
                  almacenista_nombre: value,
                }),
              });
            } catch (err) {
              console.warn("No se pudo actualizar el almacenista en el BL:", err);
            }
          })();
        }

        return prev;
      });
    }, 800);
  };

  // ── Guardar todo de una vez ──
  const handleSaveAll = async () => {
    if (!selectedId || !latestRows.current.length) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const currentRows = latestRows.current;

      const payload = currentRows.map((r) => ({
        bl: r.bl,
        n_contenedor: r.n_contenedor ?? "",
        deposito: r.deposito ?? "",
        almacen: r.almacen ?? "",
      }));

      const res = await fetch(`${API_URL}/api/manifiestos/${selectedId}/depositos/bulk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      const almacenistas = await fetch(`${API_URL}/api/mantenedores/almacenistas`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => []);

      const blsConAlmacen = currentRows.filter(r => r.almacen && r.bl);
      await Promise.all(blsConAlmacen.map(async (row) => {
        const encontrado = almacenistas.find(
          a => a.nombre.toLowerCase() === row.almacen.toLowerCase()
        );
        await fetch(`${API_URL}/api/bls/${row.bl}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(encontrado ? {
            almacenista_id: encontrado.id,
            almacenista_nombre: encontrado.nombre,
            almacenista_rut: encontrado.rut,
            almacenista_nacion_id: encontrado.nacion_id,
            almacenista_codigo_almacen: encontrado.codigo_almacen,
          } : {
            almacenista_nombre: row.almacen,
          }),
        }).catch(() => { });
      }));

      showToast("success", `${data.actualizadas ?? currentRows.length} filas guardadas y BLs actualizados`);
    } catch {
      showToast("error", "Error al guardar");
    } finally {
      setSaving(false);
    }
  };



  // ── Verificar columnas vacías antes de exportar ──
  const checkEmptyColumns = async (rowsToCheck, columnsToCheck) => {
    const emptyLabels = columnsToCheck
      .filter(({ key }) => rowsToCheck.every((r) => !r[key]))
      .map(({ label }) => label);

    if (emptyLabels.length === 0) return true; // todo OK, continuar

    const result = await Swal.fire({
      title: "Datos incompletos",
      html: `
      <p style="color:#64748b; margin-bottom:12px; font-size:14px;">
        Las siguientes columnas no tienen datos en ninguna fila:
      </p>
      <ul style="text-align:left; padding-left:20px; margin-bottom:8px;">
        ${emptyLabels.map(l => `<li style="color:#dc2626; font-size:13px; margin-bottom:4px;">• <strong>${l}</strong></li>`).join("")}
      </ul>
      <p style="color:#64748b; font-size:13px;">¿Deseas exportar de todas formas?</p>
    `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0F2A44",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Sí, exportar igual",
      cancelButtonText: "Cancelar",
      width: "480px",
    });

    return result.isConfirmed;
  };

  const handleExportSingleBL = (row) => {
    exportToExcel([row], `BL_${row.bl || "bl"}_${row.nombre_nave || "nave"}_${today()}.xlsx`);
    showToast("success", `Excel exportado para BL ${row.bl}`);
  };



  // ── Importar Excel con depósito/almacén ──
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const readFile = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => resolve(evt.target.result);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsBinaryString(f);
    });

    try {
      const result = await readFile(file);
      const wb = XLSX.read(result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
      if (data.length < 2) { showToast("error", "El archivo está vacío"); return; }

      const headers = data[0].map((h) => String(h).trim());
      const findCol = (label) => headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());
      const blIdx = findCol("BL");
      const contenedorIdx = findCol("N° Contenedor");
      const depositoIdx = findCol("Depósito");
      const almacenIdx = findCol("Almacén");

      if (blIdx === -1) { showToast("error", "El Excel no tiene columna 'BL'"); return; }

      const updates = {};
      data.slice(1).forEach((row) => {
        const blVal = String(row[blIdx] ?? "").trim();
        const cntVal = contenedorIdx !== -1 ? String(row[contenedorIdx] ?? "").trim() : "";
        if (!blVal) return;
        updates[`${blVal}||${cntVal}`] = {
          ...(depositoIdx !== -1 ? { deposito: String(row[depositoIdx] ?? "").trim() } : {}),
          ...(almacenIdx !== -1 ? { almacen: String(row[almacenIdx] ?? "").trim() } : {}),
        };
      });

      // ── Verificar almacenes contra mantenedor ──
      const nombresDelExcel = [...new Set(Object.values(updates).map(u => u.almacen).filter(Boolean))];
      if (nombresDelExcel.length > 0) {
        const resAlm = await fetch(`${API_URL}/api/mantenedores/almacenistas`);
        if (resAlm.ok) {
          const almacenistasExistentes = await resAlm.json();
          const nombresExistentes = almacenistasExistentes.map(a => a.nombre.toLowerCase());
          const noExisten = nombresDelExcel.filter(n => !nombresExistentes.includes(n.toLowerCase()));

          for (const nombreExcel of noExisten) {
            // ── SWAL 1: Seleccionar existente ──
            const { value: accion } = await Swal.fire({
              title: "Almacenista no reconocido",
              html: `
    <p style="color:#64748b; font-size:13px; margin-bottom:14px;">
      El Excel tiene <strong style="color:#d97706;">"${nombreExcel}"</strong> pero no existe en el mantenedor.<br/>
      ¿Es alguno de estos?
    </p>
    <div style="text-align:left;">
      <label style="font-size:12px; font-weight:600; color:#374151;">Buscar almacenista:</label>
      <input id="alm-search" style="width:100%; margin-top:6px; padding:8px; border:1px solid #d1d5db; border-radius:8px; font-size:13px;" placeholder="Escribe para filtrar...">
      <div id="alm-lista" style="margin-top:6px; max-height:180px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px;">
        ${almacenistasExistentes.map(a => `
          <div 
            class="alm-item" 
            data-id="${a.id}" 
            data-nombre="${a.nombre}"
            style="padding:8px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9; transition:background 0.15s;"
            onmouseover="this.style.background='#f0f9ff'"
            onmouseout="this.style.background=this.classList.contains('selected') ? '#dbeafe' : 'white'"
          >
            <span style="font-weight:500; color:#1e293b;">${a.nombre}</span>
            <span style="color:#94a3b8; font-size:11px; margin-left:8px;">ALM: ${a.codigo_almacen || '—'} · RUT: ${a.rut || '—'}</span>
          </div>
        `).join("")}
      </div>
      <input type="hidden" id="alm-selected-id" value="">
    </div>
  `,
              icon: "question",
              showCancelButton: true,
              confirmButtonText: "Confirmar seleccionado",
              cancelButtonText: "No existe, crear uno nuevo",
              confirmButtonColor: "#0F2A44",
              cancelButtonColor: "#d97706",
              width: "520px",
              didOpen: () => {
                const search = document.getElementById("alm-search");
                const lista = document.getElementById("alm-lista");
                const hiddenId = document.getElementById("alm-selected-id");

                // Click en item
                lista.addEventListener("click", (e) => {
                  const item = e.target.closest(".alm-item");
                  if (!item) return;
                  // Deseleccionar anterior
                  lista.querySelectorAll(".alm-item").forEach(el => {
                    el.classList.remove("selected");
                    el.style.background = "white";
                  });
                  // Seleccionar nuevo
                  item.classList.add("selected");
                  item.style.background = "#dbeafe";
                  hiddenId.value = item.dataset.id;
                });

                // Filtrar al escribir
                search.addEventListener("input", () => {
                  const q = search.value.toLowerCase();
                  lista.querySelectorAll(".alm-item").forEach(el => {
                    const nombre = el.dataset.nombre.toLowerCase();
                    el.style.display = nombre.includes(q) ? "block" : "none";
                  });
                });
              },
              preConfirm: () => {
                const id = document.getElementById("alm-selected-id")?.value;
                if (!id) { Swal.showValidationMessage("Debes seleccionar un almacenista de la lista"); return null; }
                return { tipo: "existente", id: Number(id) };
              }
            });

            if (accion?.tipo === "existente") {
              // Vincular con el existente
              const almEncontrado = almacenistasExistentes.find(a => a.id === accion.id);
              if (almEncontrado) {
                Object.keys(updates).forEach(key => {
                  if ((updates[key].almacen || "").toLowerCase() === nombreExcel.toLowerCase()) {
                    updates[key].almacen = almEncontrado.nombre;
                  }
                });
              }

            } else {
              // ── SWAL 2: Crear nuevo ──
              const { value: nuevo } = await Swal.fire({
                title: "Agregar nuevo almacenista",
                html: `
        <p style="color:#64748b; font-size:13px; margin-bottom:14px;">
          Completa los datos para crear <strong style="color:#d97706;">"${nombreExcel}"</strong> en el mantenedor.
        </p>
        <div style="text-align:left; display:grid; gap:10px;">
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151;">RUT *</label>
            <input id="alm-rut" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="Ej: 76451351-7">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151;">Código Almacén *</label>
            <input id="alm-cod" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="Ej: A-84">
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; color:#374151;">Nación ID</label>
            <input id="alm-nacion" class="swal2-input" style="margin:4px 0 0 0; width:100%;" placeholder="CL" maxlength="2" value="CL">
          </div>
        </div>
      `,
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "+ Agregar como nuevo almacenista",
                cancelButtonText: "Importar igual (sin vincular)",
                confirmButtonColor: "#d97706",
                cancelButtonColor: "#64748b",
                width: "480px",
                preConfirm: async () => {
                  const rut = document.getElementById("alm-rut")?.value?.trim();
                  const cod = document.getElementById("alm-cod")?.value?.trim();
                  const nacion = document.getElementById("alm-nacion")?.value?.trim().toUpperCase() || "CL";
                  if (!rut) { Swal.showValidationMessage("El RUT es obligatorio"); return null; }
                  if (!cod) { Swal.showValidationMessage("El Código Almacén es obligatorio"); return null; }
                  try {
                    const res = await fetch(`${API_URL}/api/mantenedores/almacenistas`);
                    if (res.ok) {
                      const lista = await res.json();
                      const duplicado = lista.find(a => a.codigo_almacen?.toLowerCase() === cod.toLowerCase());
                      if (duplicado) {
                        Swal.showValidationMessage(`El código "${cod}" ya está en uso por "${duplicado.nombre}"`);
                        return null;
                      }
                    }
                  } catch { /* el backend validará igual */ }
                  return { rut, codigo_almacen: cod, nacion_id: nacion };
                }
              });

              if (nuevo) {
                try {
                  const resCreate = await fetch(`${API_URL}/api/mantenedores/almacenistas`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      nombre: nombreExcel.trim(),
                      rut: nuevo.rut,
                      nacion_id: nuevo.nacion_id,
                      codigo_almacen: nuevo.codigo_almacen,
                    }),
                  });
                  if (!resCreate.ok) throw new Error();
                  await Swal.fire({ icon: "success", title: "Almacenista creado", text: `"${nombreExcel}" fue agregado al mantenedor`, timer: 1800, showConfirmButton: false });
                } catch {
                  await Swal.fire({ icon: "error", title: "Error", text: "No se pudo crear el almacenista", confirmButtonColor: "#0F2A44" });
                }
              }
              // Si canceló "Importar igual" → sigue con el nombre tal cual
            }

          }
        }
      }

      let actualizadas = 0;
      setRows((prev) =>
        prev.map((r) => {
          const upd = updates[`${String(r.bl ?? "").trim()}||${String(r.n_contenedor ?? "").trim()}`];
          if (!upd) return r;
          actualizadas++;
          return { ...r, ...upd };
        })
      );

      showToast("success", `${actualizadas} fila(s) actualizadas desde Excel · guardando...`);
      setTimeout(() => handleSaveAll(), 150);

    } catch (err) {
      console.error("Error en handleFileUpload:", err);
      showToast("error", "No se pudo leer el archivo");
    }

    e.target.value = "";
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="text-[#0F2A44]" />
            <div>
              <h1 className="text-xl font-bold text-[#0F2A44]">Reportes de Contenedores</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedInfo
                  ? `${selectedInfo.nombre_nave || selectedInfo.nave || "—"} · Viaje ${selectedInfo.viaje || "—"}`
                  : "Selecciona un manifiesto para generar el reporte"}
              </p>
            </div>
          </div>

          {step === 2 && rows.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep(1); setRows([]); setSelectedId(null); setSelectedInfo(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={15} /> Cambiar manifiesto
              </button>

              <div className="relative group">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Upload size={15} /> Actualizar Depósito/Almacén
                </button>
                <div className="absolute top-full right-0 mt-2 w-72 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed shadow-xl">
                  Carga un Excel exportado previamente con <strong>Depósito</strong> y <strong>Almacén</strong> completados.
                  Se importa fila por fila usando BL + N° Contenedor como clave.
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />

              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#0F2A44] text-white text-sm rounded-lg hover:bg-[#0F2A44]/90 transition-colors disabled:opacity-60"
              >
                {saving
                  ? <><RefreshCw size={15} className="animate-spin" /> Guardando...</>
                  : <><CheckCircle size={15} /> Guardar todo</>}
              </button>

              <button
                onClick={handleExportAll}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Download size={15} /> Exportar todos ({rows.length} filas)
              </button>
              <button
                onClick={handleExportTATC}

                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg opacity-100 "
              >
                <Download size={15} /> Plantilla TATC
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8">

          {/* ── STEP 1: Seleccionar manifiesto ── */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Ship size={20} className="text-[#0F2A44]" />
                  <h2 className="font-semibold text-[#0F2A44]">Seleccionar Manifiesto</h2>
                </div>
                <p className="text-xs text-slate-500 mb-5">
                  Elige de la lista completa o filtra por nombre de nave, viaje o número de manifiesto.
                </p>

                {/* Botones IMPO / EXPO */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xs font-medium text-slate-500 mr-1">Tipo de operación:</span>
                  {["IMPO", "EXPO"].map((tipo) => (
                    <button
                      key={tipo}
                      onClick={() => { setTipoOp(tipo); setComboSearch(""); setComboOpen(false); }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${tipoOp === tipo
                        ? tipo === "IMPO"
                          ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                          : "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                    >
                      {tipo}
                    </button>
                  ))}
                  {!loadingAll && (
                    <span className="ml-auto text-[11px] text-slate-400">
                      {manifiestosTipo.length} manifiestos de {tipoOp}
                    </span>
                  )}
                </div>

                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Buscar manifiesto
                </label>
                <div className="relative mb-5" ref={comboRef}>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={comboSearch}
                      onChange={(e) => { setComboSearch(e.target.value); setComboOpen(true); }}
                      onFocus={() => setComboOpen(true)}
                      placeholder={
                        loadingAll
                          ? "Cargando manifiestos..."
                          : `Buscar entre ${manifiestosTipo.length} manifiestos de ${tipoOp}...`
                      }
                      disabled={loadingAll}
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/30 disabled:opacity-60"
                    />
                    {loadingAll && (
                      <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                    )}
                    {comboSearch && !loadingAll && (
                      <button
                        onClick={() => { setComboSearch(""); setComboOpen(false); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none"
                      >✕</button>
                    )}
                  </div>

                  {/* Dropdown */}
                  {comboOpen && comboFiltered.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      {comboFiltered.map((m) => {
                        const nombre = m.nave || m.nombre_nave || `#${m.id}`;
                        const q = comboSearch.toLowerCase();
                        const highlight = (text) => {
                          const str = String(text || "");
                          if (!q) return <span>{str}</span>;
                          const idx = str.toLowerCase().indexOf(q);
                          if (idx === -1) return <span>{str}</span>;
                          return <>{str.slice(0, idx)}<mark className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{str.slice(idx, idx + q.length)}</mark>{str.slice(idx + q.length)}</>;
                        };
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setComboSearch(nombre); setComboOpen(false); handleSelectManifiesto(m); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#0F2A44]/5 border-b border-slate-100 last:border-0 text-left transition-colors group"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-800 group-hover:text-[#0F2A44]">{highlight(nombre)}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                Viaje: <span className="font-medium">{highlight(m.viaje || "s/n")}</span>
                                {" · "}
                                Código: <span className="font-medium">{highlight(m.codigo_nave || "—")}</span>
                              </div>
                            </div>
                            <Ship size={15} className="text-slate-300 group-hover:text-[#0F2A44] shrink-0 ml-3" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {comboOpen && comboSearch && comboFiltered.length === 0 && !loadingAll && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-xs text-slate-400 text-center">
                      No se encontraron manifiestos de {tipoOp} con "{comboSearch}"
                    </div>
                  )}

                  {comboOpen && !comboSearch && !loadingAll && manifiestosTipo.length === 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-xs text-slate-400 text-center">
                      No hay manifiestos de {tipoOp} registrados
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Tabla ── */}
          {step === 2 && (
            <>
              {loadingBLs ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw size={24} className="animate-spin text-[#0F2A44]" />
                  <span className="ml-3 text-slate-500 text-sm">Cargando BLs...</span>
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-sm">No hay BLs para este manifiesto</div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

                  {/* Barra búsqueda + filtros */}
                  <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Buscar por BL, contenedor, cliente, nave, puerto..."
                        className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0F2A44]/20 bg-slate-50"
                      />
                      {tableSearch && (
                        <button onClick={() => setTableSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm leading-none">✕</button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { key: "todos", label: "Todos", count: rows.length },
                        { key: "con_contenedor", label: "Con contenedor", count: rows.filter(r => r.n_contenedor).length },
                        { key: "sin_contenedor", label: "Sin contenedor", count: rows.filter(r => !r.n_contenedor).length },
                      ].map(({ key, label, count }) => (
                        <button
                          key={key}
                          onClick={() => setTableFilter(key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tableFilter === key ? "bg-[#0F2A44] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                          {label}
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tableFilter === key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                            }`}>{count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 shrink-0">
                      {tableSearch || tableFilter !== "todos" ? (
                        <>
                          <span><strong className="text-slate-700">{filteredRows.length}</strong> de {rows.length} registros</span>
                          <button onClick={() => { setTableSearch(""); setTableFilter("todos"); }} className="text-[#0F2A44] hover:underline font-medium">Limpiar filtros</button>
                        </>
                      ) : (
                        <span><strong className="text-slate-700">{rows.length}</strong> registros</span>
                      )}
                    </div>
                  </div>

                  {/* Aviso IMO */}
                  <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                    <AlertCircle size={13} className="text-blue-400 shrink-0" />
                    <span className="text-[11px] text-blue-600">
                      Si el <strong>Lloyd / IMO</strong> de una nave no aparece o está incorrecto, puedes editarlo en{" "}
                      <a href="/mantenedores/naves" className="font-semibold underline hover:text-blue-800" target="_blank" rel="noreferrer">Mantenedores → Naves</a>
                    </span>
                  </div>
                  {/* Tabla */}
                  {filteredRows.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-sm">
                      <Search size={32} className="mx-auto mb-3 opacity-30" />
                      <p>No hay resultados para "<strong>{tableSearch}</strong>"</p>
                      <button onClick={() => { setTableSearch(""); setTableFilter("todos"); }} className="mt-2 text-xs text-[#0F2A44] hover:underline">Limpiar búsqueda</button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#0F2A44] text-white">
                            <th className="px-3 py-3 w-10"></th>
                            {COLUMNS.map((c) => (
                              <th key={c.key} className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                                {c.label}
                                {c.key === "deposito" && <span className="ml-1 text-yellow-300 text-[10px]">(manual)</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row, i) => {
                            const highlightCell = (text) => {
                              if (!tableSearch || !text) return text || "—";
                              const str = String(text);
                              const q = tableSearch.toLowerCase();
                              const idx = str.toLowerCase().indexOf(q);
                              if (idx === -1) return str;
                              return <>{str.slice(0, idx)}<mark className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{str.slice(idx, idx + q.length)}</mark>{str.slice(idx + q.length)}</>;
                            };

                            return (
                              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                <td className="px-3 py-2 border-b border-slate-100">
                                  <button
                                    onClick={() => handleExportSingleBL(row)}
                                    title={`Exportar Excel solo BL ${row.bl || i + 1}`}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  >
                                    <Download size={13} />
                                  </button>
                                </td>
                                {COLUMNS.map((c) => (
                                  <td key={c.key} className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                                    {c.key === "deposito" ? (
                                      <input
                                        value={row[c.key] ?? ""}
                                        onChange={(e) => {
                                          const realIdx = rows.findIndex(r => r.bl === row.bl && r.n_contenedor === row.n_contenedor);
                                          if (realIdx !== -1) handleCellEdit(realIdx, c.key, e.target.value);
                                        }}
                                        className="w-full min-w-[130px] bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-300"
                                        placeholder="Ingresa depósito..."
                                      />
                                    ) : c.key === "almacen" ? (
                                      <AlmacenSelect
                                        value={row[c.key] ?? ""}
                                        onChange={(val) => {
                                          const realIdx = rows.findIndex(r => r.bl === row.bl && r.n_contenedor === row.n_contenedor);
                                          if (realIdx !== -1) handleCellEdit(realIdx, c.key, val);
                                        }}
                                        onSave={() => {
                                          const realIdx = rows.findIndex(r => r.bl === row.bl && r.n_contenedor === row.n_contenedor);
                                          if (realIdx !== -1) handleCellEdit(realIdx, "almacen", row.almacen ?? "");
                                        }}
                                      />
                                    ) : (
                                      <span className="text-slate-700">{highlightCell(row[c.key])}</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {
        toast && (
          <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm text-white z-50 ${toast.type === "success" ? "bg-emerald-600"
            : toast.type === "warning" ? "bg-orange-500"
              : "bg-red-500"
            }`}>
            {toast.type === "success" ? <CheckCircle size={18} />
              : toast.type === "warning" ? <AlertCircle size={18} />
                : <AlertCircle size={18} />}
            {toast.msg}
          </div>
        )
      }
    </div >
  )
};
