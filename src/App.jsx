import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import DemoPage from './pages/medsecondopinion_ui';
import SubmitPage from './pages/SubmitPage';
import LandingPage from './pages/LandingPage';
import ResearchPage from './pages/ResearchPage';
import PulsePage from './pages/PulsePage';
import BreakingPage from './pages/BreakingPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import SecondOpinionPage from './pages/SecondOpinionPage';
import SdssHistoryPage from './pages/SdssHistoryPage';
import SdssReportPage from './pages/SdssReportPage';
import ChatPage from './pages/ChatPage';
import SecondOpinionV2Page from './pages/SecondOpinionV2Page';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <LandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/demo"
        element={
          <ProtectedRoute>
            <DemoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/research"
        element={
          <ProtectedRoute>
            <ResearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pulse"
        element={
          <ProtectedRoute>
            <PulsePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/breaking"
        element={
          <ProtectedRoute>
            <BreakingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/second-opinion"
        element={
          <ProtectedRoute>
            <SecondOpinionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/second-opinion/history"
        element={
          <ProtectedRoute>
            <SdssHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/second-opinion/:taskId"
        element={
          <ProtectedRoute>
            <SdssReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/case"
        element={
          <ProtectedRoute>
            <SecondOpinionV2Page />
          </ProtectedRoute>
        }
      />
      <Route
        path="/case/:caseId"
        element={
          <ProtectedRoute>
            <SecondOpinionV2Page />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:taskId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/submit"
        element={
          <ProtectedRoute>
            <SubmitPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report/:id"
        element={
          <ProtectedRoute>
            <ReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
