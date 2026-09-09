import logoLoginFiestas from "../img/logo-login-fiestas-700.png";
import logoLoginHabitual from "../img/logo-sga-oscuro-420.png";
import logoSidebarFiestas from "../img/logo-sidebar-fiestas-420.png";
import logoSidebarHabitual from "../img/logo-sidebar-sga-420.png";

// ============================================================================
// Fiestas patrias 2026 — efecto estacional, temporal por diseño.
//
// Se mantiene durante todo septiembre. Poner en false a principios de octubre:
// ese solo cambio revierte todo a la vez — el logo del login y el del menú
// vuelven a los habituales, y deja de caer el confeti al entrar al sistema.
//
// Para borrarlo del todo: eliminar este archivo junto con
// components/ConfetiFiestasPatrias.jsx, y devolver a Login.jsx y a Sidebar.jsx
// sus imports directos del logo.
// ============================================================================
export const FIESTAS_PATRIAS = true;

// Logo del login. Sigue a la constante de arriba.
export const LOGO_LOGIN = FIESTAS_PATRIAS ? logoLoginFiestas : logoLoginHabitual;

// Logo del menú lateral. La versión de fiestas patrias es la blanca, pensada
// para el fondo oscuro del Sidebar.
export const LOGO_SIDEBAR = FIESTAS_PATRIAS
  ? logoSidebarFiestas
  : logoSidebarHabitual;

// Bandera de un solo uso: Login la deja al autenticar y el confeti la consume
// al montarse en Manifiestos. Va en sessionStorage porque el callback de
// Google recarga la página entera y cualquier estado en memoria se pierde.
export const CLAVE_CONFETI = "sga_confeti_login";
