import { BrowserRouter, Routes, Route } from "react-router";
import { LandingPage } from "./components/LandingPage";
import { ARViewer } from "./components/ARViewer";
import { ModelsPage } from "./components/ModelsPage";
import { AdminLoginPage } from "./components/AdminLoginPage";
import { UserLoginPage } from "./components/UserLoginPage";
import { UserRegisterPage } from "./components/UserRegisterPage";
import { SceneViewer } from "./components/SceneViewer";
import { PrivacyPolicyPage } from "./components/PrivacyPolicyPage";
import  CheziousARMenu  from "./components/CheeziousMenu";
import RestaurantMenuPage from "./components/RestaurantMenuPage";
import { RestaurantListPage } from "./components/RestaurantListPage";
// import { TermsPage } from "./components/TermsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ar-viewer" element={<ARViewer />} />
        <Route path="/ar-view/:id" element={<SceneViewer />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/user-login" element={<UserLoginPage />} />
        <Route path="/user-register" element={<UserRegisterPage />} />
        <Route path= "/user-logout" element={<UserLoginPage />} />
        <Route path= "/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/menu/cheezious" element={<CheziousARMenu />} />
        <Route path="/restaurants" element={<RestaurantListPage />} />
        <Route path="/menu/:slug" element={<RestaurantMenuPage />} />

        {/* <Route path= "/terms" element={<TermsPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
}