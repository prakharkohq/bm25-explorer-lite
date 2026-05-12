import { Product, PRODUCTS } from '../data/products'
import { analyzeQuery, expandSynonyms, AnalyzerName } from './analyzer'
import { stem } from './stemmer'

export interface ExplainNode {
  value: number
  description: string
  details?: ExplainNode[]
}

export interface SearchHit {
  product: Product
  score: number
  explain?: ExplainNode
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  took: number
  queryJson: object
}

type FieldName = keyof Pick<Product, 'title' | 'description' | 'brand' | 'tags' | 'bullet_features' | 'sku' | 'category_path'>

const SEARCHABLE_FIELDS: FieldName[] = ['title', 'description', 'brand', 'bullet_features', 'tags', 'sku', 'category_path']

function getFieldText(product: Product, field: FieldName): string {
  const v = product[field]
  if (Array.isArray(v)) return v.join(' ')
  return String(v)
}

interface FieldIndex {
  termFreqs: Map<string, Map<string, number>> // productId -> term -> freq
  docFreqs: Map<string, number>               // term -> doc count
  fieldLengths: Map<string, number>           // productId -> token count
  avgLength: number
  N: number
}

interface Index {
  fields: Map<FieldName, FieldIndex>
}

let _index: Index | null = null

function buildFieldIndex(field: FieldName, analyzer: AnalyzerName): FieldIndex {
  const termFreqs = new Map<string, Map<string, number>>()
  const docFreqs = new Map<string, number>()
  const fieldLengths = new Map<string, number>()
  let totalLength = 0

  for (const product of PRODUCTS) {
    const text = getFieldText(product, field)
    const tokens = analyzeQuery(text, analyzer)
    fieldLengths.set(product.product_id, tokens.length)
    totalLength += tokens.length

    const tf = new Map<string, number>()
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1)
    }
    termFreqs.set(product.product_id, tf)

    for (const term of tf.keys()) {
      docFreqs.set(term, (docFreqs.get(term) ?? 0) + 1)
    }
  }

  return {
    termFreqs,
    docFreqs,
    fieldLengths,
    avgLength: totalLength / PRODUCTS.length,
    N: PRODUCTS.length,
  }
}

function getIndex(): Index {
  if (_index) return _index

  const fieldAnalyzers: Record<FieldName, AnalyzerName> = {
    title: 'english',
    description: 'english',
    brand: 'english_unstemmed',
    bullet_features: 'english',
    tags: 'keyword',
    sku: 'part_number',
    category_path: 'english_unstemmed',
  }

  const fields = new Map<FieldName, FieldIndex>()
  for (const field of SEARCHABLE_FIELDS) {
    fields.set(field, buildFieldIndex(field, fieldAnalyzers[field]))
  }

  _index = { fields }
  return _index
}

export function bm25Score(
  productId: string,
  term: string,
  field: FieldName,
  fieldIndex: FieldIndex,
  k1: number,
  b: number,
): { score: number; tf: number; idf: number; fieldLen: number; avgLen: number } {
  const tf = fieldIndex.termFreqs.get(productId)?.get(term) ?? 0
  const df = fieldIndex.docFreqs.get(term) ?? 0
  const N = fieldIndex.N
  const fieldLen = fieldIndex.fieldLengths.get(productId) ?? 0
  const avgLen = fieldIndex.avgLength

  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
  const tfNorm = tf === 0 ? 0 : (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (fieldLen / avgLen)))
  const score = idf * tfNorm

  return { score, tf, idf, fieldLen, avgLen }
}

