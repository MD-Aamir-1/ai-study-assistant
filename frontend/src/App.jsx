import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StudyPlan from "./pages/StudyPlan";
import Quiz from "./pages/Quiz";
import AITutor from "./pages/AITutor";
import MySubjects from "./pages/MySubjects";
import MyTopics from "./pages/MyTopics";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public: Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* Protected app shell */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/subjects" element={<MySubjects />} />
                <Route path="/topics" element={<MyTopics />} />
                <Route path="/study-plan" element={<StudyPlan />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/ai-tutor" element={<AITutor />} />
                <Route path="/settings" element={<Settings />} />

                {/* Catch-all: any unknown URL → Dashboard */}
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