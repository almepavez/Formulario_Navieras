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
import ExpoBLDetail from "./pages/ExpoBLDetail"; // Detalle
import ExpoBLEdit from "./pages/ExpoBLEdit";     // Edición

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
        
         
        {/* 👇 Nueva ruta para el listado de EXPO BL */}
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
 {/* Detalle de un BL específico */}
        <Route 
          path="/expo/detail/:blNumber" 
          element={
            <ProtectedRoute>
              <ExpoBLDetail />
            </ProtectedRoute>
          } 
        />
        
        {/* Edición de un BL específico */}
        <Route 
          path="/expo/:blNumber/edit" 
          element={
            <ProtectedRoute>
              <ExpoBLEdit />
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