export function buildExplain(
  product: Product,
  terms: string[],
  field: FieldName,
  k1: number,
  b: number,
): ExplainNode {
  const index = getIndex()
  const fieldIndex = index.fields.get(field)!
  const details: ExplainNode[] = []
  let total = 0

  for (const term of terms) {
    const { score, tf, idf, fieldLen, avgLen } = bm25Score(product.product_id, term, field, fieldIndex, k1, b)
    total += score
    details.push({
      value: score,
      description: `term "${term}" in field "${field}"`,
      details: [
        { value: idf, description: `idf = ln(1 + (${fieldIndex.N} - ${fieldIndex.docFreqs.get(term) ?? 0} + 0.5) / (${fieldIndex.docFreqs.get(term) ?? 0} + 0.5))` },
        { value: tf, description: `tf = ${tf} occurrences in this field` },
        {
          value: (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (fieldLen / avgLen))),
          description: `tf_norm = tf*(k1+1) / (tf + k1*(1-b+b*fieldLen/avgLen)) where k1=${k1}, b=${b}, fieldLen=${fieldLen}, avgLen=${avgLen.toFixed(1)}`,
        },
      ],
    })
  }

  return {
    value: total,
    description: `BM25 score for field "${field}"`,
    details,
  }
}

export interface MultiMatchOptions {
  query: string
  fields?: FieldName[]
  type?: 'best_fields' | 'most_fields' | 'cross_fields'
  tieBreaker?: number
  k1?: number
  b?: number
  boost?: Partial<Record<FieldName, number>>
  withExplain?: boolean
  useSynonyms?: boolean
  size?: number
  filters?: Array<(p: Product) => boolean>
  rescore?: { windowSize: number; rescoreQuery: (p: Product) => number }
}

export function multiMatch(opts: MultiMatchOptions): SearchResult {
  const t0 = performance.now()
  const {
    query,
    fields = ['title', 'brand', 'description'],
    type = 'best_fields',
    tieBreaker = 0,
    k1 = 1.2,
    b = 0.75,
    boost = {},
    withExplain = false,
    useSynonyms = false,
    size = 10,
    filters = [],
  } = opts

  const index = getIndex()
  let queryTerms = analyzeQuery(query, 'english')
  if (useSynonyms) {
    queryTerms = expandSynonyms(queryTerms)
  }

  if (queryTerms.length === 0) {
    return { hits: [], total: 0, took: 0, queryJson: {} }
  }

  const candidates = PRODUCTS.filter(p => filters.every(f => f(p)))

  const scores = candidates.map(product => {
    const fieldScores: number[] = []
    const explainDetails: ExplainNode[] = []

    for (const field of fields as FieldName[]) {
      const fieldIndex = index.fields.get(field)
      if (!fieldIndex) continue
      const fieldBoost = (boost[field] ?? 1)
      let fieldScore = 0

      for (const term of queryTerms) {
        const { score } = bm25Score(product.product_id, term, field, fieldIndex, k1, b)
        fieldScore += score * fieldBoost
      }

      fieldScores.push(fieldScore)
      if (withExplain) {
        explainDetails.push(buildExplain(product, queryTerms, field, k1, b))
      }
    }

    let totalScore: number
    if (type === 'best_fields') {
      const maxScore = Math.max(...fieldScores, 0)
      const otherSum = fieldScores.filter(s => s !== maxScore).reduce((a, b) => a + b, 0)
      totalScore = maxScore + tieBreaker * otherSum
    } else if (type === 'most_fields') {
      totalScore = fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length
    } else {
      // cross_fields: merge all fields into one virtual doc
      let crossScore = 0
      for (const term of queryTerms) {
        let termScore = 0
        for (const field of fields as FieldName[]) {
          const fieldIndex = index.fields.get(field)!
          const { score } = bm25Score(product.product_id, term, field, fieldIndex, k1, b)
          termScore = Math.max(termScore, score)
        }
        crossScore += termScore
      }
      totalScore = crossScore
    }

    const explain: ExplainNode | undefined = withExplain
      ? { value: totalScore, description: `multi_match (${type})`, details: explainDetails }
      : undefined

    return { product, score: totalScore, explain }
  })

  if (opts.rescore) {
    const { windowSize, rescoreQuery } = opts.rescore
    const top = scores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, windowSize)

    for (const hit of top) {
      hit.score = hit.score * 0.7 + rescoreQuery(hit.product) * 0.3
    }
  }

  const sorted = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, size)

  const took = Math.round(performance.now() - t0)

  const queryJson = buildQueryJson(opts)

  return { hits: sorted, total: sorted.length, took, queryJson }
}

