import { useState, useMemo } from 'react'
import { multiMatch, SearchHit } from '../lib/bm25'
import SideBySide from '../components/SideBySide'

type Grade = 0 | 1 | 2 | 3
const GRADE_LABELS: Record<Grade, string> = { 0: 'Not Relevant', 1: 'Slightly', 2: 'Relevant', 3: 'Highly Relevant' }
const GRADE_COLORS: Record<Grade, string> = {
  0: 'bg-gray-700 text-gray-400',
  1: 'bg-yellow-900 text-yellow-400',
  2: 'bg-green-900 text-green-400',
  3: 'bg-indigo-900 text-indigo-300',
}

interface Judgment {
  productId: string
  grade: Grade
}

function computeNDCG(hits: SearchHit[], judgments: Judgment[], k = 10): number {
  const judgeMap = new Map(judgments.map(j => [j.productId, j.grade]))

  function dcg(results: SearchHit[], n: number): number {
    let sum = 0
    for (let i = 0; i < Math.min(n, results.length); i++) {
      const grade = judgeMap.get(results[i].product.product_id) ?? 0
      sum += grade / Math.log2(i + 2)
    }
    return sum
  }

  const ideal = [...hits].sort((a, b) => (judgeMap.get(b.product.product_id) ?? 0) - (judgeMap.get(a.product.product_id) ?? 0))
  const idealDCG = dcg(ideal, k)
  if (idealDCG === 0) return 0
  return dcg(hits, k) / idealDCG
}

const SAMPLE_QUERIES = [
  'wireless headphones',
  'professional camera',
  'gaming laptop',
  'running shoes',
  'kitchen appliances',
]

