import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logoBroom from "../img/SGA Logo Oscuro.png";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:4000/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el código");
      }

      setSuccess(true);
      
      // Redirigir pasando el email como parámetro
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);

    } catch (err) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F2A44] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">
        
        <div className="flex justify-center mb-6">
          <img
            src={logoBroom}
            alt="Broom Group"
            className="w-full max-w-[200px] h-auto object-contain"
          />
        </div>

        <h1 className="text-2xl font-semibold text-[#0F2A44] text-center mb-2">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-sm text-slate-500 text-center mb-8">
          Ingresa tu email y te enviaremos un código de recuperación
        </p>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✓ Código enviado a tu email. Redirigiendo...
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="tu@broomgroup.cl"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F2A44] text-white rounded-full py-3 font-medium hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando código..." : "Enviar código"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link 
            to="/login" 
            className="text-sm text-[#0F2A44] hover:underline"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;