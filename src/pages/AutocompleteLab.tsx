import { useState, useMemo, useCallback } from 'react'
import { prefixSearch, matchPhrasePrefixSearch, multiMatch } from '../lib/bm25'
import { PRODUCTS } from '../data/products'
import { analyzeQuery } from '../lib/analyzer'
import { stem } from '../lib/stemmer'

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function didYouMean(query: string): string | null {
  const terms = query.toLowerCase().split(/\s+/)
  const allTitles = PRODUCTS.map(p => p.title).join(' ').toLowerCase()
  const vocabSet = new Set<string>()
  allTitles.match(/[a-z]+/g)?.forEach(w => w.length > 3 && vocabSet.add(w))
  const vocab = Array.from(vocabSet)

  const corrected = terms.map(term => {
    if (vocabSet.has(term) || term.length <= 3) return term
    let best = term, bestDist = 2
    for (const word of vocab) {
      const d = levenshtein(term, word)
      if (d < bestDist) { best = word; bestDist = d }
    }
    return best
  })

  const result = corrected.join(' ')
  return result !== query ? result : null
}

export default function AutocompleteLab() {
  const [liveQuery, setLiveQuery] = useState('')
  const [completionQuery, setCompletionQuery] = useState('')
  const [didYouMeanQuery, setDidYouMeanQuery] = useState('cannn eos camra')
  const [activeTab, setActiveTab] = useState(0)

  const TABS = ['search_as_you_type', 'Completion Suggester', 'Edge N-gram vs Phrase Prefix', '"Did You Mean"']

  const liveResults = useMemo(() => {
    if (liveQuery.length < 2) return []
    return matchPhrasePrefixSearch(liveQuery, 'title', 8).hits
  }, [liveQuery])

  const completionResults = useMemo(() => {
    if (completionQuery.length < 2) return []
    const prefix = completionQuery.toLowerCase()
    return PRODUCTS
      .filter(p => p.title.toLowerCase().startsWith(prefix) || p.brand.toLowerCase().startsWith(prefix))
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, 8)
  }, [completionQuery])

  const edgeNgramResults = useMemo(() => {
    if (liveQuery.length < 2) return { edge: [], phrase: [] }
    return {
      edge: prefixSearch(liveQuery, 'title', 8).hits,
      phrase: matchPhrasePrefixSearch(liveQuery, 'title', 8).hits,
    }
  }, [liveQuery])

  const didYouMeanResult = useMemo(() => {
    const suggestion = didYouMean(didYouMeanQuery)
    const results = multiMatch({ query: didYouMeanQuery, fields: ['title', 'description'], size: 5 })
    const correctedResults = suggestion ? multiMatch({ query: suggestion, fields: ['title', 'description'], size: 5 }) : null
    return { suggestion, results, correctedResults }
  }, [didYouMeanQuery])

  const searchAsYouTypeInternal = useMemo(() => {
    if (liveQuery.length < 2) return null
    const twoGram = liveQuery.split(' ').filter(Boolean).slice(-2).join(' ')
    const threeGram = liveQuery.split(' ').filter(Boolean).slice(-3).join(' ')
    const prefix = liveQuery.split(' ').pop() ?? ''
    return {
      field: '_2gram, _3gram, or index_prefix based on query length',
      twoGram,
      threeGram,
      prefix,
      tokens: analyzeQuery(liveQuery, 'english'),
    }
  }, [liveQuery])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Autocomplete & Suggestions Lab</h2>
        <p className="text-sm text-gray-400 mt-1">Compare search-as-you-type approaches: edge n-gram, completion suggester, phrase prefix, and spell correction.</p>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-gray-800">
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

      {/* Tab 0: search_as_you_type */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="card">
              <label className="label block mb-2">Type to Search (search_as_you_type)</label>
              <input
                className="input text-lg"
                value={liveQuery}
                onChange={e => setLiveQuery(e.target.value)}
                placeholder="Start typing..."
                autoFocus
              />
              <div className="text-xs text-gray-600 mt-1">{liveQuery.length} chars typed</div>
            </div>

            {liveResults.length > 0 && (
              <div className="card">
                <div className="label mb-2">Live Results</div>
                {liveResults.map((hit, i) => (
                  <div key={hit.product.product_id} className="flex items-center gap-2 py-2 border-b border-gray-800 text-sm">
                    <span className="text-gray-600 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-gray-200">{hit.product.title}</div>
                      <div className="text-xs text-gray-500">{hit.product.brand} · {hit.product.category_path.split(' > ').pop()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {liveQuery.length > 0 && liveResults.length === 0 && (
              <div className="card text-center py-8 text-gray-500 text-sm">
                No matches yet. Keep typing...
              </div>
            )}
          </div>

          <div className="space-y-4">
            {searchAsYouTypeInternal && (
              <div className="card">
                <div className="label mb-2">Internal Field Selection</div>
                <div className="text-xs text-gray-400 space-y-2">
                  <div className="p-2 bg-gray-800 rounded">
                    <div className="text-gray-500 mb-0.5">Query length: {liveQuery.length} chars</div>
                    {liveQuery.split(' ').length > 2 ? (
                      <div className="text-indigo-400">Using: _3gram + index_prefix</div>
                    ) : liveQuery.split(' ').length > 1 ? (
                      <div className="text-indigo-400">Using: _2gram + index_prefix</div>
                    ) : (
                      <div className="text-indigo-400">Using: index_prefix field</div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Prefix tokens:</div>
                    <div className="font-mono text-indigo-300">{liveQuery.split(' ').pop() ?? ''}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Analyzed tokens:</div>
                    <div className="flex flex-wrap gap-1">
                      {searchAsYouTypeInternal.tokens.map((t, i) => (
                        <span key={i} className="bg-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-300 block mb-1">search_as_you_type field type</strong>
              <p>Creates sub-fields automatically: <code className="bg-gray-800 px-1 rounded">_2gram</code>, <code className="bg-gray-800 px-1 rounded">_3gram</code>, and <code className="bg-gray-800 px-1 rounded">_index_prefix</code>.</p>
              <p className="mt-1">The query is a bool should across all sub-fields — longer n-gram matches score higher than single prefix matches, naturally ranking more complete matches first.</p>
              <p className="mt-1">No custom analyzer or mapping is needed beyond declaring the field as <code className="bg-gray-800 px-1 rounded">"type": "search_as_you_type"</code>.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Completion Suggester */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <label className="label block mb-2">Completion Suggester (FST-based)</label>
            <input
              className="input text-lg mb-4"
              value={completionQuery}
              onChange={e => setCompletionQuery(e.target.value)}
              placeholder="Start typing a brand or product..."
            />
            {completionResults.length > 0 && (
              <div className="space-y-1">
                {completionResults.map((product, i) => (
                  <div key={product.product_id} className="flex items-center gap-2 py-2 border-b border-gray-800">
                    <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-sm text-gray-200">{product.title}</div>
                      <div className="text-xs text-gray-500">{product.brand}</div>
                    </div>
                    <div className="text-xs text-gray-600">pop: {product.popularity_score}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">How Completion Suggester Works</div>
            <div className="space-y-3 text-xs text-gray-400">
              <div className="p-3 bg-gray-800 rounded-lg font-mono">
                <div className="text-gray-500 mb-1">// Mapping:</div>
                <div>{'{'}</div>
                <div className="ml-4">"title_suggest": {'{'}</div>
                <div className="ml-8">"type": "completion",</div>
                <div className="ml-8">"analyzer": "english",</div>
                <div className="ml-8">"contexts": [</div>
                <div className="ml-12">{'{"name": "category", "type": "category"},'}</div>
                <div className="ml-12">{'{"name": "brand", "type": "category"}'}</div>
                <div className="ml-8">]</div>
                <div className="ml-4">{'}'}</div>
                <div>{'}'}</div>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg font-mono">
                <div className="text-gray-500 mb-1">// Query with context filter:</div>
                <div>{'{'}</div>
                <div className="ml-4">"suggest": {'{'}</div>
                <div className="ml-8">"title-suggest": {'{'}</div>
                <div className="ml-12">"prefix": "sony",</div>
                <div className="ml-12">"completion": {'{'}</div>
                <div className="ml-16">"field": "title_suggest",</div>
                <div className="ml-16">"size": 8,</div>
                <div className="ml-16">"contexts": {'{'}</div>
                <div className="ml-20">"category": "Electronics"</div>
                <div className="ml-16">{'}'}</div>
                <div className="ml-12">{'}'}</div>
                <div className="ml-8">{'}'}</div>
                <div className="ml-4">{'}'}</div>
                <div>{'}'}</div>
              </div>
              <p>The completion suggester builds a <strong className="text-gray-300">Finite State Transducer (FST)</strong> in memory.
              Prefix lookup is O(prefix_length) — extremely fast regardless of index size.
              Context filtering narrows to a subset of completions.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Edge N-gram vs Phrase Prefix */}
      {activeTab === 2 && (
        <div className="space-y-4">
          <div className="card">
            <label className="label block mb-2">Query</label>
            <input className="input" value={liveQuery} onChange={e => setLiveQuery(e.target.value)} placeholder="e.g., sony mir, dell xp..." />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="text-xs font-medium text-green-400 mb-3">Edge N-gram (prefix field)</div>
              <div className="space-y-1">
                {edgeNgramResults.edge.map((hit, i) => (
                  <div key={hit.product.product_id} className="flex items-center gap-2 py-1.5 border-b border-gray-800 text-sm">
                    <span className="text-gray-600 w-4 text-xs">{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-gray-200 text-xs">{hit.product.title}</div>
                      <div className="text-gray-500 text-xs">{hit.product.brand}</div>
                    </div>
                  </div>
                ))}
                {edgeNgramResults.edge.length === 0 && <div className="text-xs text-gray-600 py-4 text-center">Type to search</div>}
              </div>
            </div>
            <div className="card">
              <div className="text-xs font-medium text-indigo-400 mb-3">match_phrase_prefix</div>
              <div className="space-y-1">
                {edgeNgramResults.phrase.map((hit, i) => (
                  <div key={hit.product.product_id} className="flex items-center gap-2 py-1.5 border-b border-gray-800 text-sm">
                    <span className="text-gray-600 w-4 text-xs">{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-gray-200 text-xs">{hit.product.title}</div>
                      <div className="text-gray-500 text-xs">{hit.product.brand}</div>
                    </div>
                  </div>
                ))}
                {edgeNgramResults.phrase.length === 0 && <div className="text-xs text-gray-600 py-4 text-center">Type to search</div>}
              </div>
            </div>
          </div>
          <div className="card grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-gray-300 font-medium mb-1">Edge N-gram</div>
              <ul className="text-gray-500 space-y-1 list-disc list-inside">
                <li>Indexed as 2-15 char prefixes</li>
                <li>Search time: O(1)</li>
                <li>Index size: larger</li>
                <li>Best for title autocomplete</li>
              </ul>
            </div>
            <div>
              <div className="text-gray-300 font-medium mb-1">match_phrase_prefix</div>
              <ul className="text-gray-500 space-y-1 list-disc list-inside">
                <li>No index overhead</li>
                <li>Search time: O(vocab matches)</li>
                <li>max_expansions limit</li>
                <li>Best for low-traffic apps</li>
              </ul>
            </div>
            <div>
              <div className="text-gray-300 font-medium mb-1">Completion Suggester</div>
              <ul className="text-gray-500 space-y-1 list-disc list-inside">
                <li>FST in memory</li>
                <li>Search time: O(prefix length)</li>
                <li>Context filtering</li>
                <li>Best for production at scale</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Did You Mean */}
      {activeTab === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">"Did You Mean" Spell Correction</div>
            <label className="label block mb-1">Misspelled Query</label>
            <input
              className="input mb-4"
              value={didYouMeanQuery}
              onChange={e => setDidYouMeanQuery(e.target.value)}
              placeholder="Type a misspelled query..."
            />

            {didYouMeanResult.suggestion && (
              <div className="p-3 bg-indigo-950/30 border border-indigo-700 rounded-lg mb-3">
                <div className="text-xs text-gray-400 mb-1">Did you mean:</div>
                <div className="text-indigo-300 font-medium">"{didYouMeanResult.suggestion}"</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-red-400 mb-2">Original: "{didYouMeanQuery}"</div>
                {didYouMeanResult.results.hits.slice(0, 5).map(h => (
                  <div key={h.product.product_id} className="text-xs py-1 border-b border-gray-800 truncate text-gray-400">{h.product.title}</div>
                ))}
                {didYouMeanResult.results.hits.length === 0 && (
                  <div className="text-xs text-gray-600 py-2">No results</div>
                )}
              </div>
              {didYouMeanResult.suggestion && didYouMeanResult.correctedResults && (
                <div>
                  <div className="text-xs text-green-400 mb-2">Corrected: "{didYouMeanResult.suggestion}"</div>
                  {didYouMeanResult.correctedResults.hits.slice(0, 5).map(h => (
                    <div key={h.product.product_id} className="text-xs py-1 border-b border-gray-800 truncate text-gray-200">{h.product.title}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="text-sm font-medium text-gray-300 mb-3">How ES phrase suggester works</div>
            <div className="text-xs text-gray-400 leading-relaxed space-y-3">
              <div className="p-3 bg-gray-800 rounded-lg font-mono">
                <div className="text-gray-500 mb-1">// ES phrase suggester:</div>
                <div>{'{"suggest": {"text": "cannn eos",'}</div>
                <div className="ml-4">{'  "my-suggestion": {'}</div>
                <div className="ml-8">{'  "phrase": {'}</div>
                <div className="ml-12">{'  "field": "title.trigram",'}</div>
                <div className="ml-12">{'  "size": 3,'}</div>
                <div className="ml-12">{'  "gram_size": 3,'}</div>
                <div className="ml-12">{'  "direct_generator": [{'}</div>
                <div className="ml-16">{'    "field": "title.trigram",'}</div>
                <div className="ml-16">{'    "suggest_mode": "missing"'}</div>
                <div className="ml-12">{'  }]'}</div>
                <div className="ml-8">{'  }'}</div>
                <div className="ml-4">{'  }'}</div>
                <div>{'}'}</div>
              </div>
              <p>The phrase suggester uses <strong className="text-gray-300">Levenshtein distance</strong> to generate candidate corrections,
              then ranks them by the smoothed language model probability of the corrected phrase using trigram statistics from the index.</p>
              <p>Our demo uses a simplified edit-distance approach. Production ES generates candidates using the index vocabulary and ranks by phrase likelihood.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
