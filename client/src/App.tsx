import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout';
import { StudioLayout } from './layouts/StudioLayout';
import { LandingPage } from './pages/LandingPage';
import { FeaturesPage } from './pages/FeaturesPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { PricingPage } from './pages/PricingPage';
import { DocsPage } from './pages/DocsPage';
import { ProjectsPage } from './pages/ProjectsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Web Portal & Marketing Surface */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Route>

        {/* Authenticated Heavy Studio Workspace */}
        <Route path="/project/:projectId" element={<StudioLayout />} />
        <Route path="/project" element={<Navigate to="/project/default" replace />} />
        <Route path="/workspace" element={<Navigate to="/project/default" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
