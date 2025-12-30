import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Manifiestos from "./pages/Manifiestos";
import Mantenedores from "./pages/Mantenedores";
import NuevoManifiesto from "./pages/NuevoManifiesto";
import Expo from "./pages/Expo";
import ManifiestoDetalle from "./pages/ManifiestoDetalle";
import CRUDMantenedor from "./components/CRUDMantenedor";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz - redirige al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas */}
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
        
        <Route 
          path="/expo/:blNumber" 
          element={
            <ProtectedRoute>
              <Expo />
            </ProtectedRoute>
          } 
        />
        
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

        {/* Ruta 404 - cualquier otra ruta no definida */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;