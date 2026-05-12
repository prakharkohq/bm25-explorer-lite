import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import QueryPlayground from './pages/QueryPlayground'
import ScoringLab from './pages/ScoringLab'
import AnalysisLab from './pages/AnalysisLab'
import PerformanceDashboard from './pages/PerformanceDashboard'
import AutocompleteLab from './pages/AutocompleteLab'
import RelevanceEval from './pages/RelevanceEval'
import { PRODUCTS } from './data/products'

const NAV_ITEMS = [
  { to: '/', label: 'Query Types', icon: '⚡' },
  { to: '/scoring', label: 'BM25 Lab', icon: '📊' },
  { to: '/analysis', label: 'Analyzers', icon: '🔬' },
  { to: '/performance', label: 'Performance', icon: '⏱' },
  { to: '/autocomplete', label: 'Autocomplete', icon: '✨' },
  { to: '/relevance', label: 'Relevance Eval', icon: '🎯' },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🔍</span>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">BM25 Explorer</h1>
              <p className="text-xs text-gray-400">Elasticsearch Lexical Search — {PRODUCTS.length} products indexed</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? 'tab-active' : 'tab-inactive'
                  }`
                }
              >
                <span>{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <a
            href="https://github.com/prakharkohq/bm25-explorer-lite"
            className="ml-auto shrink-0 text-gray-400 hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<QueryPlayground />} />
          <Route path="/scoring" element={<ScoringLab />} />
          <Route path="/analysis" element={<AnalysisLab />} />
          <Route path="/performance" element={<PerformanceDashboard />} />
          <Route path="/autocomplete" element={<AutocompleteLab />} />
          <Route path="/relevance" element={<RelevanceEval />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-800 py-3 text-center text-xs text-gray-600">
        BM25 Explorer — All search runs in your browser. No server required. &nbsp;·&nbsp; {PRODUCTS.length} products &nbsp;·&nbsp; Pure client-side BM25
      </footer>
    </div>
  )
}
