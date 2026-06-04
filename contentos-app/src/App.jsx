import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ToastProvider, useAuth } from "./context";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Platforms from "./pages/Platforms";
import CreatePost from "./pages/CreatePost";
import CalendarPage from "./pages/CalendarPage";
import PostsList from "./pages/PostsList";
import MediaLibrary from "./pages/MediaLibrary";
import AiStudio from "./pages/AiStudio";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Public><Login /></Public>} />
            <Route path="/register" element={<Public><Register /></Public>} />
            <Route path="/" element={<Protected><Layout /></Protected>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="create" element={<CreatePost />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="posts" element={<PostsList />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="ai-studio" element={<AiStudio />} />
              <Route path="platforms" element={<Platforms />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
