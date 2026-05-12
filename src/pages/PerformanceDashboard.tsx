import { useState, useMemo } from 'react'
import { multiMatch, wildcardSearch, prefixSearch, phraseMatch } from '../lib/bm25'
import { LatencyBarChart, MultiLineChart } from '../components/BM25Chart'
import QueryEditor from '../components/QueryEditor'

function runWithTiming<T>(fn: () => T): [T, number] {
  const t0 = performance.now()
  const result = fn()
  return [result, Math.round(performance.now() - t0)]
}

function simulateCacheMiss(took: number) {
  return Math.round(took * (4 + Math.random() * 3))
}

function simulateCacheHit(took: number) {
  return Math.max(1, Math.round(took * (0.1 + Math.random() * 0.1)))
}

export default function PerformanceDashboard() {
  const [activeTab, setActiveTab] = useState(0)
  const [filterQuery, setFilterQuery] = useState('camera')
  const [filterRuns, setFilterRuns] = useState<number[]>([])
  const [wildcardQuery, setWildcardQuery] = useState('battery')
  const [boolClauses, setBoolClauses] = useState(10)
  const [profileQuery, setProfileQuery] = useState('sony wireless camera')
  const [profileResult, setProfileResult] = useState<ReturnType<typeof multiMatch> | null>(null)

  const TABS = ['Filter Cache', 'Query Profiler', 'Wildcard Cost', 'Bool Clause Explosion']

  function runFilterDemo() {
    const [, took] = runWithTiming(() =>
      multiMatch({ query: filterQuery, fields: ['category_path'], filters: [p => p.in_stock && p.price < 500] })
    )
    setFilterRuns(prev => {
      if (prev.length === 0) return [simulateCacheMiss(took)]
      if (prev.length === 1) return [...prev, simulateCacheHit(prev[0])]
      if (prev.length === 2) return [...prev, simulateCacheHit(prev[1])]
      // After changing filter
      return [simulateCacheMiss(took)]
    })
  }

  const wildcardComparison = useMemo(() => {
    const [wr, wt] = runWithTiming(() => wildcardSearch(`*${wildcardQuery}*`, 'title'))
    const [pr, pt] = runWithTiming(() => prefixSearch(wildcardQuery, 'title'))
    const [mr, mt] = runWithTiming(() => multiMatch({ query: wildcardQuery, fields: ['title'] }))

    const simWildcard = Math.max(wt, 15) * 8 // simulate slow wildcard
    const simMatch = Math.max(mt, 2)
    const simPrefix = Math.max(pt, 3)

    return {
      data: [
        { name: 'wildcard *term*', took: simWildcard },
        { name: 'prefix query', took: simPrefix * 2 },
        { name: 'match query', took: simMatch },
      ],
      wildcardHits: wr.hits.length,
      prefixHits: pr.hits.length,
      matchHits: mr.hits.length,
    }
  }, [wildcardQuery])

  const clauseExplosionData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const n = 5 + i * 5
      const baseMs = 2 + n * 0.3
      return {
        clauses: n,
        naive: Math.round(baseMs + Math.random() * 2),
        optimized: Math.round(Math.max(2, baseMs * 0.3) + Math.random()),
      }
    })
  }, [])

  function runProfile() {
    const result = multiMatch({ query: profileQuery, fields: ['title', 'brand', 'description'], withExplain: true, size: 5 })
    setProfileResult(result)
  }

  const profileData = profileResult ? [
    { phase: 'Tokenize', ms: Math.max(1, Math.round(profileResult.took * 0.05)) },
    { phase: 'Lookup title', ms: Math.max(1, Math.round(profileResult.took * 0.25)) },
    { phase: 'Lookup brand', ms: Math.max(1, Math.round(profileResult.took * 0.15)) },
    { phase: 'Lookup description', ms: Math.max(1, Math.round(profileResult.took * 0.35)) },
    { phase: 'Score + Sort', ms: Math.max(1, Math.round(profileResult.took * 0.15)) },
    { phase: 'Fetch source', ms: Math.max(1, Math.round(profileResult.took * 0.05)) },
  ] : []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Performance & Caching Dashboard</h2>
        <p className="text-sm text-gray-400 mt-1">Understand query performance, caching behavior, and how different query types scale.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === i ? 'bg-gray-900 text-indigo-300 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 0: Filter Cache */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Filter Cache Visualization</div>
            <div className="text-xs text-gray-400 mb-4 leading-relaxed">
              Elasticsearch caches filter results in the <strong className="text-gray-300">filter cache</strong>.
              The first execution is slow (cache miss). Subsequent identical executions are fast (cache hit).
              Changing the filter invalidates the cache entry.
            </div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={filterQuery} onChange={e => setFilterQuery(e.target.value)} placeholder="Category filter..." />
              <button onClick={runFilterDemo} className="btn-primary shrink-0">Run</button>
              <button onClick={() => { setFilterRuns([]); }} className="btn-secondary shrink-0">Reset</button>
            </div>

            <div className="space-y-2">
              {filterRuns.map((ms, i) => {
                const isMiss = i === 0 || (i > 2 && filterRuns[i - 1] > 10)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16">Run {i + 1}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isMiss ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (ms / Math.max(...filterRuns, 1)) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-16 ${isMiss ? 'text-red-400' : 'text-green-400'}`}>
                      {ms}ms {isMiss ? '(miss)' : '(hit)'}
                    </span>
                  </div>
                )
              })}
              {filterRuns.length === 0 && (
                <div className="text-xs text-gray-600 text-center py-4">Click "Run" to simulate cache behavior</div>
              )}
            </div>

            {filterRuns.length >= 3 && (
              <div className="mt-3 text-xs text-gray-500">
                <div className="p-2 bg-blue-950/30 border border-blue-800/50 rounded">
                  ✨ Notice how runs 2+ are much faster? The filter bitset is cached in memory.
                  Change the query and run again to see a new cache miss.
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Cache-Friendly Query Patterns</div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-red-950/20 border border-red-800/30 rounded-lg">
                <div className="text-red-400 font-medium mb-1">❌ Don't: Precise timestamp range</div>
                <div className="font-mono text-gray-400">{'{"range": {"created_at": {"gte": "now-30d"}}}'}</div>
                <div className="text-gray-500 mt-1">Every second creates a new cache key. Cache is useless.</div>
              </div>
              <div className="p-3 bg-green-950/20 border border-green-800/30 rounded-lg">
                <div className="text-green-400 font-medium mb-1">✓ Do: Rounded date range</div>
                <div className="font-mono text-gray-400">{'{"range": {"created_at": {"gte": "now-30d/d"}}}'}</div>
                <div className="text-gray-500 mt-1">/d rounds to the day boundary. Same cache key all day.</div>
              </div>
              <div className="p-3 bg-green-950/20 border border-green-800/30 rounded-lg">
                <div className="text-green-400 font-medium mb-1">✓ Do: Use filter context, not query context</div>
                <div className="font-mono text-gray-400">{'{"bool": {"filter": [{"term": {"in_stock": true}}]}}'}</div>
                <div className="text-gray-500 mt-1">filter context = no scoring + cached. query context = scored + not cached.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Query Profiler */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Query Profiler</div>
            <div className="text-xs text-gray-400 mb-3">
              The ES Profile API breaks down query execution into phases, showing which clauses are expensive.
            </div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={profileQuery} onChange={e => setProfileQuery(e.target.value)} />
              <button onClick={runProfile} className="btn-primary shrink-0">Profile</button>
            </div>
            {profileResult && (
              <div className="space-y-2">
                {profileData.map(({ phase, ms }) => (
                  <div key={phase} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 shrink-0">{phase}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${(ms / profileData.reduce((s, d) => s + d.ms, 0)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-400 w-10">{ms}ms</span>
                  </div>
                ))}
                <div className="text-xs text-gray-600 mt-2">
                  Total: {profileData.reduce((s, d) => s + d.ms, 0)}ms · {profileResult.hits.length} hits
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Profile API Query</div>
            <QueryEditor
              readOnly
              value={{
                query: { multi_match: { query: profileQuery, fields: ['title', 'brand', 'description'] } },
                profile: true,
              }}
            />
            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              Add <code className="bg-gray-800 px-1 rounded">"profile": true</code> to any query to get a detailed
              breakdown of execution time per clause, per shard. The output shows <strong className="text-gray-400">time_in_nanos</strong>
              for each query node — invaluable for identifying slow clauses in complex bool queries.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Wildcard Cost */}
      {activeTab === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Wildcard vs Match Latency</div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={wildcardQuery} onChange={e => setWildcardQuery(e.target.value)} placeholder="Search term..." />
            </div>
            <LatencyBarChart data={wildcardComparison.data} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-400">wildcard hits</div>
                <div className="text-red-400 font-mono">{wildcardComparison.wildcardHits}</div>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-400">prefix hits</div>
                <div className="text-yellow-400 font-mono">{wildcardComparison.prefixHits}</div>
              </div>
              <div className="p-2 bg-gray-800 rounded">
                <div className="text-gray-400">match hits</div>
                <div className="text-green-400 font-mono">{wildcardComparison.matchHits}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Why Wildcards Are Slow</div>
            <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
              <div className="p-3 bg-red-950/20 border border-red-800/30 rounded-lg">
                <strong className="text-red-400">Leading wildcard (*battery*)</strong>: Must scan every term in the index
                one by one to check if it contains "battery". O(V) where V = vocabulary size.
                On a 1M document index with 100K unique terms, this can take seconds.
              </div>
              <div className="p-3 bg-yellow-950/20 border border-yellow-800/30 rounded-lg">
                <strong className="text-yellow-400">Trailing wildcard (battery*)</strong>: Binary search to find "battery",
                then linear scan for all terms starting with it. O(log V + matches). Much faster than leading wildcard.
              </div>
              <div className="p-3 bg-green-950/20 border border-green-800/30 rounded-lg">
                <strong className="text-green-400">match query</strong>: Exact hash lookup in the inverted index.
                O(1) per term. Always prefer analyzed match queries over wildcards for user-facing search.
              </div>
              <div className="p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-lg">
                <strong className="text-indigo-400">Alternative</strong>: Index a field with edge n-gram analyzer for
                prefix-capable search at O(1) query time. Or use search_as_you_type field type which
                auto-creates _2gram, _3gram, and prefix sub-fields.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Bool Clause Explosion */}
      {activeTab === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Bool Clause Explosion</div>
            <div className="text-xs text-gray-400 mb-4">
              Simulated latency (ms) as the number of filter clauses grows.
            </div>
            <label className="label block mb-2">Clauses: {boolClauses}</label>
            <input
              type="range" min="5" max="50" step="5"
              value={boolClauses}
              onChange={e => setBoolClauses(Number(e.target.value))}
              className="w-full accent-indigo-500 mb-4"
            />
            <MultiLineChart
              data={clauseExplosionData}
              xKey="clauses"
              xLabel="Number of Filter Clauses"
              lines={[
                { key: 'naive', color: '#ef4444', label: 'Naive bool (all filter clauses)' },
                { key: 'optimized', color: '#10b981', label: 'Optimized (terms lookup + rescore)' },
              ]}
            />
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Optimization Strategies</div>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-red-950/20 border border-red-800/30 rounded-lg">
                <div className="text-red-400 font-medium mb-1">❌ Anti-pattern: Expanding to many filter clauses</div>
                <div className="font-mono text-gray-500 text-xs">
                  {`{"bool": {"filter": [{"term": {"brand": "A"}}, {"term": {"brand": "B"}}, ...N more]}}`}
                </div>
                <div className="text-gray-500 mt-1">Each clause = one bitset AND operation. N=50 → very slow.</div>
              </div>
              <div className="p-3 bg-green-950/20 border border-green-800/30 rounded-lg">
                <div className="text-green-400 font-medium mb-1">✓ Use terms query (one clause, many values)</div>
                <div className="font-mono text-gray-500 text-xs">
                  {`{"terms": {"brand": ["A", "B", "C", ...N terms]}}`}
                </div>
                <div className="text-gray-500 mt-1">Single hash lookup per document. Scales to thousands of values.</div>
              </div>
              <div className="p-3 bg-green-950/20 border border-green-800/30 rounded-lg">
                <div className="text-green-400 font-medium mb-1">✓ Use bool + rescore for complex ranking</div>
                <div className="text-gray-500">
                  Phase 1: Cheap filter/bool retrieves top-N candidates.
                  Phase 2: Expensive script/vector scoring applied only to top-N.
                  Avoids scoring all matching documents.
                </div>
              </div>
              <div className="p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-lg">
                <div className="text-indigo-400 font-medium mb-1">✓ Shard routing for targeted queries</div>
                <div className="text-gray-500">
                  Route documents by category to specific shards.
                  Category filters then only hit one shard instead of all shards.
                  Reduces scatter-gather overhead dramatically.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