function buildQueryJson(opts: MultiMatchOptions): object {
  const { query, fields = ['title', 'brand', 'description'], type = 'best_fields', k1 = 1.2, b = 0.75, tieBreaker = 0 } = opts
  return {
    query: {
      multi_match: {
        query,
        fields,
        type,
        tie_breaker: tieBreaker > 0 ? tieBreaker : undefined,
      },
    },
    similarity: { default: { type: 'BM25', k1, b } },
    size: opts.size ?? 10,
  }
}

export function phraseMatch(query: string, field: FieldName = 'title', slop = 0, size = 10): SearchResult {
  const t0 = performance.now()
  const terms = analyzeQuery(query, 'english')
  if (terms.length === 0) return { hits: [], total: 0, took: 0, queryJson: {} }

  const index = getIndex()
  const fieldIndex = index.fields.get(field)!

  const scores = PRODUCTS.map(product => {
    const text = getFieldText(product, field)
    const docTerms = analyzeQuery(text, 'english')

    let matchScore = 0
    for (let i = 0; i <= docTerms.length - terms.length; i++) {
      let matches = 0
      let lastPos = -1
      let distance = 0
      for (let j = 0; j < terms.length; j++) {
        const pos = docTerms.indexOf(terms[j], i + j)
        if (pos >= 0 && (lastPos === -1 || Math.abs(pos - lastPos - 1) <= slop)) {
          matches++
          distance += lastPos >= 0 ? Math.abs(pos - lastPos - 1) : 0
          lastPos = pos
        }
      }
      if (matches === terms.length) {
        let score = 0
        for (const term of terms) {
          const { score: s } = bm25Score(product.product_id, term, field, fieldIndex, 1.2, 0.75)
          score += s
        }
        matchScore = Math.max(matchScore, score * Math.max(0.1, 1 - distance * 0.1))
      }
    }

    return { product, score: matchScore, explain: undefined }
  })

  const sorted = scores.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, size)
  const took = Math.round(performance.now() - t0)

  return {
    hits: sorted,
    total: sorted.length,
    took,
    queryJson: { query: { match_phrase: { [field]: { query, slop } } }, size },
  }
}

export function functionScore(
  baseQuery: string,
  functions: Array<{ type: 'field_value_factor' | 'gauss' | 'random'; field?: keyof Product; factor?: number; modifier?: string }>,
  boostMode: 'multiply' | 'sum' | 'replace' = 'multiply',
  size = 10,
): SearchResult {
  const t0 = performance.now()
  const baseResult = multiMatch({ query: baseQuery, size: PRODUCTS.length })
  const maxBase = Math.max(...baseResult.hits.map(h => h.score), 1)

  const scored = baseResult.hits.map(({ product, score }) => {
    let funcScore = 1
    for (const fn of functions) {
      if (fn.type === 'field_value_factor' && fn.field) {
        const val = Number(product[fn.field]) || 0
        const normalized = val / 1000
        funcScore *= fn.factor ? normalized * fn.factor : normalized
      } else if (fn.type === 'gauss') {
        const ageDays = (Date.now() - new Date(product.created_at).getTime()) / 86400000
        funcScore *= Math.exp(-Math.pow(ageDays / 365, 2) * 0.5)
      } else if (fn.type === 'random') {
        funcScore *= 0.5 + (Math.sin(product.product_id.charCodeAt(5) * 997) * 0.5 + 0.5) * 0.5
      }
    }

    const normalizedBase = score / maxBase
    let finalScore: number
    if (boostMode === 'multiply') finalScore = normalizedBase * funcScore
    else if (boostMode === 'sum') finalScore = normalizedBase + funcScore
    else finalScore = funcScore

    return { product, score: finalScore, explain: undefined }
  })

  const sorted = scored.sort((a, b) => b.score - a.score).slice(0, size)
  const took = Math.round(performance.now() - t0)

  return {
    hits: sorted,
    total: sorted.length,
    took,
    queryJson: {
      query: {
        function_score: {
          query: { multi_match: { query: baseQuery, fields: ['title', 'brand', 'description'] } },
          functions: functions.map(f => ({
            ...(f.type === 'field_value_factor' ? { field_value_factor: { field: f.field, factor: f.factor, modifier: f.modifier ?? 'none' } } : {}),
            ...(f.type === 'gauss' ? { gauss: { created_at: { origin: 'now', scale: '365d', decay: 0.5 } } } : {}),
            ...(f.type === 'random' ? { random_score: {} } : {}),
          })),
          boost_mode: boostMode,
        },
      },
      size,
    },
  }
}

