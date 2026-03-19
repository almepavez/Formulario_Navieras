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

  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "00B0F0" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } },
  };

  COLUMNS.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellAddr]) return;
    ws[cellAddr].s = headerStyle;
  });

  ws["!rows"] = [{ hpt: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, filename);
}

const TATC_COLUMNS = [
  { key: "nave_codigo", label: "Nave" },
  { key: "viaje", label: "Viaje" },
  { key: "imo_nave", label: "Lloyd" },
  { key: "n_contenedor_tatc", label: "Nro Contenedor" },
  { key: "tipo_bulto", label: "Tipo Bulto" },
  { key: "tam_contenedor", label: "Tamaño Contenedor" },
  { key: "tipo_cnt_sna", label: "Tipo Contenedor" },
  { key: "cod_iso", label: "Código ISO Contenedor" },
  { key: "estado_cnt", label: "Estado Contenedor" },
  { key: "tara", label: "Tara Contenedor" },
  { key: "anio_fab", label: "Año Fabricación Contenedor" },
  { key: "pais_fab", label: "País Fabricación Contenedor" },
  { key: "estado_emb", label: "Estado Embarque" },
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
  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "F4801A" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } },
  };

  const wsData = [
    TATC_COLUMNS.map((c) => c.label),
    ...rowsToExport.map((r) => TATC_COLUMNS.map((c) => r[c.key] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = TATC_COLUMNS.map(() => ({ wch: 24 }));
  ws["!rows"] = [{ hpt: 22 }];

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

const TIPO_OP_MAP = { IMPO: "I", EXPO: "S" };

const AlmacenSelect = ({ value, onChange, onSave, todos = [] }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});
  
useEffect(() => {
  if (!open) return;

  const closeOnScroll = (e) => {
    // Si el scroll ocurre dentro del dropdown, ignorarlo
    if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
    setOpen(false);
    setQuery("");
  };

  window.addEventListener("scroll", closeOnScroll, true);
  return () => window.removeEventListener("scroll", closeOnScroll, true);
}, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Recalcular posición cuando abre o cuando hay scroll
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePos = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = 280;
      const viewportWidth = window.innerWidth;

      // Preferir alineado a la izquierda del trigger, pero si se sale del viewport, alinear a la derecha
      let left = rect.left;
      if (left + dropdownWidth > viewportWidth - 8) {
        left = rect.right - dropdownWidth;
      }
      if (left < 8) left = 8;

      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left,
        width: dropdownWidth,
        zIndex: 9999,
      });
    };

    updatePos();


  }, [open]);

  const found = todos.find(a =>
    a.codigo_tatc === value || a.nombre === value || a.codigo_almacen === value
  );
  const selectedLabel = found ? found.codigo_tatc : value || "";

  const filtrados = query.trim()
    ? todos.filter(a =>
      a.codigo_tatc?.toLowerCase().includes(query.toLowerCase()) ||
      a.nombre?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8)
    : todos.slice(0, 8);

  const handleSelect = (a) => {
    setOpen(false);
    setQuery("");
    onChange(a.codigo_tatc);
    onSave?.();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    onSave?.();
  };

  return (
    <div className="relative" ref={ref} style={{ width: "120px" }}>
      <div
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1 cursor-pointer hover:border-blue-400 transition-colors"
        style={{ width: "120px" }}
      >
        <span className="text-xs font-mono font-semibold text-blue-800 truncate">
          {selectedLabel || <span className="text-slate-400 font-normal font-sans">Seleccionar...</span>}
        </span>
        {selectedLabel
          ? <span onClick={handleClear} className="text-blue-300 hover:text-red-500 flex-shrink-0 text-[10px] cursor-pointer leading-none">✕</span>
          : <span className="text-slate-400 flex-shrink-0 text-[9px]">▼</span>
        }
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => { setOpen(false); setQuery(""); }} />
          <div
            ref={dropdownRef}
            className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
            style={dropdownStyle}
          >
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar TATC o nombre..."
                className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="max-h-52 overflow-y-auto flex flex-col">
              {filtrados.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                  {query ? `Sin resultados para "${query}"` : "Sin almacenistas con TATC"}
                </div>
              ) : filtrados.map(a => (
                <button key={a.id} type="button" onClick={() => handleSelect(a)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 flex-shrink-0">
                      {a.codigo_tatc}
                    </span>
                    <span className="text-xs text-slate-600 truncate">{a.nombre}</span>
                  </div>
                  {a.codigo_almacen && (
                    <p className="text-[10px] text-slate-400 mt-0.5">ALM: {a.codigo_almacen}</p>
                  )}
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-400">Solo almacenistas con código TATC</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

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
  const [almacenistasTatcList, setAlmacenistasTatcList] = useState([]);
  useEffect(() => {
    fetch(`${API_URL}/api/mantenedores/almacenistas/tatc`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setAlmacenistasTatcList(Array.isArray(data) ? data : []))
      .catch(() => setAlmacenistasTatcList([]));
  }, []);

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
        confirmButtonColor: "#F59E0B",
        cancelButtonColor: "#64748b",
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

    const esSoc = (r) => {
      const v = r.es_soc;
      if (v === null || v === undefined || v === 0 || v === "0" || v === false || v === "false" || v === "") return false;
      return true;
    };

    const rowsConSoc = rows.filter(r => esSoc(r));
    const rowsSinSoc = rows.filter(r => !esSoc(r));

    if (rowsSinSoc.length === 0) {
      await Swal.fire({
        title: "No hay contenedores para exportar",
        html: `<p style="color:#64748b; font-size:14px;">Todos los contenedores son SOC, no se puede generar la plantilla TATC.</p>`,
        icon: "error",
        confirmButtonColor: "#0F2A44",
        confirmButtonText: "Entendido",
      });
      return;
    }

    // Si hay SOC, avisar cuáles se omitirán pero continuar
    if (rowsConSoc.length > 0) {
      const lista = rowsConSoc
        .map(r => `<li style="color:#d97706; font-size:12px; margin-bottom:4px;">
        • <strong>${r.n_contenedor || "Sin N° contenedor"}</strong>
        ${r.bl ? `<span style="color:#94a3b8;"> — BL: ${r.bl}</span>` : ""}
      </li>`)
        .join("");

      const result = await Swal.fire({
        title: "Contenedores SOC serán omitidos",
        html: `
        <p style="color:#64748b; font-size:13px; margin-bottom:12px;">
          Los siguientes <strong>${rowsConSoc.length}</strong> contenedor(es) SOC 
          <u>no se incluirán</u> en la plantilla TATC:
        </p>
        <ul style="text-align:left; padding-left:10px; margin-bottom:12px; max-height:160px; overflow-y:auto; border:1px solid #fef3c7; border-radius:8px; padding:10px;">
          ${lista}
        </ul>
        <p style="color:#64748b; font-size:12px;">
          Se exportarán <strong>${rowsSinSoc.length}</strong> contenedor(es) sin SOC. ¿Continuar?
        </p>
      `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#F59E0B",
        cancelButtonColor: "#64748b",
        confirmButtonText: `Exportar ${rowsSinSoc.length} contenedor(es)`,
        cancelButtonText: "Cancelar",
        width: "500px",
      });
      if (!result.isConfirmed) return;
    }

    const nave = selectedInfo?.nombre_nave || selectedInfo?.nave || "nave";
    const viaje = selectedInfo?.viaje || "viaje";
    exportTATC(rowsSinSoc, `TATC_${nave}_${viaje}_${today()}.xlsx`);
    showToast("success", `Plantilla TATC exportada (${rowsSinSoc.length} contenedores)`);
  };

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
      console.log("BL raw data:", JSON.stringify(bls[0], null, 2));

      const depositosGuardados = resDepositos.ok ? await resDepositos.json() : [];

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
            es_soc: bl.es_soc ?? 0,
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
            es_soc: cnt.es_soc ?? bl.es_soc ?? 0,
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
    const row = latestRows.current[rowIdx];
    if (!row) return;
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/api/manifiestos/${selectedId}/depositos/bulk`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify([{
        bl: row.bl,
        n_contenedor: row.n_contenedor ?? "",
        deposito: row.deposito ?? "",
        almacen: row.almacen ?? "",
      }]),
    }).catch(() => {});
  }, 800);
};

const handleSaveAll = async () => {
  if (!selectedId || !latestRows.current.length) return;
  setSaving(true);
  try {
    const token = localStorage.getItem("token");
    const payload = latestRows.current.map((r) => ({
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

    if (!res.ok) throw new Error("Error del servidor");
    const data = await res.json();
    showToast("success", `${data.actualizadas} filas guardadas`);
  } catch {
    showToast("error", "Error al guardar");
  } finally {
    setSaving(false);
  }
};

  const checkEmptyColumns = async (rowsToCheck, columnsToCheck) => {
    const emptyLabels = columnsToCheck
      .filter(({ key }) => rowsToCheck.every((r) => !r[key]))
      .map(({ label }) => label);

    if (emptyLabels.length === 0) return true;

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

      let almacenistasTatc = [];
      try {
        const resTatc = await fetch(`${API_URL}/api/mantenedores/almacenistas/tatc`);
        if (resTatc.ok) almacenistasTatc = await resTatc.json();
      } catch { /* silencioso */ }

      const codigosInvalidos = [];
      Object.values(updates).forEach(upd => {
        if (!upd.almacen) return;
        const val = upd.almacen.trim();
        const existe = almacenistasTatc.some(a =>
          a.codigo_tatc?.toUpperCase() === val.toUpperCase()
        );
        if (!existe && !codigosInvalidos.includes(val)) {
          codigosInvalidos.push(val);
        }
      });

      if (codigosInvalidos.length > 0) {
        const validos = almacenistasTatc
          .map(a => ({ codigo: a.codigo_tatc, nombre: a.nombre }))
          .filter(a => a.codigo);

        const selectsHtml = codigosInvalidos.map(cod => `
          <div style="margin-bottom:12px; text-align:left;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="font-family:monospace; font-weight:700; font-size:13px; color:#dc2626; background:#fee2e2; padding:2px 8px; border-radius:5px; border:1px solid #fca5a5;">
                ${cod}
              </span>
              <span style="color:#94a3b8; font-size:12px;">→ reemplazar por:</span>
            </div>
            <div style="position:relative;">
              <input
                id="search-${cod}"
                type="text"
                placeholder="Buscar código válido..."
                autocomplete="off"
                style="width:100%; padding:7px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; outline:none; box-sizing:border-box;"
              />
              <div id="results-${cod}" style="display:none; background:white; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); max-height:140px; overflow-y:auto;"></div>
              <input type="hidden" id="selected-${cod}" value="" />
            </div>
          </div>
        `).join("");

        const swalResult = await Swal.fire({
          icon: "warning",
          title: "Códigos de Almacén no reconocidos",
          width: "560px",
          showCancelButton: true,
          confirmButtonText: "Importar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#F59E0B",
          cancelButtonColor: "#64748b",
          html: `
            <p style="color:#64748b; font-size:13px; margin-bottom:16px;">
              Los siguientes códigos no existen. Puedes buscar el correcto o dejarlos vacíos:
            </p>
            ${selectsHtml}
          `,
          didOpen: () => {
            codigosInvalidos.forEach(cod => {
              const input = document.getElementById(`search-${cod}`);
              const resultsDiv = document.getElementById(`results-${cod}`);
              const hidden = document.getElementById(`selected-${cod}`);

              document.body.appendChild(resultsDiv);
              resultsDiv.style.position = "fixed";
              resultsDiv.style.zIndex = "99999";

              const updatePos = () => {
                const rect = input.getBoundingClientRect();
                resultsDiv.style.top = rect.bottom + 2 + "px";
                resultsDiv.style.left = rect.left + "px";
                resultsDiv.style.width = rect.width + "px";
              };

              input.addEventListener("input", () => {
                const q = input.value.trim().toLowerCase();
                hidden.value = "";
                updatePos();

                if (!q) {
                  resultsDiv.style.display = "none";
                  resultsDiv.innerHTML = "";
                  return;
                }

                const filtrados = validos.filter(a =>
                  a.codigo.toLowerCase().includes(q) ||
                  a.nombre?.toLowerCase().includes(q)
                ).slice(0, 6);

                if (filtrados.length === 0) {
                  resultsDiv.style.display = "block";
                  resultsDiv.innerHTML = `<p style="padding:10px; text-align:center; color:#94a3b8; font-size:12px;">Sin resultados</p>`;
                  return;
                }

                resultsDiv.style.display = "block";
                resultsDiv.innerHTML = filtrados.map(a => `
                  <div
                    data-codigo="${a.codigo}"
                    data-nombre="${a.nombre}"
                    style="padding:8px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer; display:flex; align-items:center; gap:10px; background:white;"
                    onmouseover="this.style.background='#eff6ff'"
                    onmouseout="this.style.background='white'"
                  >
                    <span style="font-family:monospace; font-weight:700; font-size:13px; color:#1d4ed8; background:#dbeafe; padding:2px 8px; border-radius:5px; border:1px solid #bfdbfe; flex-shrink:0;">
                      ${a.codigo}
                    </span>
                    <span style="font-size:12px; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${a.nombre}
                    </span>
                  </div>
                `).join("");

                resultsDiv.querySelectorAll("div[data-codigo]").forEach(el => {
                  el.addEventListener("click", () => {
                    input.value = `${el.dataset.codigo} — ${el.dataset.nombre}`;
                    hidden.value = el.dataset.codigo;
                    resultsDiv.style.display = "none";
                  });
                });
              });

              document.addEventListener("click", (ev) => {
                if (!input.contains(ev.target) && !resultsDiv.contains(ev.target)) {
                  resultsDiv.style.display = "none";
                }
              });
            });
          },
          willClose: () => {
            codigosInvalidos.forEach(cod => {
              const el = document.getElementById(`results-${cod}`);
              if (el && el.parentNode === document.body) document.body.removeChild(el);
            });
          },
        });

        if (!swalResult.isConfirmed) return;

        // Aplicar correcciones
        codigosInvalidos.forEach(cod => {
          const hidden = document.getElementById(`selected-${cod}`);
          const correcto = hidden?.value?.trim();
          if (!correcto) return;
          Object.keys(updates).forEach(key => {
            if (updates[key].almacen?.toUpperCase() === cod.toUpperCase()) {
              updates[key].almacen = correcto;
            }
          });
        });
      }

      const resolveAlmacen = (val) => {
        if (!val) return "";
        const byTatc = almacenistasTatc.find(a =>
          a.codigo_tatc?.toUpperCase() === val.trim().toUpperCase()
        );
        return byTatc ? byTatc.codigo_tatc : "";
      };

      let actualizadas = 0;
      setRows((prev) =>
        prev.map((r) => {
          const upd = updates[`${String(r.bl ?? "").trim()}||${String(r.n_contenedor ?? "").trim()}`];
          if (!upd) return r;
          actualizadas++;
          return {
            ...r,
            ...upd,
            ...(upd.almacen ? { almacen: resolveAlmacen(upd.almacen) } : {}),
          };
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
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg"
              >
                <Download size={15} /> Plantilla TATC
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8">

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

                <div className="flex items-center gap-2 mb-5">
                  <span className="text-xs font-medium text-slate-500 mr-1">Tipo de operación:</span>
                  {["IMPO", "EXPO"].map((tipo) => {
                    const isExpo = tipo === "EXPO";
                    return (
                      <div key={tipo} className="relative group">
                        <button
                          disabled={isExpo}
                          onClick={() => { if (!isExpo) { setTipoOp(tipo); setComboSearch(""); setComboOpen(false); } }}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            isExpo
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                              : tipoOp === tipo
                                ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {tipo}
                          {isExpo && <span className="ml-1.5 text-[10px]"></span>}
                        </button>
                        {isExpo && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-relaxed shadow-xl">
                            Los reportes de contenedores solo aplican a importación
                          </div>
                        )}
                      </div>
                    );
                  })}
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

                  <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                    <AlertCircle size={13} className="text-blue-400 shrink-0" />
                    <span className="text-[11px] text-blue-600">
                      Si el <strong>Lloyd / IMO</strong> de una nave no aparece o está incorrecto, puedes editarlo en{" "}
                      <a href="/mantenedores/naves" className="font-semibold underline hover:text-blue-800" target="_blank" rel="noreferrer">Mantenedores → Naves</a>
                    </span>
                  </div>

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
                                        todos={almacenistasTatcList}
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

      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm text-white z-50 ${toast.type === "success" ? "bg-emerald-600"
          : toast.type === "warning" ? "bg-orange-500"
            : "bg-red-500"
          }`}>
          {toast.type === "success" ? <CheckCircle size={18} />
            : toast.type === "warning" ? <AlertCircle size={18} />
              : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}