import { useState, useCallback } from 'react'
import { QUERY_TEMPLATES } from '../lib/queryTemplates'
import {
  multiMatch, phraseMatch, wildcardSearch, prefixSearch,
  matchPhrasePrefixSearch, constantScore, boolQuery, termsLookup,
  moreLikeThis, functionScore, SearchResult, buildExplain,
} from '../lib/bm25'
import { PRODUCTS } from '../data/products'
import ResultsList from '../components/ResultsList'
import ExplainTree from '../components/ExplainTree'
import QueryEditor from '../components/QueryEditor'

const DEFAULT_QUERY = QUERY_TEMPLATES[0]

function runQuery(templateId: string, query: string): SearchResult {
  switch (templateId) {
    case 'multi_match_best_fields':
      return multiMatch({ query, fields: ['title', 'brand', 'description', 'bullet_features'], type: 'best_fields', tieBreaker: 0.3, withExplain: true })
    case 'multi_match_most_fields':
      return multiMatch({ query, fields: ['title', 'description', 'bullet_features'], type: 'most_fields', withExplain: true })
    case 'multi_match_cross_fields':
      return multiMatch({ query, fields: ['title', 'brand', 'description', 'bullet_features'], type: 'cross_fields', withExplain: true })
    case 'bool_query':
      return boolQuery({ must: query.split(' ').filter(Boolean), should: ['sale', 'deal'], size: 10 })
    case 'match_phrase':
      return phraseMatch(query, 'description', 0)
    case 'match_phrase_slop':
      return phraseMatch(query, 'description', 2)
    case 'match_phrase_prefix':
      return matchPhrasePrefixSearch(query, 'title')
    case 'function_score':
      return functionScore(query, [{ type: 'field_value_factor', field: 'popularity_score', factor: 0.001 }, { type: 'gauss' }], 'multiply')
    case 'more_like_this': {
      const match = PRODUCTS.find(p => p.title.toLowerCase().includes(query.toLowerCase()))
      return moreLikeThis(match?.product_id ?? 'PROD-0001')
    }
    case 'wildcard':
      return wildcardSearch(query.includes('*') || query.includes('?') ? query : `*${query}*`, 'title')
    case 'prefix':
      return prefixSearch(query, 'sku')
    case 'constant_score':
      return constantScore(p => p.in_stock, 1.0)
    case 'terms_lookup':
      return termsLookup(query.split(',').map(s => s.trim()).filter(Boolean))
    case 'bool_rescore':
      return multiMatch({
        query,
        fields: ['title', 'brand', 'description'],
        withExplain: true,
        rescore: {
          windowSize: 50,
          rescoreQuery: (p) => p.popularity_score / 1000,
        },
      })
    default:
      return multiMatch({ query, withExplain: true })
  }
}

export default function QueryPlayground() {
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_QUERY)
  const [query, setQuery] = useState(DEFAULT_QUERY.defaultQuery)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [selectedHit, setSelectedHit] = useState<string | undefined>()
  const [showLearn, setShowLearn] = useState(true)

  const handleRun = useCallback(() => {
    const r = runQuery(selectedTemplate.id, query)
    setResult(r)
    setSelectedHit(undefined)
  }, [selectedTemplate.id, query])

  const selectedHitData = result?.hits.find(h => h.product.product_id === selectedHit)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Query Types Playground</h2>
        <p className="text-sm text-gray-400 mt-1">Explore all 17 Elasticsearch query types with live results and score explanations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
        {/* Left: Query type selector */}
        <div className="card space-y-1 max-h-[85vh] overflow-y-auto">
          <div className="label mb-2">Query Types</div>
          {QUERY_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTemplate(t)
                setQuery(t.defaultQuery)
                setResult(null)
                setSelectedHit(undefined)
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedTemplate.id === t.id
                  ? 'bg-indigo-900/60 text-indigo-200 font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Center: Query + results */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1">
                <label className="label mb-1 block">Search Query</label>
                <input
                  className="input"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRun()}
                  placeholder="Enter search query..."
                />
              </div>
              <button onClick={handleRun} className="btn-primary mt-5 shrink-0">
                Search ↵
              </button>
            </div>

            {result && (
              <QueryEditor value={result.queryJson} readOnly label="ES Query Sent" />
            )}
          </div>

          {result && (
            <ResultsList
              hits={result.hits}
              total={result.total}
              took={result.took}
              onSelect={h => setSelectedHit(h.product.product_id)}
              selectedId={selectedHit}
            />
          )}

          {!result && (
            <div className="card text-center py-12 text-gray-600">
              <div className="text-3xl mb-2">⚡</div>
              <p className="text-sm">Run a query to see results</p>
            </div>
          )}
        </div>

        {/* Right: Learn panel + explain */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="label">Learn: {selectedTemplate.name}</span>
              <button onClick={() => setShowLearn(!showLearn)} className="text-xs text-gray-500 hover:text-gray-300">
                {showLearn ? 'Hide' : 'Show'}
              </button>
            </div>
            {showLearn && (
              <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
                <p>{selectedTemplate.description}</p>
                <div>
                  <span className="text-green-400 font-medium">✓ When to use: </span>
                  {selectedTemplate.whenToUse}
                </div>
                <div>
                  <span className="text-yellow-400 font-medium">⚠ Pitfalls: </span>
                  {selectedTemplate.pitfalls}
                </div>
              </div>
            )}
          </div>

          {selectedHitData?.explain && (
            <div className="card">
              <div className="label mb-2">Score Explain: {selectedHitData.product.title.slice(0, 40)}…</div>
              <ExplainTree node={selectedHitData.explain} />
            </div>
          )}

          {result && !selectedHit && result.hits.length > 0 && (
            <div className="card text-xs text-gray-500 text-center py-4">
              Click a result to see its score breakdown
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
