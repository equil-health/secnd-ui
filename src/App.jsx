import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import DemoPage from './pages/medsecondopinion_ui';
import SubmitPage from './pages/SubmitPage';
import LandingPage from './pages/LandingPage';
import ResearchPage from './pages/ResearchPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/research" element={<ResearchPage />} />
      <Route path="/app" element={<HomePage />} />
      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/report/:id" element={<ReportPage />} />
      <Route path="/history" element={<HistoryPage />} />
    </Routes>
  );
}
