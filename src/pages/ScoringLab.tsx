import { useState, useMemo } from 'react'
import { computeBM25TFCurve, computeBM25LengthCurve, multiMatch, bm25Score, getIndex, buildExplain } from '../lib/bm25'
import { PRODUCTS } from '../data/products'
import { TFSaturationChart, LengthNormChart, ScoreScatterChart, MultiLineChart } from '../components/BM25Chart'
import ExplainTree from '../components/ExplainTree'

const TABS = ['k1 Tuner', 'b Tuner', '_explain Decoder', 'Negative Scoring Demo']

export default function ScoringLab() {
  const [activeTab, setActiveTab] = useState(0)
  const [k1, setK1] = useState(1.2)
  const [b, setB] = useState(0.75)
  const [explainQuery, setExplainQuery] = useState('wireless headphones')
  const [explainProductIdx, setExplainProductIdx] = useState(0)
  const [negQuery, setNegQuery] = useState('camera')
  const [negResults, setNegResults] = useState<ReturnType<typeof multiMatch> | null>(null)

  const tfCurveData = useMemo(() => computeBM25TFCurve(k1), [k1])
  const tfCurveDataDefault = useMemo(() => computeBM25TFCurve(1.2), [])

  const lengthCurveData = useMemo(() => computeBM25LengthCurve(b, k1, 3), [b, k1])
  const lengthCurveDefault = useMemo(() => computeBM25LengthCurve(0.75, 1.2, 3), [])

  const multiCurveData = useMemo(() => {
    const maxTF = 20
    return Array.from({ length: maxTF + 1 }, (_, tf) => ({
      tf,
      k1_05: (tf * (0.5 + 1)) / (tf + 0.5),
      k1_12: (tf * (1.2 + 1)) / (tf + 1.2),
      k1_20: (tf * (2.0 + 1)) / (tf + 2.0),
      k1_30: (tf * (3.0 + 1)) / (tf + 3.0),
    }))
  }, [])

  const multiLengthData = useMemo(() => {
    const maxLen = 200
    const avgLen = 50
    return Array.from({ length: 41 }, (_, i) => {
      const len = i * 5
      const tf = 3
      const k1v = 1.2
      return {
        len,
        b0: (tf * (k1v + 1)) / (tf + k1v * (1 - 0 + 0 * (len / avgLen))),
        b025: (tf * (k1v + 1)) / (tf + k1v * (1 - 0.25 + 0.25 * (len / avgLen))),
        b075: (tf * (k1v + 1)) / (tf + k1v * (1 - 0.75 + 0.75 * (len / avgLen))),
        b1: (tf * (k1v + 1)) / (tf + k1v * (1 - 1 + 1 * (len / avgLen))),
      }
    })
  }, [])

  const explainResults = useMemo(() => {
    return multiMatch({ query: explainQuery, fields: ['title', 'description'], withExplain: true, size: 5, k1, b })
  }, [explainQuery, k1, b])

  const selectedProduct = explainResults.hits[explainProductIdx]?.product

  const explainNode = useMemo(() => {
    if (!selectedProduct || !explainQuery) return null
    return buildExplain(selectedProduct, explainQuery.split(' ').filter(Boolean), 'title', k1, b)
  }, [selectedProduct, explainQuery, k1, b])

  const scatterData = useMemo(() => {
    if (!explainQuery) return []
    const index = getIndex()
    const fieldIndex = index.fields.get('description')!
    const term = explainQuery.split(' ')[0]
    if (!term) return []
    return PRODUCTS.slice(0, 80).map(p => {
      const { score } = bm25Score(p.product_id, term, 'description', fieldIndex, k1, b)
      return {
        len: fieldIndex.fieldLengths.get(p.product_id) ?? 0,
        score,
        title: p.title,
      }
    }).filter(d => d.len > 0)
  }, [explainQuery, k1, b])

  function runNegDemo() {
    const r = multiMatch({ query: negQuery, fields: ['title', 'brand', 'description'], size: 10 })
    setNegResults(r)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">BM25 Scoring Lab</h2>
        <p className="text-sm text-gray-400 mt-1">Interactively visualize BM25 mechanics — term frequency saturation, length normalization, and score explanations.</p>
      </div>

      {/* Shared k1/b controls */}
      <div className="card flex flex-wrap gap-8">
        <div className="flex-1 min-w-48">
          <label className="label block mb-2">k1 = {k1.toFixed(2)} — Term Frequency Saturation</label>
          <input type="range" min="0" max="3" step="0.05" value={k1} onChange={e => setK1(Number(e.target.value))} className="w-full accent-indigo-500" />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0 (no TF)</span>
            <span>1.2 (default)</span>
            <span>3 (high TF weight)</span>
          </div>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label block mb-2">b = {b.toFixed(2)} — Length Normalization</label>
          <input type="range" min="0" max="1" step="0.05" value={b} onChange={e => setB(Number(e.target.value))} className="w-full accent-green-500" />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0 (no norm)</span>
            <span>0.75 (default)</span>
            <span>1 (full norm)</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Tab 0: k1 tuner */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Current k1 = {k1.toFixed(2)}</div>
            <TFSaturationChart data={tfCurveData} k1={k1} />
            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">k1</strong> controls how much additional term occurrences matter.
              At k1=0, TF has no effect (pure IDF). At k1=3, very high TF documents get much higher scores.
              The curve flattens because BM25 saturates — after enough occurrences, more repetitions add very little.
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">k1 Comparison</div>
            <MultiLineChart
              data={multiCurveData}
              xKey="tf"
              xLabel="Term Frequency"
              lines={[
                { key: 'k1_05', color: '#10b981', label: 'k1=0.5' },
                { key: 'k1_12', color: '#6366f1', label: 'k1=1.2 (default)' },
                { key: 'k1_20', color: '#f59e0b', label: 'k1=2.0' },
                { key: 'k1_30', color: '#ef4444', label: 'k1=3.0' },
              ]}
            />
            <div className="mt-3 text-xs text-gray-500">
              <strong className="text-gray-400">Short fields</strong> like title (5-8 tokens) benefit from lower b and slightly lower k1.
              ES default is k1=1.2, b=0.75. Some practitioners use k1=1.5 for long description fields.
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: b tuner */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Current b = {b.toFixed(2)} (tf=3, avgLen=50)</div>
            <LengthNormChart data={lengthCurveData} b={b} />
            <div className="mt-3 text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">b</strong> controls how much document length affects the score.
              At b=0: no normalization — long docs with more term occurrences always win.
              At b=1: full normalization — a term appearing once in 10 words = once in 1000 words.
              Short fields like title should use lower b (0.3-0.5). Long fields like description use default 0.75.
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">b Comparison</div>
            <MultiLineChart
              data={multiLengthData}
              xKey="len"
              xLabel="Field Length (tokens)"
              lines={[
                { key: 'b0', color: '#ef4444', label: 'b=0 (no norm)' },
                { key: 'b025', color: '#f59e0b', label: 'b=0.25' },
                { key: 'b075', color: '#6366f1', label: 'b=0.75 (default)' },
                { key: 'b1', color: '#10b981', label: 'b=1.0 (full norm)' },
              ]}
            />
            <div className="mt-3 text-xs text-gray-500">
              With <strong className="text-gray-400">b=0</strong>, a term appearing 3× in a 200-token field scores the same as 3× in a 5-token field.
              With <strong className="text-gray-400">b=1.0</strong>, shorter fields get a big advantage since 3 occurrences in 5 tokens is very dense.
            </div>
          </div>
          <div className="card lg:col-span-2">
            <div className="text-sm font-medium text-gray-300 mb-3">Field Length vs Score (live scatter — first term of query)</div>
            <div className="flex items-center gap-2 mb-3">
              <input
                className="input max-w-xs"
                value={explainQuery}
                onChange={e => setExplainQuery(e.target.value)}
                placeholder="Enter a query term..."
              />
              <span className="text-xs text-gray-500">b={b.toFixed(2)}</span>
            </div>
            <ScoreScatterChart data={scatterData} />
            <div className="mt-2 text-xs text-gray-500">
              Each point is a product. X = description field length. Y = BM25 score for the query term.
              With high b, shorter documents cluster at the top right. With b=0, there's no length-based pattern.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Explain Decoder */}
      {activeTab === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="card">
              <label className="label block mb-2">Query</label>
              <div className="flex gap-2">
                <input className="input" value={explainQuery} onChange={e => setExplainQuery(e.target.value)} placeholder="Enter query..." />
              </div>
            </div>
            {explainResults.hits.length > 0 && (
              <div className="card">
                <label className="label block mb-2">Select Document to Explain</label>
                <div className="space-y-1">
                  {explainResults.hits.map((hit, i) => (
                    <button
                      key={hit.product.product_id}
                      onClick={() => setExplainProductIdx(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
                        i === explainProductIdx ? 'bg-indigo-900/50 text-indigo-200' : 'hover:bg-gray-800 text-gray-400'
                      }`}
                    >
                      <span className="truncate">{hit.product.title}</span>
                      <span className="score-badge ml-2 shrink-0">{hit.score.toFixed(4)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {explainNode && (
              <div className="card">
                <div className="label mb-2">BM25 Score Breakdown</div>
                <ExplainTree node={explainNode} />
              </div>
            )}
            <div className="card text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400 block mb-1">Reading the tree:</strong>
              <p><strong>IDF</strong> = ln(1 + (N − df + 0.5) / (df + 0.5)) — high IDF means the term is rare.</p>
              <p className="mt-1"><strong>TF_norm</strong> = tf*(k1+1) / (tf + k1*(1−b+b*len/avgLen)) — how often the term appears, normalized by field length.</p>
              <p className="mt-1"><strong>Score per term</strong> = IDF × TF_norm. Final score sums across all query terms.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Negative scoring demo */}
      {activeTab === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="card">
              <div className="text-sm font-medium text-gray-300 mb-2">Negative Scoring with should Clauses</div>
              <div className="text-xs text-gray-400 leading-relaxed mb-3">
                When <code className="bg-gray-800 px-1 rounded">should</code> clauses have <code className="bg-gray-800 px-1 rounded">minimum_should_match=0</code>,
                they can push documents that only partially match below documents with a higher total score through coincidental should matches.
                This demo shows how function_score with popularity can override BM25 relevance.
              </div>
              <div className="flex gap-2">
                <input className="input" value={negQuery} onChange={e => setNegQuery(e.target.value)} placeholder="Search query..." />
                <button onClick={runNegDemo} className="btn-primary shrink-0">Run</button>
              </div>
            </div>
            {negResults && (
              <div className="card space-y-2">
                <div className="text-sm font-medium text-gray-300">Pure BM25 Results</div>
                {negResults.hits.map((hit, i) => (
                  <div key={hit.product.product_id} className="text-xs flex items-center gap-2 py-1 border-b border-gray-800">
                    <span className="text-gray-600 w-4">{i + 1}</span>
                    <span className="flex-1 text-gray-300 truncate">{hit.product.title}</span>
                    <span className="score-badge">{hit.score.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">BM25 Formula Reference</div>
            <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-3">
              <div>
                <div className="text-gray-500 mb-1">// BM25 Score for query Q and document D:</div>
                <div>score(D, Q) = Σ IDF(qᵢ) × <span className="text-indigo-400">tfNorm(qᵢ, D)</span></div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">// IDF (Inverse Document Frequency):</div>
                <div>IDF(q) = ln(1 + <span className="text-green-400">(N − df + 0.5)</span> / <span className="text-yellow-400">(df + 0.5)</span>)</div>
                <div className="text-gray-500 mt-1">// N=total docs, df=docs containing term</div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">// TF Normalization:</div>
                <div>tfNorm = tf × <span className="text-indigo-400">(k1 + 1)</span></div>
                <div className="ml-12">/ (tf + k1 × (1 − b + b × <span className="text-purple-400">len / avgLen</span>))</div>
                <div className="text-gray-500 mt-1">// k1={k1.toFixed(2)}, b={b.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-gray-500">
              <div><strong className="text-gray-400">N</strong> = {PRODUCTS.length} (total documents in index)</div>
              <div><strong className="text-gray-400">k1={k1.toFixed(2)}</strong> — higher = more TF weight before saturation</div>
              <div><strong className="text-gray-400">b={b.toFixed(2)}</strong> — higher = more length normalization</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