export default function RelevanceEval() {
  const [activeTab, setActiveTab] = useState(0)

  // Side by side
  const [queryA, setQueryA] = useState('wireless headphones')
  const [queryB, setQueryB] = useState('noise canceling earphones')
  const [resultsA, setResultsA] = useState<SearchHit[]>([])
  const [resultsB, setResultsB] = useState<SearchHit[]>([])

  // NDCG
  const [ndcgQuery, setNdcgQuery] = useState('professional camera')
  const [ndcgHits, setNdcgHits] = useState<SearchHit[]>([])
  const [judgments, setJudgments] = useState<Judgment[]>([])

  // Zero result monitor
  const [zeroResultQueries] = useState([
    { query: 'goprophone', type: 'typo', count: 142 },
    { query: 'air pods pro 3rd gen', type: 'oot', count: 89 },
    { query: 'canon r6ii sensor size specs table', type: 'overly-specific', count: 67 },
    { query: 'laptops under $200 gaming', type: 'filter-mismatch', count: 203 },
    { query: 'bose qc 45 vs sony xm6', type: 'comparison', count: 56 },
    { query: 'adidas yeezys', type: 'licensed', count: 312 },
    { query: 'telephonic lens for canon mirrorless', type: 'typo', count: 44 },
    { query: 'apple macbok pro m3', type: 'typo', count: 78 },
    { query: 'instapot 8 quart', type: 'typo', count: 91 },
    { query: 'kindle oasis 2024', type: 'oot', count: 35 },
  ])

  const TABS = ['A/B Comparator', 'NDCG Calculator', 'Zero-Result Monitor']

  function runComparison() {
    setResultsA(multiMatch({ query: queryA, fields: ['title', 'brand', 'description'], size: 10 }).hits)
    setResultsB(multiMatch({ query: queryB, fields: ['title', 'brand', 'description'], size: 10 }).hits)
  }

  function runNDCG() {
    const r = multiMatch({ query: ndcgQuery, fields: ['title', 'brand', 'description'], size: 10 })
    setNdcgHits(r.hits)
    setJudgments(r.hits.map(h => ({ productId: h.product.product_id, grade: 0 })))
  }

  function setGrade(productId: string, grade: Grade) {
    setJudgments(prev => prev.map(j => j.productId === productId ? { ...j, grade } : j))
  }

  const ndcg = useMemo(() => computeNDCG(ndcgHits, judgments), [ndcgHits, judgments])

  const zeroResultsByType = useMemo(() => {
    const types: Record<string, number> = {}
    zeroResultQueries.forEach(q => { types[q.type] = (types[q.type] ?? 0) + q.count })
    return types
  }, [zeroResultQueries])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Relevance Evaluation Tools</h2>
        <p className="text-sm text-gray-400 mt-1">Measure and compare search quality with A/B comparisons, NDCG scoring, and zero-result analysis.</p>
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

      {/* Tab 0: A/B Comparator */}
      {activeTab === 0 && (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="label block mb-1">Query A</label>
                <input className="input" value={queryA} onChange={e => setQueryA(e.target.value)} placeholder="Query A..." />
              </div>
              <div>
                <label className="label block mb-1">Query B</label>
                <input className="input" value={queryB} onChange={e => setQueryB(e.target.value)} placeholder="Query B..." />
              </div>
            </div>
            <button onClick={runComparison} className="btn-primary">Compare Results</button>
          </div>

          {resultsA.length > 0 && (
            <div className="card">
              <div className="text-xs text-gray-500 mb-3 flex gap-4">
                <span>↑ rank improved &nbsp; ↓ rank declined &nbsp; ★ new in this query</span>
              </div>
              <SideBySide
                leftLabel={queryA}
                rightLabel={queryB}
                leftHits={resultsA}
                rightHits={resultsB}
              />
            </div>
          )}

          {resultsA.length === 0 && (
            <div className="card text-center py-12 text-gray-600">
              <div className="text-3xl mb-2">🅐🅑</div>
              <p className="text-sm">Enter two queries and click Compare to see rank differences</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: NDCG Calculator */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-4">
            <div className="card">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label block mb-1">Query</label>
                  <input className="input" value={ndcgQuery} onChange={e => setNdcgQuery(e.target.value)} placeholder="Search query..." />
                </div>
                <button onClick={runNDCG} className="btn-primary mt-5 shrink-0">Get Results</button>
              </div>
              <div className="flex gap-2 mt-2">
                {SAMPLE_QUERIES.map(q => (
                  <button key={q} onClick={() => { setNdcgQuery(q); }} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-400 whitespace-nowrap">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {ndcgHits.length > 0 && (
              <div className="card">
                <div className="label mb-3">Grade Results (0=Not Relevant, 3=Highly Relevant)</div>
                <div className="space-y-2">
                  {ndcgHits.map((hit, i) => {
                    const j = judgments.find(j => j.productId === hit.product.product_id)
                    const grade = j?.grade ?? 0 as Grade
                    return (
                      <div key={hit.product.product_id} className="flex items-center gap-3">
                        <span className="text-gray-600 text-xs w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-200 truncate">{hit.product.title}</div>
                          <div className="text-xs text-gray-500">{hit.product.brand}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {([0, 1, 2, 3] as Grade[]).map(g => (
                            <button
                              key={g}
                              onClick={() => setGrade(hit.product.product_id, g)}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                grade === g ? GRADE_COLORS[g] : 'bg-gray-800 text-gray-600 hover:text-gray-400'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {ndcgHits.length > 0 && (
              <div className="card text-center">
                <div className="text-xs text-gray-500 mb-1">NDCG@10</div>
                <div className={`text-4xl font-bold font-mono ${ndcg >= 0.7 ? 'text-green-400' : ndcg >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {ndcg.toFixed(3)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {ndcg >= 0.8 ? 'Excellent' : ndcg >= 0.6 ? 'Good' : ndcg >= 0.4 ? 'Fair' : 'Poor'}
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  Label results to update score in real time
                </div>
              </div>
            )}

            <div className="card text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-300 block mb-2">NDCG@k Formula</strong>
              <div className="bg-gray-950 rounded p-2 font-mono text-xs mb-2">
                DCG@k = Σᵢ grade(i) / log₂(i+1)<br/>
                NDCG@k = DCG@k / IDCG@k
              </div>
              <p>IDCG is the DCG of the ideal (perfect) ranking. NDCG=1.0 means your results are in the perfect order. NDCG=0 means all results are irrelevant.</p>
              <p className="mt-1">Grade scale: 0=Not relevant, 1=Slightly relevant, 2=Relevant, 3=Highly relevant.</p>
              <p className="mt-1">Industry benchmarks: &gt;0.8 excellent, 0.6-0.8 good, &lt;0.5 needs improvement.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Zero Result Monitor */}
      {activeTab === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-4">Zero-Result Rate — Sample Query Log</div>
            <div className="space-y-2">
              {zeroResultQueries.map(({ query, type, count }) => (
                <div key={query} className="flex items-center gap-3 py-2 border-b border-gray-800">
                  <div className="flex-1">
                    <div className="text-sm text-gray-200">"{query}"</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        type === 'typo' ? 'bg-yellow-900 text-yellow-400' :
                        type === 'oot' ? 'bg-blue-900 text-blue-400' :
                        type === 'overly-specific' ? 'bg-purple-900 text-purple-400' :
                        type === 'licensed' ? 'bg-red-900 text-red-400' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {type === 'oot' ? 'out-of-catalog' : type}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono text-gray-300">{count.toLocaleString()}</div>
                    <div className="text-xs text-gray-600">occurrences</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="label mb-3">Category Breakdown</div>
              <div className="space-y-2">
                {Object.entries(zeroResultsByType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-28 shrink-0">{type}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${(count / Object.values(zeroResultsByType).reduce((a, b) => a + b, 0)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-500 w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card text-xs text-gray-400 leading-relaxed space-y-2">
              <strong className="text-gray-300 block">Remediation Strategies</strong>
              <div className="p-2 bg-yellow-950/20 border border-yellow-800/30 rounded">
                <strong className="text-yellow-400">Typos:</strong> Add spell correction (phrase suggester). Set fuzziness=AUTO on match queries. Add common misspelling synonyms.
              </div>
              <div className="p-2 bg-blue-950/20 border border-blue-800/30 rounded">
                <strong className="text-blue-400">Out-of-catalog:</strong> Show "coming soon" or similar products. Use MLT to find related items.
              </div>
              <div className="p-2 bg-purple-950/20 border border-purple-800/30 rounded">
                <strong className="text-purple-400">Overly specific:</strong> Remove low-IDF terms progressively until results are found. Use simple_query_string with lenient=true.
              </div>
              <div className="p-2 bg-red-950/20 border border-red-800/30 rounded">
                <strong className="text-red-400">Licensed brands:</strong> Show alternatives from similar brands. Add synonym: "yeezy → adidas originals".
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
