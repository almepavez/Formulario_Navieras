import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_URL;

// El rol sale de localStorage, la misma fuente que ya usa el Sidebar. Ocultar
// el botón es solo cosmético: la restricción real vive en el backend, con
// verificarToken + soloAdmin. Si la sesión quedó desactualizada y el botón se
// muestra igual, el endpoint responde 403 y eliminarEntidad() lo explica.
export function esAdmin() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}")?.rol === "admin";
  } catch {
    return false;
  }
}

// Los modales se arman con HTML, y los identificadores salen de la base. Se
// exporta para que las páginas escapen lo que interpolan en `descripcionHtml`.
export const escaparHtml = (txt) =>
  String(txt ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

const escapar = escaparHtml;

// Traduce el objeto `eliminados` de la respuesta a una línea legible. Se
// omiten los conteos en cero para que el mensaje no sea una lista de nadas.
const ETIQUETAS = {
  bls: ["BL", "BLs"],
  items: ["item", "items"],
  contenedores: ["contenedor", "contenedores"],
  transbordos: ["transbordo", "transbordos"],
  validaciones: ["validación", "validaciones"],
  validaciones_pms: ["validación PMS", "validaciones PMS"],
  sellos: ["sello", "sellos"],
  imo: ["dato IMO", "datos IMO"],
  itinerarios: ["itinerario", "itinerarios"],
  reportes: ["fila de reportes", "filas de reportes"],
};

function resumirEliminados(eliminados) {
  if (!eliminados) return "";
  return Object.entries(eliminados)
    .filter(([clave, valor]) => ETIQUETAS[clave] && Number(valor) > 0)
    .map(([clave, valor]) => {
      const [singular, plural] = ETIQUETAS[clave];
      return `${valor} ${Number(valor) === 1 ? singular : plural}`;
    })
    .join(", ");
}

/**
 * Flujo de eliminación física en dos pasos: advertencia con el detalle de lo
 * que se va a borrar, y confirmación escribiendo el identificador exacto.
 *
 * Devuelve `{ eliminado: true, eliminados }` si el borrado se concretó, o
 * `{ eliminado: false }` si el usuario canceló o hubo error (el error ya se
 * le mostró).
 *
 * @param {string} url            ruta relativa del endpoint, ej. "/api/bls/ABC123"
 * @param {string} titulo         título del modal de advertencia
 * @param {string} descripcionHtml  qué se va a eliminar, en HTML ya escapado
 * @param {string} tokenEsperado  texto exacto que el usuario debe escribir
 * @param {string} etiquetaToken  cómo se llama ese texto, ej. "el número de BL"
 */
export async function eliminarEntidad({ url, titulo, descripcionHtml, tokenEsperado, etiquetaToken }) {
  // ── Paso 1: advertencia ──
  const aviso = await Swal.fire({
    title: titulo,
    icon: "warning",
    html: `
      <div style="text-align:left; font-size:13px; color:#334155; display:grid; gap:12px;">
        ${descripcionHtml}
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px 14px;">
          <p style="font-weight:700; color:#991b1b; margin-bottom:4px;">Esta acción es irreversible</p>
          <p style="color:#7f1d1d; font-size:12px; line-height:1.5;">
            La eliminación es definitiva: no hay papelera ni forma de deshacerla desde el sistema.
            Queda registrada en la auditoría con tu usuario.
          </p>
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: "Continuar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    width: "600px",
  });
  if (!aviso.isConfirmed) return { eliminado: false };

  // ── Paso 2: confirmación escrita ──
  const confirmacion = await Swal.fire({
    title: "Confirma la eliminación",
    html: `
      <div style="text-align:left; font-size:13px; color:#334155;">
        <p style="margin-bottom:4px;">
          Escribe ${escapar(etiquetaToken)} para habilitar el botón:
        </p>
        <p style="font-family:monospace; font-size:15px; font-weight:700; color:#0F2A44; margin-bottom:10px;">
          ${escapar(tokenEsperado)}
        </p>
        <input id="swal-confirmacion" class="swal2-input" style="margin:0 0 12px; width:100%;"
               placeholder="${escapar(tokenEsperado)}" autocomplete="off"
               autocapitalize="off" spellcheck="false">
        <textarea id="swal-motivo" class="swal2-textarea" style="margin:0; width:100%;"
                  placeholder="Motivo (opcional)" maxlength="1000"></textarea>
      </div>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Eliminar definitivamente",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    // El botón arranca deshabilitado y solo se habilita cuando lo escrito
    // calza exacto: es la última barrera antes de un borrado sin vuelta atrás.
    didOpen: () => {
      const input = document.getElementById("swal-confirmacion");
      const boton = Swal.getConfirmButton();
      const sincronizar = () => {
        boton.disabled = input.value.trim() !== tokenEsperado;
      };
      sincronizar();
      input.addEventListener("input", sincronizar);
      input.focus();
    },
    preConfirm: () => ({
      confirmacion: document.getElementById("swal-confirmacion")?.value.trim() || "",
      motivo: document.getElementById("swal-motivo")?.value.trim() || "",
    }),
  });
  if (!confirmacion.isConfirmed) return { eliminado: false };

  // ── Llamada ──
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}${url}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(confirmacion.value),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // El 403 puede llegar aunque el botón se haya mostrado: el rol se leyó de
      // localStorage, que puede haber quedado desactualizado respecto del token.
      const mensajes = {
        401: "Tu sesión expiró o no es válida. Vuelve a iniciar sesión e inténtalo de nuevo.",
        403: "No tienes permisos para eliminar. Esta acción está restringida a administradores.",
      };
      throw new Error(mensajes[res.status] || data.error || `HTTP ${res.status}`);
    }

    const resumen = resumirEliminados(data.eliminados);
    await Swal.fire({
      title: "Eliminado",
      text: resumen ? `Se eliminó junto con ${resumen}.` : undefined,
      icon: "success",
      timer: 2500,
      showConfirmButton: false,
      timerProgressBar: true,
    });
    return { eliminado: true, eliminados: data.eliminados };
  } catch (e) {
    await Swal.fire({
      title: "No se pudo eliminar",
      text: e?.message || "Error inesperado",
      icon: "error",
      confirmButtonColor: "#0F2A44",
    });
    return { eliminado: false };
  }
}
