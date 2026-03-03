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
  { key: "nombre_nave", label: "Nave" },
  { key: "viaje", label: "Viaje" },
  { key: "codigo_nave", label: "Lloyd" },
  { key: "n_contenedor", label: "Nro Contenedor" },
  { key: "tipo_bulto", label: "Tipo Bulto" },
  { key: "tam_contenedor", label: "Tamaño Contenedor" },
  { key: "tipo_contenedor", label: "Tipo Contenedor" },
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
  TATC_COLUMNS.forEach((_, colIdx) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellAddr]) return;
    ws[cellAddr].s = headerStyle;
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
        const res = await fetch(`${API_URL}/manifiestos`, { headers: { Authorization: `Bearer ${token}` } });
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
        fetch(`${API_URL}/manifiestos/${manifiesto.id}/bls`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/manifiestos/${manifiesto.id}/depositos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const bls = await resBls.json();
      const depositosGuardados = resDepositos.ok ? await resDepositos.json() : [];

      // Índice para lookup O(1)
      const depositoMap = {};
      depositosGuardados.forEach((d) => {
        depositoMap[`${d.bl}||${d.n_contenedor ?? ""}`] = d;
      });

      const codigoNave = manifiesto.imo || "—";

      const mapped = bls.flatMap((bl) => {
        const contenedores = bl.contenedores ?? [];

        if (contenedores.length === 0) {
          const key = `${bl.bl_number || ""}||`;
          const saved = depositoMap[key] || {};
          return [{
            nombre_nave: manifiesto.nave || manifiesto.nombre_nave || "",
            codigo_nave: codigoNave || bl.codigo_nave || "",
            viaje: manifiesto.viaje || "",
            puerto_embarque: bl.puerto_embarque || "",
            puerto_desembarque: bl.puerto_descarga || "",
            bl: bl.bl_number || "",
            total_contenedores: 0,
            n_contenedor: "",
            tipo_contenedor: "",
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
            codigo_nave: codigoNave || bl.codigo_nave || "",
            viaje: manifiesto.viaje || "",
            puerto_embarque: bl.puerto_embarque || "",
            puerto_desembarque: bl.puerto_descarga || "",
            bl: bl.bl_number || "",
            total_contenedores: bl.total_contenedores ?? contenedores.length,
            n_contenedor: nCnt,
            tipo_contenedor: formatTipoCnt(cnt.tipo_cnt),
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
  const handleCellEdit = (rowIdx, key, value) => {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)));
    if (!selectedId) return;

    clearTimeout(autoSaveTimers.current[rowIdx]);
    autoSaveTimers.current[rowIdx] = setTimeout(async () => {
      // Leer fila actualizada del estado más reciente
      setRows((prev) => {
        const row = prev[rowIdx];
        if (!row) return prev;
        const token = localStorage.getItem("token");
        fetch(`${API_URL}/manifiestos/${selectedId}/depositos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            bl: row.bl,
            n_contenedor: row.n_contenedor ?? "",
            deposito: row.deposito ?? "",
            almacen: row.almacen ?? "",
          }),
        }).catch(() => { });
        return prev;
      });
    }, 800);
  };

  // ── Guardar todo de una vez ──
  const handleSaveAll = async () => {
    if (!selectedId || !rows.length) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = rows.map((r) => ({
        bl: r.bl,
        n_contenedor: r.n_contenedor ?? "",
        deposito: r.deposito ?? "",
        almacen: r.almacen ?? "",
      }));
      const res = await fetch(`${API_URL}/manifiestos/${selectedId}/depositos/bulk`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      showToast("success", `${data.actualizadas ?? rows.length} filas guardadas`);
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
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
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

        let actualizadas = 0;
        setRows((prev) =>
          prev.map((r) => {
            const upd = updates[`${String(r.bl ?? "").trim()}||${String(r.n_contenedor ?? "").trim()}`];
            if (!upd) return r;
            actualizadas++;
            return { ...r, ...upd };
          })
        );
        setTimeout(async () => {
          showToast("success", `${actualizadas} fila(s) actualizadas desde Excel · guardando...`);
          // Auto-guardar en BD inmediatamente después de importar el Excel
          if (selectedId) {
            try {
              const token = localStorage.getItem("token");
              // Leer el estado más reciente de rows via setRows
              setRows((prev) => {
                const payload = prev.map((r) => ({
                  bl: r.bl,
                  n_contenedor: r.n_contenedor ?? "",
                  deposito: r.deposito ?? "",
                  almacen: r.almacen ?? "",
                }));
                fetch(`${API_URL}/manifiestos/${selectedId}/depositos/bulk`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify(payload),
                })
                  .then(() => showToast("success", `${actualizadas} fila(s) guardadas correctamente`))
                  .catch(() => showToast("error", "Error al guardar en BD — usa el botón 'Guardar todo'"));
                return prev;
              });
            } catch {
              showToast("error", "Error al guardar — usa el botón 'Guardar todo'");
            }
          }
        }, 100);
      } catch {
        showToast("error", "No se pudo leer el archivo");
      }
    };
    reader.readAsBinaryString(file);
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
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm rounded-lg opacity-50 cursor-not-allowed"
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
                                      <input
                                        value={row[c.key] ?? ""}
                                        onChange={(e) => {
                                          const realIdx = rows.findIndex(r => r.bl === row.bl && r.n_contenedor === row.n_contenedor);
                                          if (realIdx !== -1) handleCellEdit(realIdx, c.key, e.target.value);
                                        }}
                                        className="w-full min-w-[130px] bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        placeholder="Almacén..."
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
