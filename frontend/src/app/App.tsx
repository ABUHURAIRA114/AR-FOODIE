import { BrowserRouter, Routes, Route } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { ARViewer } from "./components/ARViewer";
import { ModelsPage } from "./components/ModelsPage";
import { AdminLoginPage } from "./components/AdminLoginPage";
import { UserLoginPage } from "./components/UserLoginPage";
import { UserRegisterPage } from "./components/UserRegisterPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ar-viewer" element={<ARViewer />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/user-login" element={<UserLoginPage />} />
        <Route path="/user-register" element={<UserRegisterPage />} />
        <Route path= "/user-logout" element={<UserLoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}
