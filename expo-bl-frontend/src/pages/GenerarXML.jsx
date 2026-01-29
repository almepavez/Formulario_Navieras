import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { FileText, Download, Loader2, Search, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";

const GenerarXML = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bls, setBls] = useState([]);
  const [selectedBls, setSelectedBls] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(false);
  const [revalidando, setRevalidando] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent");
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);


  useEffect(() => {
    if (!id) {
      setError("ID de manifiesto no válido");
      setLoading(false);
      return;
    }

    fetchBLs();
    // 🆕 Recargar cuando la ventana recupera el foco (vuelves desde otra pestaña/ventana)
    const handleFocus = () => {
      console.log('🔄 Ventana recuperó el foco - Recargando BLs...');
      fetchBLs();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [id]);

  const fetchBLs = async () => {
  setLoading(true);
  setError("");

  try {
    const res = await fetch(`http://localhost:4000/api/manifiestos/${id}/bls-para-xml`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    
    console.log('📊 BLs cargados:', data.length);
    console.log('🔍 Estados de validación:', data.map(bl => ({
      bl: bl.bl_number,
      status: bl.valid_status,
      errores: bl.valid_count_error,
      obs: bl.valid_count_obs
    })));

    setBls(Array.isArray(data) ? data : []);
  } catch (e) {
    setError(e?.message || "Error al cargar BLs");
    setBls([]);
  } finally {
    setLoading(false);
  }
};

  // 🔍 Filtrado y búsqueda
  const filteredAndSortedBLs = useMemo(() => {
    let result = [...bls];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(bl =>
        bl.bl_number?.toLowerCase().includes(term) ||
        bl.shipper?.toLowerCase().includes(term) ||
        bl.consignee?.toLowerCase().includes(term)
      );
    }

    if (filterStatus !== "all") {
      result = result.filter(bl => bl.status === filterStatus);
    }

    if (showOnlyErrors) {
      // ✅ USAR DATOS DE LA BD
      result = result.filter(bl =>
        bl.valid_status === 'ERROR' || bl.valid_status === 'OBS'
      );
    }

    if (sortOrder === "recent") {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    return result;
  }, [bls, searchTerm, filterStatus, sortOrder, showOnlyErrors]);

  const toggleBL = (blNumber) => {
    setSelectedBls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blNumber)) {
        newSet.delete(blNumber);
      } else {
        newSet.add(blNumber);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedBls.size === filteredAndSortedBLs.length) {
      setSelectedBls(new Set());
    } else {
      setSelectedBls(new Set(filteredAndSortedBLs.map(bl => bl.bl_number)));
    }
  };


  // 🆕 FUNCIÓN DE REVALIDACIÓN MASIVA
  const revalidarBLsSeleccionados = async () => {
    if (selectedBls.size === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin BLs seleccionados',
        text: 'Debes seleccionar al menos un BL para revalidar',
        confirmButtonColor: '#0F2A44'
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'Revalidar BLs',
      html: `
      <p>Se revalidarán <strong>${selectedBls.size}</strong> BL(s).</p>
      <p class="text-sm text-slate-600 mt-2">
        Esto actualizará el estado de validación de cada BL 
        según los datos actuales del sistema.
      </p>
    `,
      showCancelButton: true,
      confirmButtonText: 'Sí, revalidar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280'
    });

    if (!result.isConfirmed) return;

    setRevalidando(true);

    try {
      const blNumbers = Array.from(selectedBls);
      let exitosos = 0;
      let fallidos = 0;
      const errores = [];

      Swal.fire({
        title: 'Revalidando BLs...',
        html: `
        <div class="mb-4">
          <div class="text-lg font-semibold">0 / ${blNumbers.length}</div>
          <div class="text-sm text-slate-600">Procesando...</div>
        </div>
      `,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      for (let i = 0; i < blNumbers.length; i++) {
        const blNumber = blNumbers[i];

        try {
          const res = await fetch(
            `http://localhost:4000/api/bls/${blNumber}/revalidar`,
            { method: 'POST' }
          );

          if (res.ok) {
            exitosos++;
          } else {
            fallidos++;
            const data = await res.json();
            errores.push({ blNumber, error: data.error || 'Error desconocido' });
          }
        } catch (e) {
          fallidos++;
          errores.push({ blNumber, error: e.message });
        }

        Swal.update({
          html: `
          <div class="mb-4">
            <div class="text-lg font-semibold">${i + 1} / ${blNumbers.length}</div>
            <div class="text-sm text-slate-600">
              ✓ ${exitosos} exitosos • ✗ ${fallidos} fallidos
            </div>
          </div>
        `
        });
      }

      await fetchBLs(); // Recargar datos

      if (fallidos === 0) {
        Swal.fire({
          icon: 'success',
          title: 'Revalidación completada',
          html: `
          <p class="text-lg mb-2">
            <strong>${exitosos}</strong> BL(s) revalidados correctamente
          </p>
        `,
          confirmButtonColor: '#10B981'
        });
      } else {
        const erroresHTML = errores
          .map(e => `
          <div class="text-left p-2 bg-red-50 rounded mb-2">
            <strong class="text-red-700">${e.blNumber}:</strong>
            <span class="text-red-600 text-sm"> ${e.error}</span>
          </div>
        `)
          .join('');

        Swal.fire({
          icon: 'warning',
          title: 'Revalidación completada con errores',
          html: `
          <div class="mb-4">
            <p class="mb-2">
              ✓ <strong class="text-green-600">${exitosos}</strong> exitosos •
              ✗ <strong class="text-red-600">${fallidos}</strong> fallidos
            </p>
          </div>
          <div class="max-h-60 overflow-y-auto text-left">
            ${erroresHTML}
          </div>
        `,
          confirmButtonColor: '#F59E0B',
          width: '600px'
        });
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error en la revalidación',
        text: e.message || 'Ocurrió un error inesperado',
        confirmButtonColor: '#DC2626'
      });
    } finally {
      setRevalidando(false);
    }
  };

  // 🔒 FUNCIÓN PRINCIPAL: Generar XMLs múltiples
  const generarXMLsMultiples = async () => {
    if (selectedBls.size === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin BLs seleccionados',
        text: 'Debes seleccionar al menos un BL para generar XMLs',
        confirmButtonColor: '#0F2A44'
      });
      return;
    }

    // 🔥 MOVER ESTA LÍNEA AQUÍ (línea ~298)
    const selectedBlsArray = Array.from(selectedBls);

    // ⚠️ VALIDAR BLs seleccionados
    const blsConErrores = bls.filter(bl =>
      selectedBlsArray.includes(bl.bl_number) &&
      bl.valid_status === 'ERROR'
    );

    // ... resto del código (SIN volver a declarar la función)
    // 🚫 SI HAY ERRORES CRÍTICOS, NO PERMITIR GENERAR
    if (blsConErrores.length > 0) {
      const erroresHTML = blsConErrores.map(bl =>
        `<div style="text-align: left; margin-bottom: 12px; padding: 12px; background: #FEE2E2; border-radius: 8px; border: 1px solid #FCA5A5;">
      <strong style="color: #DC2626; font-size: 14px;">${bl.bl_number}</strong><br/>
      <p style="margin: 8px 0; font-size: 13px; color: #991B1B;">
        ${bl.valid_count_error} error(es) crítico(s)
      </p>
      <p style="margin: 4px 0; font-size: 12px; color: #7C2D12;">
        Haz clic en "Preview" para ver el detalle de los errores
      </p>
    </div>`
      ).join('');

      await Swal.fire({
        icon: 'error',
        title: 'No se puede generar XML',
        html: `
      <div style="text-align: left; margin-bottom: 16px;">
        <p style="color: #DC2626; font-weight: 500; margin-bottom: 12px;">
          ${blsConErrores.length} BL${blsConErrores.length > 1 ? 's tienen' : ' tiene'} errores críticos:
        </p>
        <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
          ${erroresHTML}
        </div>
      </div>
      <div style="background: #FEF3C7; padding: 12px; border-radius: 8px; margin-top: 16px; border: 1px solid #FCD34D;">
        <p style="color: #92400E; font-size: 13px; margin: 0;">
          <strong>Solución:</strong> Edita los BLs con errores para completar los campos faltantes.
        </p>
      </div>
    `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#DC2626',
        width: '600px'
      });

      return;
    }
  

  // ⚠️ MOSTRAR ADVERTENCIAS (pero permitir continuar)
  const blsConWarnings = bls.filter(bl =>
    selectedBlsArray.includes(bl.bl_number) &&
    bl.valid_status === 'OBS'
  );

  if (blsConWarnings.length > 0) {
    const warningsHTML = blsConWarnings.map(item =>
      `<div style="text-align: left; margin-bottom: 10px;">
          <strong style="color: #F59E0B;">${item.blNumber}</strong><br/>
          <ul style="margin: 4px 0; padding-left: 20px; font-size: 13px; color: #92400E;">
            ${item.validation.warnings.map(w => `<li>${w}</li>`).join('')}
          </ul>
        </div>`
    ).join('');

    const result = await Swal.fire({
      icon: 'warning',
      title: 'BLs con advertencias',
      html: `
          <div style="max-height: 300px; overflow-y: auto; text-align: left;">
            ${warningsHTML}
          </div>
          <p style="margin-top: 16px; font-size: 14px;">
            Los XMLs se generarán pero pueden tener datos incompletos. ¿Deseas continuar?
          </p>
        `,
      showCancelButton: true,
      confirmButtonText: 'Sí, generar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#F59E0B',
      cancelButtonColor: '#6B7280'
    });

    if (!result.isConfirmed) return;
  }

  setGenerando(true);

  try {
    const res = await fetch(`http://localhost:4000/api/manifiestos/${id}/generar-xmls-multiples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blNumbers: selectedBlsArray })
    });


    // 🚫 MANEJAR ERROR DEL BACKEND
    if (!res.ok) {

      const data = await res.json();
      if (data.bls_con_errores) {
        const erroresHTML = data.bls_con_errores.map(item =>
          `<div style="text-align: left; margin-bottom: 10px; padding: 10px; background: #FEE2E2; border-radius: 6px;">
              <strong style="color: #DC2626;">${item.bl_number}</strong><br/>
              <ul style="margin: 4px 0; padding-left: 20px; font-size: 13px; color: #991B1B;">
                ${item.errors.map(e => `<li>${e}</li>`).join('')}
              </ul>
            </div>`
        ).join('');

        Swal.fire({
          icon: 'error',
          title: '🚫 Error de validación en el servidor',
          html: `
              <div style="max-height: 300px; overflow-y: auto;">
                ${erroresHTML}
              </div>
              <p style="margin-top: 16px; color: #DC2626; font-weight: 500;">
                Corrige estos errores antes de generar los XMLs.
              </p>
            `,
          confirmButtonColor: '#DC2626',
          width: '600px'
        });
        return;
      }

      throw new Error(data.error || "Error al generar XMLs");
    }

    // ✅ DESCARGA EXITOSA
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BLs_Manifiesto_${id}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    Swal.fire({
      icon: 'success',
      title: 'XMLs generados correctamente',
      text: `Se descargaron ${selectedBlsArray.length} XMLs en formato ZIP`,
      confirmButtonColor: '#10B981'
    });
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Error al generar XMLs',
      text: e?.message || 'Ocurrió un error inesperado',
      confirmButtonColor: '#DC2626'
    });
  } finally {
    setGenerando(false);
  }
};

// 🔍 FUNCIÓN: Mostrar vista previa del XML
// 🔥 REEMPLAZA TODA LA FUNCIÓN mostrarVistaPrevia por esta:
const mostrarVistaPrevia = async (blNumber) => {
  const bl = bls.find(b => b.bl_number === blNumber);

  // 🆕 Obtener validaciones reales de la BD
  let validacionesReales = [];

  if (bl.valid_status === 'ERROR' || bl.valid_status === 'OBS') {
    try {
      const res = await fetch(`http://localhost:4000/bls/${blNumber}/validaciones`);
      if (res.ok) {
        validacionesReales = await res.json();
      }
    } catch (e) {
      console.error('Error al cargar validaciones:', e);
    }
  }

  // Separar errores y observaciones
  const errores = validacionesReales.filter(v => v.severidad === 'ERROR');
  const observaciones = validacionesReales.filter(v => v.severidad === 'OBS');

  // 🚫 SI HAY ERRORES CRÍTICOS, MOSTRAR LOS REALES
  if (errores.length > 0) {
    const erroresHTML = errores.map(e => {
      let icono = '<span style="color: #DC2626;">●</span>';
      let prefijo = '';

      if (e.nivel === 'ITEM') {
        prefijo = `<strong style="color: #DC2626;">Item ${e.sec || ''}:</strong> `;
      } else if (e.nivel === 'CONTENEDOR') {
        prefijo = `<strong style="color: #DC2626;">Contenedor${e.sec ? ' ' + e.sec : ''}:</strong> `;
      } else if (e.nivel === 'TRANSBORDO') {
        prefijo = `<strong style="color: #DC2626;">Transbordo ${e.sec || ''}:</strong> `;
      } else if (e.nivel === 'BL') {
        prefijo = '<strong style="color: #DC2626;">BL:</strong> ';
      }

      return `<li style="margin: 6px 0; color: #991B1B;">${icono} ${prefijo}${e.mensaje}</li>`;
    }).join('');

    const obsHTML = observaciones.length > 0 ? `
      <div style="margin-top: 12px; background: #FEF3C7; padding: 12px; border-radius: 6px; border: 1px solid #FCD34D;">
        <strong style="color: #92400E;">Observaciones (${observaciones.length}):</strong>
        <ul style="margin: 4px 0; padding-left: 20px; font-size: 13px;">
          ${observaciones.map(o => `<li style="margin: 4px 0; color: #92400E;">${o.mensaje}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const result = await Swal.fire({
      icon: 'error',
      title: `BL ${blNumber} - Errores Críticos`,
      html: `
        <div style="text-align: left; background: #FEE2E2; padding: 16px; border-radius: 8px; border: 1px solid #FCA5A5;">
          <strong style="color: #DC2626;">No se puede generar el XML por los siguientes errores:</strong>
          <ul style="margin: 8px 0; padding-left: 20px;">
            ${erroresHTML}
          </ul>
        </div>
        ${obsHTML}
        <div style="background: #FEF3C7; padding: 12px; border-radius: 8px; margin-top: 16px; border: 1px solid #FCD34D;">
          <p style="color: #92400E; font-size: 13px; margin: 0;">
            <strong> Solución:</strong> Edita el BL para completar los campos faltantes.
          </p>
        </div>
      `,
      showDenyButton: true,
      confirmButtonText: 'Cerrar',
      denyButtonText: 'Editar BL',
      confirmButtonColor: '#DC2626',
      denyButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      width: '700px'
    });

    if (result.isDenied) {
      navigate(`/expo/${blNumber}/edit?returnTo=xml-preview&manifestId=${id}`);
    }

    return; // 🛑 NO GENERAR PREVIEW DEL XML
  }

  // ✅ SI NO HAY ERRORES CRÍTICOS, GENERAR PREVIEW
  Swal.fire({
    title: 'Generando vista previa...',
    text: 'Por favor espera',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const res = await fetch(`http://localhost:4000/api/bls/${blNumber}/generar-xml`, {
      method: "POST"
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Error al generar preview del XML");
    }

    const blob = await res.blob();
    const xmlText = await blob.text();

    // 🎨 Formatear XML con indentación correcta
    // 🎨 Formatear XML - Versión simple y efectiva
    // 🎨 Formatear y escapar XML para mostrar correctamente
    // 🎨 Formatear y escapar XML para mostrar correctamente
    const formatXML = (xml) => {
      // Agregar declaración si falta
      if (!xml.trim().startsWith('<?xml')) {
        xml = '<?xml version="1.0" encoding="ISO-8859-1"?>\n' + xml;
      }

      let formatted = '';
      let indent = 0;
      const INDENT = '  ';
      const regex = /(<\?[^?]+\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]+>|[^<]+)/g;
      const parts = xml.match(regex);

      if (!parts) return xml;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Declaración XML
        if (trimmed.startsWith('<?')) {
          formatted += trimmed + '\n';
        }
        // Comentarios
        else if (trimmed.startsWith('<!--')) {
          formatted += INDENT.repeat(indent) + trimmed + '\n';
        }
        // Tag de cierre
        else if (trimmed.startsWith('</')) {
          indent = Math.max(0, indent - 1);
          formatted += INDENT.repeat(indent) + trimmed + '\n';
        }
        // Tag auto-cerrado
        else if (trimmed.endsWith('/>')) {
          formatted += INDENT.repeat(indent) + trimmed + '\n';
        }
        // Tag de apertura
        else if (trimmed.startsWith('<')) {
          // Verificar si el siguiente elemento es contenido de texto
          const nextPart = parts[i + 1];
          const nextTrimmed = nextPart ? nextPart.trim() : '';
          const afterNext = parts[i + 2];
          const afterNextTrimmed = afterNext ? afterNext.trim() : '';

          // Si tiene texto seguido de un tag de cierre inmediato, es contenido inline
          if (nextTrimmed && !nextTrimmed.startsWith('<') && afterNextTrimmed.startsWith('</')) {
            formatted += INDENT.repeat(indent) + trimmed + nextTrimmed + afterNextTrimmed + '\n';
            i += 2; // Saltar los próximos 2 elementos porque ya los procesamos
          } else {
            // Es un elemento con hijos
            formatted += INDENT.repeat(indent) + trimmed + '\n';
            indent++;
          }
        }
      }

      return formatted;
    };

    // 🔒 Escapar HTML para que se muestren las etiquetas XML
    const escapeHTML = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const formattedXML = escapeHTML(formatXML(xmlText));

    const obsHTML = observaciones.length > 0 ? `
      <div style="margin-bottom: 16px; padding: 12px; background: #FEF3C7; border-radius: 8px; text-align: left;">
        <strong style="color: #F59E0B;">Observaciones (${observaciones.length}):</strong>
        <ul style="padding-left: 20px; margin: 4px 0; font-size: 13px;">
          ${observaciones.map(o => `<li style="color: #92400E;">${o.mensaje}</li>`).join('')}
        </ul>
        <div style="margin-top: 8px; color: #92400E; font-size: 12px;">
          Estas observaciones no impiden generar el XML, pero deberías revisarlas.
        </div>
      </div>
    ` : `
      <div style="margin-bottom: 16px; padding: 12px; background: #D1FAE5; border-radius: 8px; color: #065F46; text-align: left;">
        <strong>Sin problemas detectados</strong> - El XML está listo para ser generado.
      </div>
    `;

    const result = await Swal.fire({
      title: `Vista Previa XML - ${blNumber}`,
      html: `
        ${obsHTML}
        <div style="text-align: left;">
          <strong style="font-size: 14px;">Contenido del XML:</strong>
          <pre style="
            background: #1E293B; 
            color: #E2E8F0; 
            padding: 16px; 
            border-radius: 8px; 
            max-height: 400px; 
            overflow-y: auto; 
            text-align: left;
            font-size: 12px;
            line-height: 1.5;
            margin-top: 8px;
          ">${formattedXML}</pre>
        </div>
      `,
      width: '800px',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Descargar XML',
      denyButtonText: 'Editar BL',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#10B981',
      denyButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'swal-wide'
      }
    });

    if (result.isConfirmed) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BMS_V1_SNA-BL-1.0-${blNumber}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'XML descargado',
        text: `BL ${blNumber} descargado correctamente`,
        timer: 2000,
        showConfirmButton: false
      });
    } else if (result.isDenied) {
      navigate(`/expo/${blNumber}/edit?returnTo=xml-preview&manifestId=${id}`);
    }

  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Error al generar preview',
      text: e?.message || 'Ocurrió un error inesperado',
      confirmButtonColor: '#DC2626'
    });
  }
};

