import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoBroom from "../img/SGA Logo Oscuro.png";
import { useSearchParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;

const ResetPassword = () => {
  const navigate = useNavigate();
  
  // Estados
const [searchParams] = useSearchParams();
const emailFromUrl = searchParams.get("email") || "";

const [step, setStep] = useState(emailFromUrl ? 2 : 1); // Si viene email, va directo al paso 2
const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // PASO 1: Enviar código
  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar código");
      }

      setSuccess("📧 Código enviado. Revisa tu correo electrónico.");
      setTimeout(() => {
        setStep(2);
        setSuccess("");
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // PASO 2: Verificar código
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // ✅ VALIDAR QUE HAYA EMAIL Y CÓDIGO
    if (!email || !code) {
      setError("Debes ingresar el código recibido");
      setLoading(false);
      return;
    }

    try {
      console.log('Enviando:', { email, code }); // Debug

      const response = await fetch(`${API_BASE}/api/auth/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Código inválido");
      }

      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // PASO 3: Restablecer contraseña
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validaciones
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al restablecer contraseña");
      }

      setSuccess("✓ Contraseña actualizada. Redirigiendo...");
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F2A44] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">
        
        {/* LOGO */}
        <div className="flex justify-center mb-6">
          <img
            src={logoBroom}
            alt="Broom Group"
            className="w-full max-w-[200px] h-auto object-contain"
          />
        </div>

        {/* TÍTULO */}
        <h1 className="text-2xl font-semibold text-[#0F2A44] text-center mb-2">
          Recuperar Contraseña
        </h1>
        
        {/* INDICADOR DE PASO */}
        <div className="flex justify-center gap-2 mb-6">
          <div className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-[#0F2A44]' : 'bg-gray-300'}`} />
          <div className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-[#0F2A44]' : 'bg-gray-300'}`} />
          <div className={`h-2 w-2 rounded-full ${step >= 3 ? 'bg-[#0F2A44]' : 'bg-gray-300'}`} />
        </div>

        {/* MENSAJES */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* PASO 1: INGRESAR EMAIL */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="space-y-6">
            <p className="text-sm text-slate-500 text-center mb-4">
              Ingresa tu correo electrónico y te enviaremos un código de verificación
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="usuario@broomgroup.com"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F2A44] text-white rounded-full py-3 font-medium hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar Código"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-[#0F2A44] hover:underline"
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}

        {/* PASO 2: INGRESAR CÓDIGO */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <p className="text-sm text-slate-500 text-center mb-4">
              Ingresa el código de 6 dígitos que enviamos a <strong>{email}</strong>
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Código de verificación
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm text-center text-2xl font-bold tracking-widest focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="000000"
                maxLength="6"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-[#0F2A44] text-white rounded-full py-3 font-medium hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Verificar Código"}
            </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-slate-500 hover:text-[#0F2A44]"
              >
                ← Cambiar correo
              </button>
              <br />
              <button
                type="button"
                onClick={handleSendCode}
                className="text-sm text-[#0F2A44] hover:underline"
                disabled={loading}
              >
                Reenviar código
              </button>
            </div>
          </form>
        )}

        {/* PASO 3: NUEVA CONTRASEÑA */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <p className="text-sm text-slate-500 text-center mb-4">
              Ingresa tu nueva contraseña
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="Mínimo 6 caracteres"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-[#0F2A44] focus:outline-none"
                placeholder="Repite la contraseña"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0F2A44] text-white rounded-full py-3 font-medium hover:opacity-95 transition disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Restablecer Contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;