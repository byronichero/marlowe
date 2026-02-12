import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout'
import Home from './pages/home'
import Dashboard from './pages/dashboard'
import KnowledgeBase from './pages/knowledge-base'
import Assessments from './pages/assessments'
import KnowledgeGraph from './pages/knowledge-graph'
import Reports from './pages/reports'
import FAQ from './pages/faq'
import Help from './pages/help'
import Login from './pages/login'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="knowledge-base" element={<KnowledgeBase />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="knowledge-graph" element={<KnowledgeGraph />} />
        <Route path="reports" element={<Reports />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="help" element={<Help />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App