return (
  <div className="flex min-h-screen bg-slate-100">
    <Sidebar />

    <main className="flex-1 p-10">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(`/manifiestos`)}
          className="text-sm text-slate-600 hover:text-slate-900 mb-2"
        >
          ← Volver al manifiesto
        </button>

        <h1 className="text-2xl font-semibold text-[#0F2A44]">
          Generar XMLs - Manifiesto #{id}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Selecciona los BLs para generar sus XMLs
        </p>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando BLs...
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Acciones */}
      {!loading && bls.length > 0 && (
        <>
          {/* 🔍 Barra de búsqueda y filtros */}
          <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar BL, Shipper, Consignee..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los status</option>
                <option value="CREADO">CREADO</option>
                <option value="VALIDADO">VALIDADO</option>
                <option value="ENVIADO">ENVIADO</option>
                <option value="ANULADO">ANULADO</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="recent">Más recientes primero</option>
                <option value="oldest">Más antiguos primero</option>
              </select>

              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Solo con errores</span>
              </label>
            </div>

            <div className="mt-3 text-sm text-slate-600">
              Mostrando {filteredAndSortedBLs.length} de {bls.length} BLs
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              {selectedBls.size === filteredAndSortedBLs.length ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>

            {/* 🆕 BOTÓN DE REVALIDAR (AZUL) */}
            <button
              onClick={revalidarBLsSeleccionados}
              disabled={selectedBls.size === 0 || revalidando}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {revalidando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Revalidando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Revalidar {selectedBls.size} BL{selectedBls.size !== 1 ? "s" : ""}
                </>
              )}
            </button>

            {/* BOTÓN EXISTENTE DE GENERAR XML (VERDE) */}
            <button
              onClick={generarXMLsMultiples}
              disabled={selectedBls.size === 0 || generando}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generar {selectedBls.size} XML{selectedBls.size !== 1 ? "s" : ""} (ZIP)
                </>
              )}
            </button>

            <span className="text-sm text-slate-500">
              {selectedBls.size} de {filteredAndSortedBLs.length} seleccionados
            </span>
          </div>
        </>
      )}

      {/* Tabla de BLs */}
      {!loading && filteredAndSortedBLs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
          <div className="overflow-x-auto"></div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-6 py-3 font-semibold w-12">
                  <input
                    type="checkbox"
                    checked={selectedBls.size === filteredAndSortedBLs.length && filteredAndSortedBLs.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                </th>
                <th className="text-left px-6 py-3 font-semibold">Estado</th>
                <th className="text-left px-6 py-3 font-semibold">BL Number</th>
                <th className="text-left px-6 py-3 font-semibold">Shipper</th>
                <th className="text-left px-6 py-3 font-semibold">Consignee</th>
                <th className="text-left px-6 py-3 font-semibold">POL</th>
                <th className="text-left px-6 py-3 font-semibold">POD</th>
                <th className="text-left px-6 py-3 font-semibold">Bultos</th>
                <th className="text-left px-6 py-3 font-semibold">Peso (kg)</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th className="text-left px-6 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredAndSortedBLs.map((bl) => {
                const totalErrores = bl.valid_count_error || 0;
                const totalObs = bl.valid_count_obs || 0;
                const validStatus = bl.valid_status || 'OK';

                return (
                  <tr
                    key={bl.bl_number}
                    className="border-t hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 relative">
                      <input
                        type="checkbox"
                        checked={selectedBls.has(bl.bl_number)}
                        onChange={() => toggleBL(bl.bl_number)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                    </td>

                    <td className="px-6 py-4">
                      {validStatus === 'OK' && (
                        <div
                          className="flex items-center gap-1 text-emerald-600 cursor-help"
                          title="Sin problemas detectados"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}

                      {validStatus === 'OBS' && (
                        <div
                          className="flex items-center gap-2 text-amber-600 cursor-help group relative"
                          title={`${totalObs} observación(es)`}
                        >
                          <AlertTriangle className="w-5 h-5" />
                          <span className="text-xs font-medium">{totalObs}</span>

                          <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-[9999] w-72 bg-white rounded-lg shadow-xl border border-amber-200 p-3">
                            <div className="text-xs text-left">
                              <div className="font-semibold text-amber-700 mb-2">
                                Observaciones ({totalObs})
                              </div>
                              <div className="text-amber-600 text-xs">
                                Haz clic en "Preview" para ver el detalle completo
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {validStatus === 'ERROR' && (
                        <div
                          className="flex items-center gap-2 text-red-600 cursor-help group relative"
                          title={`${totalErrores} error(es) crítico(s)`}
                        >
                          <XCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">{totalErrores}</span>

                          <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-[9999] w-72 bg-white rounded-lg shadow-xl border border-red-200 p-3">
                            <div className="text-xs text-left">
                              <div className="font-semibold text-red-700 mb-2">
                                Errores críticos ({totalErrores})
                              </div>
                              {totalObs > 0 && (
                                <div className="font-semibold text-amber-600 mt-2">
                                  Observaciones ({totalObs})
                                </div>
                              )}
                              <div className="mt-2 pt-2 border-t border-red-100 text-red-600 font-medium text-xs">
                                No se puede generar XML
                              </div>
                              <div className="text-slate-600 text-xs mt-1">
                                Haz clic en "Preview" para ver el detalle completo
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 font-medium">{bl.bl_number}</td>
                    <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">
                      {bl.shipper || <span className="text-red-400">Sin Shipper</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">
                      {bl.consignee || <span className="text-red-400">Sin Consignee</span>}
                    </td>
                    <td className="px-6 py-4">
                      {bl.puerto_embarque || <span className="text-amber-500">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {bl.puerto_descarga || <span className="text-amber-500">—</span>}
                    </td>
                    <td className="px-6 py-4">{bl.bultos || 0}</td>
                    <td className="px-6 py-4">{bl.peso_bruto || 0}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">
                        {bl.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => mostrarVistaPrevia(bl.bl_number)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 flex items-center gap-1"
                        title="Vista previa del XML"
                      >
                        <FileText className="w-3 h-3" />
                        Preview
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mensajes cuando no hay resultados */}
      {!loading && bls.length > 0 && filteredAndSortedBLs.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No se encontraron BLs con los filtros aplicados
        </div>
      )}

      {!loading && bls.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No hay BLs en este manifiesto
        </div>
      )}
    </main>
  </div>
);
};

export default GenerarXML;        // Export