import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logoBroom from "../img/SGA Logo Oscuro.png";
import Naviera from "../img/naviera.jpg";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      // Guardar token y usuario en localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));

      // Redirigir a manifiestos
      navigate("/Manifiestos");
    } catch (err) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F2A44] flex items-center justify-center px-6">
      {/* CONTENEDOR LOGIN */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">

        {/* ======================
            PANEL IZQUIERDO
           ====================== */}
        <div className="relative hidden lg:block">
          <img
            src={Naviera}
            alt="Imagen logística naviera"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Overlay azul */}
          <div className="absolute inset-0 bg-[#0F2A44]/70" />

          <div className="relative z-10 p-10 text-white flex flex-col justify-end h-full">
            <span className="text-xs opacity-70">
              © Broom Group · Uso interno
            </span>
          </div>
        </div>

        {/* ======================
            PANEL DERECHO
           ====================== */}
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

              <button
                type="button"
                className="text-[#0F2A44] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
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