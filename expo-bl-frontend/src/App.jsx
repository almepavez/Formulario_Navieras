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

        {/* ============================================
            RUTA 404 - Cualquier otra ruta no definida
           ============================================ */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;