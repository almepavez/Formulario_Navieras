import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const MainLayout = () => {
  return (
    <div className="flex min-h-screen bg-[#0F2A44]">
      <Sidebar />
      <main className="flex-1 p-6 bg-slate-100">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
