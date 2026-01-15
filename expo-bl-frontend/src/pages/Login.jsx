import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import logoBroom from "../img/SGA Logo Oscuro.png";
import Naviera from "../img/naviera.jpg";

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
      fetch('http://localhost:4000/api/auth/verificar', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            navigate('/Manifiestos');
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
      const response = await fetch("http://localhost:4000/api/auth/login", {
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

      navigate("/Manifiestos");
    } catch (err) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirigir a la ruta de Google OAuth en el backend
    window.location.href = 'http://localhost:4000/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#0F2A44] flex items-center justify-center px-6">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">

        {/* PANEL IZQUIERDO */}
        <div className="relative hidden lg:block">
          <img
            src={Naviera}
            alt="Imagen logística naviera"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-[#0F2A44]/70" />
          <div className="relative z-10 p-10 text-white flex flex-col justify-end h-full">
            <span className="text-xs opacity-70">
              © Broom Group · Uso interno
            </span>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="p-10 md:p-14 flex flex-col justify-center">

          {/* LOGO */}
          <div className="flex justify-center mb-6">
            <img
              src={logoBroom}
              alt="Broom Group"
              className="w-full max-w-[250px] h-auto object-contain"
            />
          </div>

          {/* TÍTULOS */}
          <h1 className="text-2xl font-semibold text-[#0F2A44] text-center">
            Inicio de Sesión
          </h1>
          <p className="text-sm text-slate-500 text-center mt-2 mb-8">
            Acceso a sistema · Generador XML BL
          </p>

          {/* MENSAJE DE ERROR */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* BOTÓN GOOGLE */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full mb-6 bg-white border-2 border-slate-200 text-slate-700 rounded-full py-3 font-medium hover:bg-slate-50 transition flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="usuario@broomgroup.cl"
                required
                disabled={loading}
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {/* OPCIONES */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-500">
                <input type="checkbox" className="rounded" />
                Recuérdame
              </label>

              <Link
                to="/forgot-password"
                className="text-[#0F2A44] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* BOTÓN */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F2A44] text-white rounded-full py-3 font-medium hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;