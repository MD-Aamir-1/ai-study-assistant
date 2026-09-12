import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import TopicView from "./pages/TopicView";
import StudyPlan from "./pages/StudyPlan";
import Quiz from "./pages/Quiz";
import AITutor from "./pages/AITutor";
import Progress from "./pages/Progress";
import KnowledgeGaps from "./pages/KnowledgeGaps";
import Recommendations from "./pages/Recommendations";
import Settings from "./pages/Settings";

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/search" element={<Search />} />
                <Route path="/topic/:id" element={<TopicView />} />
                <Route path="/study-plan" element={<StudyPlan />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/gaps" element={<KnowledgeGaps />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/ai-tutor" element={<AITutor />} />
                <Route path="/settings" element={<Settings />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}