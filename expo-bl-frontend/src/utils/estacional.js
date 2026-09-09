import logoFiestasPatrias from "../img/logo-login-fiestas-700.png";
import logoHabitual from "../img/SGA Logo Oscuro.png";

// ============================================================================
// Fiestas patrias 2026 — efecto estacional, temporal por diseño.
//
// Se mantiene durante todo septiembre. Poner en false a principios de octubre:
// ese solo cambio apaga las dos cosas a la vez, el logo del login vuelve al
// habitual y deja de caer el confeti al entrar al sistema.
//
// Para borrarlo del todo: eliminar este archivo junto con
// components/ConfetiFiestasPatrias.jsx, y devolver a Login.jsx su import
// directo del logo.
// ============================================================================
export const FIESTAS_PATRIAS = true;

// Logo que muestra el login. Sigue a la constante de arriba.
export const LOGO_LOGIN = FIESTAS_PATRIAS ? logoFiestasPatrias : logoHabitual;

// Bandera de un solo uso: Login la deja al autenticar y el confeti la consume
// al montarse en Manifiestos. Va en sessionStorage porque el callback de
// Google recarga la página entera y cualquier estado en memoria se pierde.
export const CLAVE_CONFETI = "sga_confeti_login";
