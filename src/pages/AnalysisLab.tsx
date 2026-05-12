import { useState, useMemo } from 'react'
import { analyze, ANALYZER_DESCRIPTIONS, AnalyzerName, expandSynonyms, analyzeQuery, SYNONYMS } from '../lib/analyzer'
import { stem } from '../lib/stemmer'
import { matchPhrasePrefixSearch, prefixSearch, multiMatch } from '../lib/bm25'

const ALL_ANALYZERS: AnalyzerName[] = ['standard', 'english', 'english_unstemmed', 'english_shingles', 'edge_ngram', 'part_number']

const TOKEN_COLORS: Record<string, string> = {
  word: 'bg-indigo-900 text-indigo-300',
  shingle: 'bg-purple-900 text-purple-300',
  edge_ngram: 'bg-green-900 text-green-300',
  part_number: 'bg-yellow-900 text-yellow-300',
}

function TokenBadge({ token, type }: { token: string; type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono mr-1 mb-1 ${TOKEN_COLORS[type] ?? 'bg-gray-800 text-gray-400'}`}>
      {token}
    </span>
  )
}

const TABS = ['Analyzer Comparison', 'Stemming Impact', 'Synonyms', 'Edge N-gram vs Completion', 'Part Number Search', 'copy_to vs Multi-field']

export default function AnalysisLab() {
  const [activeTab, setActiveTab] = useState(0)
  const [analyzeText, setAnalyzeText] = useState('Running shoes for marathon training')
  const [selectedAnalyzers, setSelectedAnalyzers] = useState<AnalyzerName[]>(['standard', 'english', 'edge_ngram'])
  const [stemmingWord, setStemmingWord] = useState('running')
  const [synonymQuery, setSynonymQuery] = useState('tv')
  const [autocompleteText, setAutocompleteText] = useState('sony mir')
  const [partNumberQuery, setPartNumberQuery] = useState('D850')

  const analyzerResults = useMemo(() => {
    return selectedAnalyzers.map(a => ({
      analyzer: a,
      tokens: analyze(analyzeText, a),
    }))
  }, [analyzeText, selectedAnalyzers])

  const stemmingExamples = useMemo(() => {
    const words = ['running', 'runs', 'ran', 'runner', 'running shoes', 'she runs a company', 'run']
    return words.map(w => ({
      word: w,
      stem: w.split(' ').map(t => stem(t.toLowerCase())).join(' '),
      tokens: analyzeQuery(w, 'english'),
    }))
  }, [])

  const synonymExpanded = useMemo(() => {
    const terms = analyzeQuery(synonymQuery, 'standard')
    const expanded = expandSynonyms(terms)
    return { original: terms, expanded, synonymGroups: SYNONYMS }
  }, [synonymQuery])

  const synResults = useMemo(() => {
    const expanded = synonymExpanded.expanded.join(' ')
    const without = multiMatch({ query: synonymQuery, fields: ['title', 'description'], size: 5 })
    const with_ = multiMatch({ query: expanded, fields: ['title', 'description'], size: 5 })
    return { without, with: with_ }
  }, [synonymQuery, synonymExpanded])

  const autocompleteEdgeNgram = useMemo(() => {
    return prefixSearch(autocompleteText.toLowerCase(), 'title', 8)
  }, [autocompleteText])

  const autocompletePhrase = useMemo(() => {
    return matchPhrasePrefixSearch(autocompleteText, 'title', 8)
  }, [autocompleteText])

  const partNumberResults = useMemo(() => {
    const withPN = multiMatch({ query: partNumberQuery, fields: ['sku'], size: 5 })
    const withStandard = {
      hits: multiMatch({ query: partNumberQuery, fields: ['title'], size: 5 }).hits,
      total: 0,
      took: 0,
      queryJson: {},
    }
    return { withPN, withStandard }
  }, [partNumberQuery])

  const copyToResults = useMemo(() => {
    const r = multiMatch({ query: 'sony camera', fields: ['title', 'brand', 'description'], size: 5, type: 'best_fields' })
    return r
  }, [])

  function toggleAnalyzer(a: AnalyzerName) {
    setSelectedAnalyzers(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Analysis & Tokenization Lab</h2>
        <p className="text-sm text-gray-400 mt-1">See how different analyzers tokenize text and how it affects search behavior.</p>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-gray-800 pb-1">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-3 py-2 text-sm font-medium transition-colors rounded-t-lg ${
              activeTab === i ? 'bg-gray-900 text-indigo-300 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 0: Analyzer Comparison */}
      {activeTab === 0 && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap gap-4 items-start">
              <div className="flex-1 min-w-48">
                <label className="label block mb-1">Input Text</label>
                <input className="input" value={analyzeText} onChange={e => setAnalyzeText(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1">Analyzers</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_ANALYZERS.map(a => (
                    <button
                      key={a}
                      onClick={() => toggleAnalyzer(a)}
                      className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                        selectedAnalyzers.includes(a)
                          ? 'bg-indigo-900 border-indigo-600 text-indigo-200'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {analyzerResults.map(({ analyzer, tokens }) => (
              <div key={analyzer} className="card">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <span className="text-sm font-medium text-gray-200">{analyzer}</span>
                    <span className="text-xs text-gray-500 ml-2">({tokens.length} tokens)</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2">{ANALYZER_DESCRIPTIONS[analyzer]}</p>
                <div className="min-h-8">
                  {tokens.map((t, i) => (
                    <TokenBadge key={i} token={t.term} type={t.type} />
                  ))}
                </div>
                {analyzer === 'edge_ngram' && (
                  <div className="mt-2 text-xs text-gray-600">
                    Showing prefixes — used for autocomplete. Full index would have {tokens.length} edge n-gram tokens.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: Stemming */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Porter Stemming Examples</div>
            <div className="space-y-2">
              {stemmingExamples.map(({ word, stem: stemmed, tokens }) => (
                <div key={word} className="flex items-center gap-3 py-2 border-b border-gray-800 text-sm">
                  <span className="text-gray-300 w-32 shrink-0 font-mono">"{word}"</span>
                  <span className="text-gray-500">→</span>
                  <div className="flex flex-wrap gap-1">
                    {tokens.map((t, i) => (
                      <TokenBadge key={i} token={t} type="word" />
                    ))}
                  </div>
                  <span className="text-xs text-gray-600">stem: "{stemmed}"</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-2">Try Your Own Word</div>
            <input className="input mb-3" value={stemmingWord} onChange={e => setStemmingWord(e.target.value)} placeholder="Enter a word..." />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28">Input:</span>
                <TokenBadge token={stemmingWord} type="word" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28">Stemmed:</span>
                <TokenBadge token={stem(stemmingWord.toLowerCase())} type="word" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-28">English tokens:</span>
                {analyzeQuery(stemmingWord, 'english').map((t, i) => (
                  <TokenBadge key={i} token={t} type="word" />
                ))}
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-800/50 rounded-lg text-xs text-yellow-200">
              <strong>Precision pitfall:</strong> "running" → "run" helps recall ("runs" matches "running search") but
              hurts precision — "she runs a company" might match "running shoes" searches because both stem to "run".
              Use <code className="bg-gray-900 px-1 rounded">english_unstemmed</code> for phrase matching to avoid this.
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Synonyms */}
      {activeTab === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Synonym Expansion</div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={synonymQuery} onChange={e => setSynonymQuery(e.target.value)} placeholder="e.g., tv, laptop, phone" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 shrink-0">Original:</span>
                {synonymExpanded.original.map((t, i) => <TokenBadge key={i} token={t} type="word" />)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-500 shrink-0">Expanded:</span>
                {synonymExpanded.expanded.map((t, i) => <TokenBadge key={i} token={t} type="word" />)}
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs text-gray-500 font-medium mb-2">Synonym Groups:</div>
              <div className="space-y-1">
                {Object.entries(SYNONYMS).filter(([, v]) => v.length > 1).slice(0, 8).map(([key, vals]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-indigo-400 font-mono w-20 shrink-0">{key}</span>
                    <span className="text-gray-600">↔</span>
                    <div className="flex gap-1 flex-wrap">
                      {vals.map(v => <TokenBadge key={v} token={v} type="word" />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Search Results Comparison</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-2">Without Synonyms</div>
                {synResults.without.hits.slice(0, 5).map(h => (
                  <div key={h.product.product_id} className="text-xs py-1 border-b border-gray-800 truncate text-gray-400">{h.product.title}</div>
                ))}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">With Synonyms</div>
                {synResults.with.hits.slice(0, 5).map(h => (
                  <div key={h.product.product_id} className="text-xs py-1 border-b border-gray-800 truncate text-gray-300">{h.product.title}</div>
                ))}
              </div>
            </div>
            <div className="mt-3 p-3 bg-indigo-950/30 border border-indigo-800/50 rounded-lg text-xs text-indigo-200">
              <strong>Index-time vs Query-time synonyms:</strong> Index-time synonyms increase index size but are transparent to query parsing.
              Query-time synonyms (synonym_graph filter) are easier to update without reindexing but require multi-term synonym handling.
              For production, query-time synonyms in a search_analyzer are usually preferred.
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Edge N-gram vs Completion */}
      {activeTab === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card lg:col-span-2">
            <div className="flex gap-2 mb-4">
              <input
                className="input"
                value={autocompleteText}
                onChange={e => setAutocompleteText(e.target.value)}
                placeholder="Start typing to see autocomplete..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium text-green-400 mb-2">Edge N-gram (prefix match)</div>
                <div className="text-xs text-gray-500 mb-2">Indexes prefixes at index time. Fast O(1) lookup at query time.</div>
                {autocompleteEdgeNgram.hits.slice(0, 6).map((h, i) => (
                  <div key={h.product.product_id} className="py-1.5 border-b border-gray-800 text-xs">
                    <span className="text-gray-500 w-4 inline-block">{i + 1}</span>
                    <span className="text-gray-200">{h.product.title}</span>
                  </div>
                ))}
                {autocompleteEdgeNgram.hits.length === 0 && <div className="text-xs text-gray-600">No matches</div>}
                <div className="mt-2 text-xs text-gray-600">Took: {autocompleteEdgeNgram.took}ms</div>
              </div>
              <div>
                <div className="text-xs font-medium text-indigo-400 mb-2">match_phrase_prefix (query time)</div>
                <div className="text-xs text-gray-500 mb-2">Expands last term to all matching prefixes. No special index config needed.</div>
                {autocompletePhrase.hits.slice(0, 6).map((h, i) => (
                  <div key={h.product.product_id} className="py-1.5 border-b border-gray-800 text-xs">
                    <span className="text-gray-500 w-4 inline-block">{i + 1}</span>
                    <span className="text-gray-200">{h.product.title}</span>
                  </div>
                ))}
                {autocompletePhrase.hits.length === 0 && <div className="text-xs text-gray-600">No matches</div>}
                <div className="mt-2 text-xs text-gray-600">Took: {autocompletePhrase.took}ms</div>
              </div>
            </div>
          </div>
          <div className="card lg:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-green-950/20 border border-green-800/30 rounded-lg">
              <div className="font-medium text-green-400 mb-1">Edge N-gram</div>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>Pre-indexed — fast at query time</li>
                <li>Increases index size 3-5x</li>
                <li>Accurate prefix matching</li>
                <li>Best for title and brand fields</li>
              </ul>
            </div>
            <div className="p-3 bg-indigo-950/20 border border-indigo-800/30 rounded-lg">
              <div className="font-medium text-indigo-400 mb-1">match_phrase_prefix</div>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>No extra index config</li>
                <li>max_expansions controls cost</li>
                <li>Good for low-traffic apps</li>
                <li>Slower on large indexes</li>
              </ul>
            </div>
            <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
              <div className="font-medium text-purple-400 mb-1">Completion Suggester</div>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>FST in-memory — extremely fast</li>
                <li>Supports context filters</li>
                <li>Fuzzy prefix matching</li>
                <li>Limited to prefix, not substring</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Part Number */}
      {activeTab === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Part Number Search</div>
            <div className="flex gap-2 mb-4">
              <input className="input" value={partNumberQuery} onChange={e => setPartNumberQuery(e.target.value)} placeholder="e.g., D850, LPT-DL, NK-D850" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-indigo-400 mb-2">With part_number_analyzer (SKU field):</div>
                {partNumberResults.withPN.hits.map(h => (
                  <div key={h.product.product_id} className="py-1.5 border-b border-gray-800 text-xs flex justify-between">
                    <div>
                      <span className="text-gray-200">{h.product.title}</span>
                      <span className="text-gray-500 ml-2 font-mono">{h.product.sku}</span>
                    </div>
                    <span className="score-badge">{h.score.toFixed(2)}</span>
                  </div>
                ))}
                {partNumberResults.withPN.hits.length === 0 && <div className="text-xs text-gray-600">No SKU matches — try CAM, LPT, NK, or SN</div>}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">Tokenization Comparison</div>
            <div className="space-y-4 text-xs">
              <div>
                <div className="text-gray-500 mb-1">SKU: "CAM-NK-D850-BDY"</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-600 w-28">standard:</span>
                  {analyzeQuery('CAM-NK-D850-BDY', 'standard').map((t, i) => <TokenBadge key={i} token={t} type="word" />)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 w-28">part_number:</span>
                  {analyze('CAM-NK-D850-BDY', 'part_number').map((t, i) => <TokenBadge key={i} token={t.term} type="part_number" />)}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">User query: "{partNumberQuery}"</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-600 w-28">standard:</span>
                  {analyzeQuery(partNumberQuery, 'standard').map((t, i) => <TokenBadge key={i} token={t} type="word" />)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 w-28">part_number:</span>
                  {analyze(partNumberQuery, 'part_number').map((t, i) => <TokenBadge key={i} token={t.term} type="part_number" />)}
                </div>
              </div>
              <div className="p-3 bg-yellow-950/20 border border-yellow-800/30 rounded-lg">
                With the standard analyzer, "D850" is one token and won't match "CAM-NK-D850-BDY"
                (which gets tokenized as "cam", "nk", "d850", "bdy"). With part_number_analyzer,
                "D850" → "d850" which matches perfectly.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: copy_to vs Multi-field */}
      {activeTab === 5 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-2">copy_to: search_all field</div>
            <div className="text-xs text-gray-400 leading-relaxed mb-3">
              <strong className="text-gray-300">copy_to</strong> copies values from multiple fields into a single field at index time.
              The combined field has one unified term dictionary and IDF space — a term appearing in both title and description
              has the same IDF as if it appeared in one large field.
            </div>
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300">
              <div className="text-gray-500 mb-1">// Mapping definition:</div>
              <div>{'{'}</div>
              <div className="ml-4">"title": {'{'} "copy_to": "search_all" {'}'},</div>
              <div className="ml-4">"brand": {'{'} "copy_to": "search_all" {'}'},</div>
              <div className="ml-4">"description": {'{'} "copy_to": "search_all" {'}'},</div>
              <div className="ml-4">"search_all": {'{'} "type": "text" {'}'}</div>
              <div>{'}'}</div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <strong className="text-green-400">Pros:</strong> Simpler queries, unified IDF, lower query overhead.<br/>
              <strong className="text-red-400">Cons:</strong> Can't boost individual fields, no per-field scoring.
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-2">multi-field: separate scoring per field</div>
            <div className="text-xs text-gray-400 leading-relaxed mb-3">
              <strong className="text-gray-300">multi_match</strong> queries each field separately with its own IDF universe.
              A term appearing in title gets IDF computed from title-only, giving it appropriate rarity weight for that field.
              This is why rare brand names in title rank high — they're rare in that IDF space.
            </div>
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300">
              <div className="text-gray-500 mb-1">// Query using multi-field:</div>
              <div>{'{'}</div>
              <div className="ml-4">"multi_match": {'{'}</div>
              <div className="ml-8">"query": "sony camera",</div>
              <div className="ml-8">"fields": ["title^3", "brand^2", "description"],</div>
              <div className="ml-8">"type": "best_fields",</div>
              <div className="ml-8">"tie_breaker": 0.3</div>
              <div className="ml-4">{'}'},</div>
              <div>{'}'}</div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <strong className="text-green-400">Pros:</strong> Per-field boost, different analyzers per field.<br/>
              <strong className="text-red-400">Cons:</strong> More complex, IDF can be biased by field content.
            </div>
          </div>
          <div className="card lg:col-span-2">
            <div className="text-sm font-medium text-gray-300 mb-2">Live Comparison: "sony camera"</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-green-400 mb-2">copy_to approach (search_all)</div>
                {copyToResults.hits.slice(0, 5).map(h => (
                  <div key={h.product.product_id} className="text-xs py-1 border-b border-gray-800 flex justify-between">
                    <span className="text-gray-300 truncate">{h.product.title}</span>
                    <span className="score-badge">{h.score.toFixed(3)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-indigo-400 mb-2">multi-field (title^3 + brand^2 + desc)</div>
                {multiMatch({ query: 'sony camera', fields: ['title'], boost: {}, size: 5 }).hits.map(h => (
                  <div key={h.product.product_id} className="text-xs py-1 border-b border-gray-800 flex justify-between">
                    <span className="text-gray-300 truncate">{h.product.title}</span>
                    <span className="score-badge">{h.score.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