export function moreLikeThis(productId: string, size = 10): SearchResult {
  const t0 = performance.now()
  const source = PRODUCTS.find(p => p.product_id === productId)
  if (!source) return { hits: [], total: 0, took: 0, queryJson: {} }

  const titleTerms = analyzeQuery(source.title, 'english').slice(0, 5)
  const descTerms = analyzeQuery(source.description, 'english')
    .filter(t => t.length > 4)
    .slice(0, 5)
  const likeTerms = [...new Set([...titleTerms, ...descTerms])]

  const result = multiMatch({ query: likeTerms.join(' '), fields: ['title', 'description', 'brand'], size: size + 1 })
  const hits = result.hits.filter(h => h.product.product_id !== productId).slice(0, size)

  return {
    hits,
    total: hits.length,
    took: Math.round(performance.now() - t0),
    queryJson: {
      query: {
        more_like_this: {
          fields: ['title', 'description', 'brand'],
          like: [{ _id: productId }],
          min_term_freq: 1,
          min_doc_freq: 1,
        },
      },
      size,
    },
  }
}

export function wildcardSearch(pattern: string, field: FieldName = 'title', size = 10): SearchResult {
  const t0 = performance.now()
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')

  const hits = PRODUCTS.filter(p => {
    const text = getFieldText(p, field)
    return text.split(/\s+/).some(w => re.test(w))
  }).slice(0, size).map(product => ({ product, score: 1.0, explain: undefined }))

  const took = Math.round(performance.now() - t0)
  return {
    hits,
    total: hits.length,
    took,
    queryJson: { query: { wildcard: { [field]: { value: pattern } } }, size },
  }
}

export function prefixSearch(prefix: string, field: FieldName = 'title', size = 10): SearchResult {
  const t0 = performance.now()
  const lower = prefix.toLowerCase()

  const hits = PRODUCTS.filter(p => {
    const text = getFieldText(p, field).toLowerCase()
    return text.split(/\s+/).some(w => w.startsWith(lower))
  }).slice(0, size).map(product => ({ product, score: 1.0, explain: undefined }))

  const took = Math.round(performance.now() - t0)
  return {
    hits,
    total: hits.length,
    took,
    queryJson: { query: { prefix: { [field]: { value: prefix } } }, size },
  }
}

export function matchPhrasePrefixSearch(query: string, field: FieldName = 'title', size = 10): SearchResult {
  const t0 = performance.now()
  const terms = analyzeQuery(query, 'english')
  if (terms.length === 0) return { hits: [], total: 0, took: 0, queryJson: {} }

  const lastTerm = terms[terms.length - 1]
  const prefixTerms = terms.slice(0, -1)

  const hits = PRODUCTS.filter(p => {
    const docTerms = analyzeQuery(getFieldText(p, field), 'english')
    if (prefixTerms.length === 0) return docTerms.some(t => t.startsWith(lastTerm))
    for (let i = 0; i <= docTerms.length - prefixTerms.length; i++) {
      let match = true
      for (let j = 0; j < prefixTerms.length; j++) {
        if (docTerms[i + j] !== prefixTerms[j]) { match = false; break }
      }
      if (match && docTerms[i + prefixTerms.length]?.startsWith(lastTerm)) return true
    }
    return false
  })
    .map(product => ({ product, score: 1.0, explain: undefined }))
    .slice(0, size)

  const took = Math.round(performance.now() - t0)
  return {
    hits,
    total: hits.length,
    took,
    queryJson: { query: { match_phrase_prefix: { [field]: { query } } }, size },
  }
}

