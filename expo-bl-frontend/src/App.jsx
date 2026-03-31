import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Manifiestos from "./pages/Manifiestos";
import Mantenedores from "./pages/Mantenedores";
import NuevoManifiesto from "./pages/NuevoManifiesto";
import Expo from "./pages/ExpoBLDetail";
import ManifiestoDetalle from "./pages/ManifiestoDetalle";
import CRUDMantenedor from "./components/CRUDMantenedor";
import ProtectedRoute from "./components/ProtectedRoute";
import ExpoBL from "./pages/ExpoBL";
import ExpoBLDetail from "./pages/ExpoBLDetail";
import ExpoBLEdit from "./pages/ExpoBLEdit";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import GenerarXML from "./pages/GenerarXML";
import BulkEditBL from "./pages/BulkEditBL";
import CargaSueltaNuevo from "./pages/CargaSueltaNuevo";
import CargaSueltaEdit from "./pages/CargaSueltaEdit";
import Reportes from "./pages/Reportes";
import ParticipanteSelector from "./components/ParticipanteSelector";
import Usuarios from "./pages/Usuarios";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ============================================
            RUTAS PÚBLICAS (sin autenticación)
           ============================================ */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<Login />} /> {/* Google OAuth callback */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ============================================
            RUTAS PROTEGIDAS - MANIFIESTOS
           ============================================ */}
        <Route
          path="/manifiestos"
          element={
            <ProtectedRoute>
              <Manifiestos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manifiestos/nuevo"
          element={
            <ProtectedRoute>
              <NuevoManifiesto />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manifiestos/:id"
          element={
            <ProtectedRoute>
              <ManifiestoDetalle />
            </ProtectedRoute>
          }
        />

        {/* 🔥 RUTA DE GENERAR XML (debe ir ANTES de /manifiestos/:id para evitar conflictos) */}
        <Route
          path="/manifiestos/:id/generar-xml"
          element={
            <ProtectedRoute>
              <GenerarXML />
            </ProtectedRoute>
          }
        />

        {/* 🔥🔥 RUTA PARA CREAR NUEVA CARGA SUELTA */}
        <Route
          path="/manifiestos/:id/carga-suelta/nuevo"
          element={
            <ProtectedRoute>
              <CargaSueltaNuevo />
            </ProtectedRoute>
          }
        />

        {/* ============================================
            RUTAS PROTEGIDAS - EXPO BL
           ============================================ */}
        <Route
          path="/expo-bl"
          element={
            <ProtectedRoute>
              <ExpoBL />
            </ProtectedRoute>
          }
        />


        {/* 🔥 RUTA DE EDICIÓN MASIVA - Debe ir ANTES de /expo/:blNumber */}
        <Route
          path="/expo/bulk-edit"
          element={
            <ProtectedRoute>
              <BulkEditBL />
            </ProtectedRoute>
          }
        />

        {/* 🔥 RUTA DE EDICIÓN DE CARGA SUELTA - Debe ir ANTES de /expo/:blNumber */}
        <Route
          path="/expo/:blNumber/carga-suelta/edit"
          element={
            <ProtectedRoute>
              <CargaSueltaEdit />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expo/:blNumber"
          element={
            <ProtectedRoute>
              <Expo />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expo/detail/:blNumber"
          element={
            <ProtectedRoute>
              <ExpoBLDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expo/:blNumber/edit"
          element={
            <ProtectedRoute>
              <ExpoBLEdit />
            </ProtectedRoute>
          }
        />

        {/* ============================================
            RUTAS PROTEGIDAS - MANTENEDORES
           ============================================ */}
        <Route
          path="/mantenedores"
          element={
            <ProtectedRoute>
              <Mantenedores />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mantenedores/:tipo"
          element={
            <ProtectedRoute>
              <CRUDMantenedor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <Reportes />
            </ProtectedRoute>
          }
        />

        <Route path="/mantenedores/usuarios" element={<Usuarios />} />

        {/* ============================================
            RUTA 404 - Cualquier otra ruta no definida
           ============================================ */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;