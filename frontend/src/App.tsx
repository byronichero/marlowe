import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout'
import Home from './pages/home'
import KnowledgeBase from './pages/knowledge-base'
import Assessments from './pages/assessments'
import KnowledgeGraph from './pages/knowledge-graph'
import Reports from './pages/reports'
import StandardsLibrary from './pages/standards-library'
import TaxonomyAssessment from './pages/taxonomy-assessment'
import AiReadiness from './pages/ai-readiness'
import Taxonomy from './pages/taxonomy'
import Faq from './pages/faq'
import Help from './pages/help'
import Tutorial from './pages/tutorial'
import AboutMarlowe from './pages/about-marlowe'
import Admin from './pages/admin'
import AdminObservability from './pages/admin-observability'
import Login from './pages/login'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="knowledge-base" element={<KnowledgeBase />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="taxonomy" element={<Taxonomy />} />
        <Route path="ai-readiness" element={<AiReadiness />} />
        <Route path="taxonomy-assessment/:frameworkId" element={<TaxonomyAssessment />} />
        <Route path="standards-library" element={<StandardsLibrary />} />
        <Route path="knowledge-graph" element={<KnowledgeGraph />} />
        <Route path="reports" element={<Reports />} />
        <Route path="faq" element={<Faq />} />
        <Route path="help" element={<Help />} />
        <Route path="tutorial" element={<Tutorial />} />
        <Route path="about-marlowe" element={<AboutMarlowe />} />
        <Route path="admin" element={<Admin />} />
        <Route path="admin/observability" element={<AdminObservability />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App