export function constantScore(filter: (p: Product) => boolean, boost = 1.0, size = 10): SearchResult {
  const t0 = performance.now()
  const hits = PRODUCTS.filter(filter).slice(0, size).map(product => ({ product, score: boost, explain: undefined }))
  const took = Math.round(performance.now() - t0)
  return {
    hits,
    total: hits.length,
    took,
    queryJson: { query: { constant_score: { filter: { match_all: {} }, boost } }, size },
  }
}

export function boolQuery(opts: {
  must?: string[]
  should?: string[]
  filter?: Array<(p: Product) => boolean>
  mustNot?: Array<(p: Product) => boolean>
  minimumShouldMatch?: number
  size?: number
}): SearchResult {
  const t0 = performance.now()
  const { must = [], should = [], filter = [], mustNot = [], minimumShouldMatch = 1, size = 10 } = opts

  const scored = PRODUCTS.map(product => {
    if (mustNot.some(fn => fn(product))) return null
    if (filter.length > 0 && !filter.every(fn => fn(product))) return null

    let score = 0

    for (const q of must) {
      const r = multiMatch({ query: q, size: 1, filters: [p => p.product_id === product.product_id] })
      if (r.hits.length === 0) return null
      score += r.hits[0]?.score ?? 0
    }

    let shouldMatches = 0
    for (const q of should) {
      const r = multiMatch({ query: q, size: 1, filters: [p => p.product_id === product.product_id] })
      if (r.hits.length > 0 && r.hits[0].score > 0) {
        shouldMatches++
        score += r.hits[0].score
      }
    }

    if (must.length === 0 && shouldMatches < minimumShouldMatch) return null
    if (score === 0 && filter.length === 0) return null

    return { product, score, explain: undefined }
  }).filter(Boolean) as SearchHit[]

  const sorted = scored.sort((a, b) => b.score - a.score).slice(0, size)
  const took = Math.round(performance.now() - t0)

  return {
    hits: sorted,
    total: sorted.length,
    took,
    queryJson: {
      query: {
        bool: {
          must: must.map(q => ({ match: { '_all': q } })),
          should: should.map(q => ({ match: { '_all': q } })),
          minimum_should_match: minimumShouldMatch,
        },
      },
      size,
    },
  }
}

export function termsLookup(brands: string[], size = 10): SearchResult {
  const t0 = performance.now()
  const brandSet = new Set(brands.map(b => b.toLowerCase()))
  const hits = PRODUCTS
    .filter(p => brandSet.has(p.brand.toLowerCase()))
    .map(p => ({ product: p, score: 1.0, explain: undefined }))
    .slice(0, size)
  const took = Math.round(performance.now() - t0)
  return {
    hits,
    total: hits.length,
    took,
    queryJson: {
      query: {
        terms: { brand: brands, boost: 1.0 },
      },
      size,
    },
  }
}

export function computeBM25TFCurve(k1: number, maxTF = 20): Array<{ tf: number; score: number }> {
  return Array.from({ length: maxTF + 1 }, (_, tf) => ({
    tf,
    score: tf === 0 ? 0 : (tf * (k1 + 1)) / (tf + k1),
  }))
}

export function computeBM25LengthCurve(b: number, k1: number, tf: number, maxLen = 200): Array<{ len: number; score: number }> {
  const avgLen = 50
  return Array.from({ length: maxLen + 1 }, (_, len) => ({
    len,
    score: len === 0 ? 0 : (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (len / avgLen))),
  }))
}

export { PRODUCTS, getIndex }
