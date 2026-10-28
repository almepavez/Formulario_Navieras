import logoLoginFiestas from "../img/logo-login-fiestas-700.png";
import logoSidebarFiestas from "../img/logo-sidebar-fiestas-420.png";
import logoLoginHalloween from "../img/logo-login-halloween-700.png";
import logoSidebarHalloween from "../img/logo-sidebar-halloween-420.png";
import logoLoginHabitual from "../img/logo-sga-oscuro-420.png";
import logoSidebarHabitual from "../img/logo-sidebar-sga-420.png";

// ============================================================================
// Tema de temporada: cambia el logo del login, el del menú lateral y los
// colores del confeti que cae al entrar al sistema.
//
// Para cambiar de temporada se edita solo TEMA_ACTIVO. Con null todo vuelve a
// los logos habituales y deja de caer el confeti.
//
// Para agregar una temporada nueva: sumar una entrada en TEMAS con sus dos
// logos (login sobre fondo blanco, menú sobre el azul oscuro del Sidebar) y
// sus colores de confeti.
// ============================================================================
const TEMAS = {
  fiestasPatrias: {
    logoLogin: logoLoginFiestas,
    logoSidebar: logoSidebarFiestas,
    // Rojo, blanco y azul de la bandera chilena.
    coloresConfeti: ["#D52B1E", "#FFFFFF", "#0039A6"],
  },
  halloween: {
    logoLogin: logoLoginHalloween,
    logoSidebar: logoSidebarHalloween,
    // Naranjo corporativo de Broom, blanco y negro.
    coloresConfeti: ["#F4801A", "#FFFFFF", "#111111"],
  },
};

// Temporada vigente: "fiestasPatrias", "halloween" o null.
const TEMA_ACTIVO = "halloween";

const tema = TEMA_ACTIVO ? TEMAS[TEMA_ACTIVO] : null;

// Si alguien escribe mal el nombre, se avisa en consola en vez de quedar en
// silencio con los logos habituales.
if (TEMA_ACTIVO && !tema) {
  console.error(`estacional.js: el tema "${TEMA_ACTIVO}" no existe en TEMAS.`);
}

export const HAY_TEMA = Boolean(tema);

export const LOGO_LOGIN = tema?.logoLogin ?? logoLoginHabitual;

export const LOGO_SIDEBAR = tema?.logoSidebar ?? logoSidebarHabitual;

export const COLORES_CONFETI = tema?.coloresConfeti ?? [];

// Bandera de un solo uso: Login la deja al autenticar y el confeti la consume
// al montarse en Manifiestos. Va en sessionStorage porque el callback de
// Google recarga la página entera y cualquier estado en memoria se pierde.
export const CLAVE_CONFETI = "sga_confeti_login";
