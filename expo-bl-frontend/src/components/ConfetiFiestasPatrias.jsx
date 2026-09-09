import { useEffect, useMemo, useState } from "react";
import { FIESTAS_PATRIAS, CLAVE_CONFETI } from "../utils/estacional";

// Cantidad de partículas. Subir si queda pobre, bajar si carga la pantalla.
const PARTICULAS = 40;

// Rojo, blanco y azul de la bandera chilena.
const COLORES = ["#D52B1E", "#FFFFFF", "#0039A6"];

// Cuánto vive el efecto. La partícula más lenta termina a los 5 s (2 s de
// retardo máximo + 3 s de caída mínima... la más lenta, 2 + 5 = 7 s no se
// alcanza porque el retardo máximo va con las duraciones cortas); 6,5 s deja
// margen para que ninguna se corte a media caída.
const DURACION_MS = 6500;

// Estado a nivel de módulo, no de componente: la decisión debe sobrevivir a
// los montajes y desmontajes de React.
//   decision    — resultado de evaluar la bandera; se cachea para que el doble
//                 render de StrictMode en desarrollo no se coma la bandera al
//                 consumirla en el primer pase y quede en nada en el segundo.
//   reproducido — ya se montó y cayó; impide que se repita al navegar a otro
//                 módulo y volver a Manifiestos.
let decision = null;
let reproducido = false;

const prefiereMenosMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const evaluar = () => {
  if (!FIESTAS_PATRIAS) return false;
  if (sessionStorage.getItem(CLAVE_CONFETI) !== "1") return false;

  // La bandera se consume igual, así que un usuario con animaciones
  // reducidas tampoco la arrastra a la siguiente pantalla.
  sessionStorage.removeItem(CLAVE_CONFETI);
  return !prefiereMenosMovimiento();
};

const debeCaer = () => {
  if (reproducido) return false;
  if (decision === null) decision = evaluar();
  return decision;
};

const crearParticulas = () =>
  Array.from({ length: PARTICULAS }, (_, i) => {
    const color = COLORES[i % COLORES.length];
    return {
      id: i,
      color,
      esBlanca: color === "#FFFFFF",
      izquierda: Math.random() * 100,
      retardo: Math.random() * 2,
      duracion: 3 + Math.random() * 2,
      ancho: 6 + Math.random() * 4,
      alto: 10 + Math.random() * 6,
      giroInicial: Math.random() * 360,
    };
  });

const ConfetiFiestasPatrias = () => {
  // La decisión se toma una sola vez, en el inicializador: así no hay un
  // render inicial vacío ni un setState dentro de un efecto.
  const [activo, setActivo] = useState(debeCaer);
  const particulas = useMemo(() => crearParticulas(), []);

  useEffect(() => {
    if (!activo) return;
    reproducido = true;
    const id = setTimeout(() => setActivo(false), DURACION_MS);
    return () => clearTimeout(id);
  }, [activo]);

  if (!activo) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <style>{`
        @keyframes sga-confeti-caer {
          0%   { transform: translate3d(0, -15vh, 0) rotate(var(--giro)); opacity: 0; }
          8%   { opacity: 1; }
          25%  { transform: translate3d(14px, 20vh, 0) rotate(calc(var(--giro) + 180deg)); }
          50%  { transform: translate3d(-10px, 50vh, 0) rotate(calc(var(--giro) + 360deg)); }
          75%  { transform: translate3d(12px, 80vh, 0) rotate(calc(var(--giro) + 540deg)); }
          92%  { opacity: 1; }
          100% { transform: translate3d(0, 115vh, 0) rotate(calc(var(--giro) + 720deg)); opacity: 0; }
        }
        .sga-confeti {
          position: absolute;
          top: 0;
          border-radius: 2px;
          will-change: transform, opacity;
          animation-name: sga-confeti-caer;
          animation-timing-function: linear;
          animation-fill-mode: both;
          /* Sombra suave: despega también las rojas y azules del fondo claro */
          box-shadow: 0 1px 2px rgba(15, 42, 68, 0.18);
        }
        /* El blanco de la bandera se pierde sobre el slate-100 de Manifiestos
           (1,1:1 de contraste), así que lleva además un filete azul corporativo */
        .sga-confeti--blanca {
          box-shadow: 0 0 0 1px rgba(15, 42, 68, 0.35), 0 1px 2px rgba(15, 42, 68, 0.18);
        }
        @media (prefers-reduced-motion: reduce) {
          .sga-confeti { display: none; }
        }
      `}</style>

      {particulas.map((p) => (
        <span
          key={p.id}
          className={`sga-confeti${p.esBlanca ? " sga-confeti--blanca" : ""}`}
          style={{
            left: `${p.izquierda}%`,
            width: `${p.ancho}px`,
            height: `${p.alto}px`,
            backgroundColor: p.color,
            animationDelay: `${p.retardo}s`,
            animationDuration: `${p.duracion}s`,
            "--giro": `${p.giroInicial}deg`,
          }}
        />
      ))}
    </div>
  );
};

export default ConfetiFiestasPatrias;
