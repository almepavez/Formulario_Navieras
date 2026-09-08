import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import logoFiestasPatrias from "../img/logo-login-fiestas-700.png";
import navieraWebp from "../img/naviera-login-1600.webp";
import navieraJpg from "../img/naviera-login-1600.jpg";

// Logo estacional de fiestas patrias. Después del 18 de septiembre basta con
// apuntar esta constante al logo habitual (../img/SGA Logo Oscuro.png).
const LOGO_LOGIN = logoFiestasPatrias;

const API_BASE = import.meta.env.VITE_API_URL;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Manejar callback de Google OAuth
  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (token) {
      // Guardar token y redirigir
      localStorage.setItem('token', token);

      // Obtener datos del usuario
      fetch(`${API_BASE}/api/auth/verificar`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            navigate('/manifiestos');
          }
        })
        .catch(() => {
          setError('Error al verificar sesión');
        });
    }

    if (errorParam === 'auth_failed') {
      setError('Error al autenticar con Google');
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));

      navigate("/manifiestos");
    } catch (err) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh w-full overflow-hidden bg-white grid grid-rows-[auto_1fr] lg:grid-rows-none lg:grid-cols-2">

      {/* ============ ZONA DE MARCA ============ */}
      <aside className="overflow-hidden bg-slate-50 border-b border-slate-200 lg:border-b-0 lg:border-r grid grid-rows-[auto] lg:grid-rows-[auto_1fr]">

        {/* LOGO */}
        <div className="flex justify-center px-6 pt-6 pb-4 lg:pt-12 lg:pb-8">
          <img
            src={LOGO_LOGIN}
            alt="SGA · Sistema de Gestión Aduanera"
            className="w-[200px] lg:w-[300px] h-auto"
          />
        </div>

        {/* La foto solo existe en desktop: en móvil la marca se reduce al logo */}
        <div className="hidden lg:block relative overflow-hidden">
          <picture>
            <source srcSet={navieraWebp} type="image/webp" />
            <img
              src={navieraJpg}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
        </div>
      </aside>

      {/* ============ ZONA DE FORMULARIO ============ */}
      <main className="flex flex-col overflow-y-auto bg-white">

        {/* my-auto centra el bloque sin recortarlo cuando la ventana es baja */}
        <div className="w-full max-w-[400px] mx-auto my-auto px-6 py-10">

          {/* TÍTULOS */}
          <h1 className="text-2xl font-semibold text-[#0F2A44]">
            Inicio de Sesión
          </h1>
          <p className="text-sm text-slate-500 mt-2 mb-8">
            Sistema de Gestión Aduanera
          </p>

          {/* MENSAJE DE ERROR */}
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          {/* BOTÓN GOOGLE */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full mb-6 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition flex items-center justify-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>

          {/* DIVISOR */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">O continúa con</span>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* EMAIL */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-slate-600 mb-1"
              >
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                placeholder="usuario@broomgroup.cl"
                required
                disabled={loading}
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-600 mb-1"
              >
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {/* RECUPERACIÓN */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-[#0F2A44] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* BOTÓN */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2A44] focus-visible:ring-offset-2"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>

          </form>
        </div>

        {/* PIE */}
        <footer className="shrink-0 px-6 pb-5 text-right">
          <span className="text-xs text-slate-400">
            © Broom Group · Uso interno
          </span>
        </footer>
      </main>
    </div>
  );
};

export default Login;