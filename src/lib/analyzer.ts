import { stem, STOP_WORDS } from './stemmer'

export interface Token {
  term: string
  position: number
  startOffset: number
  endOffset: number
  type: string
}

export type AnalyzerName =
  | 'standard'
  | 'english'
  | 'english_unstemmed'
  | 'english_shingles'
  | 'edge_ngram'
  | 'part_number'
  | 'keyword'

export const ANALYZER_DESCRIPTIONS: Record<AnalyzerName, string> = {
  standard: 'Tokenizes on whitespace/punctuation, lowercases. No stop words or stemming.',
  english: 'Standard + lowercase + English stop words + Porter stemmer. Default for text fields.',
  english_unstemmed: 'Standard + lowercase + stop words removed. No stemming — preserves exact word forms.',
  english_shingles: 'English analyzer output then wrapped with shingles (bigrams + trigrams) for phrase proximity.',
  edge_ngram: 'Creates prefix tokens of length 2-15 for autocomplete. "canon" → "ca", "can", "cano", "canon".',
  part_number: 'Splits on hyphens, dots, underscores, lowercases. "CAM-NK-D850-BDY" → "cam", "nk", "d850", "bdy".',
  keyword: 'No tokenization — entire string as a single token. Used for exact-match fields like brand and tags.',
}

function tokenizeStandard(text: string): Array<{ term: string; start: number; end: number }> {
  const tokens: Array<{ term: string; start: number; end: number }> = []
  const re = /[a-zA-Z0-9]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    tokens.push({ term: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

export function analyze(text: string, analyzer: AnalyzerName): Token[] {
  if (analyzer === 'keyword') {
    return [{ term: text.toLowerCase(), position: 0, startOffset: 0, endOffset: text.length, type: 'word' }]
  }

  if (analyzer === 'part_number') {
    const tokens: Token[] = []
    const parts = text.split(/[-._\s]+/)
    let pos = 0
    let offset = 0
    for (const part of parts) {
      if (part.length > 0) {
        const start = text.toLowerCase().indexOf(part.toLowerCase(), offset)
        tokens.push({ term: part.toLowerCase(), position: pos++, startOffset: start, endOffset: start + part.length, type: 'part_number' })
        offset = start + part.length
      }
    }
    return tokens
  }

  const raw = tokenizeStandard(text)

  if (analyzer === 'edge_ngram') {
    const tokens: Token[] = []
    let pos = 0
    for (const { term, start, end } of raw) {
      for (let n = 2; n <= Math.min(term.length, 15); n++) {
        tokens.push({ term: term.slice(0, n), position: pos, startOffset: start, endOffset: end, type: 'edge_ngram' })
      }
      pos++
    }
    return tokens
  }

  let terms = raw
  if (analyzer !== 'standard') {
    terms = raw.filter(t => !STOP_WORDS.has(t.term))
  }

  if (analyzer === 'english_unstemmed') {
    return terms.map((t, i) => ({ term: t.term, position: i, startOffset: t.start, endOffset: t.end, type: 'word' }))
  }

  if (analyzer === 'english' || analyzer === 'english_shingles') {
    const stemmed = terms.map((t, i) => ({ term: stem(t.term), position: i, startOffset: t.start, endOffset: t.end, type: 'word' }))

    if (analyzer === 'english_shingles') {
      const result: Token[] = [...stemmed]
      for (let i = 0; i < stemmed.length - 1; i++) {
        result.push({ term: stemmed[i].term + ' ' + stemmed[i + 1].term, position: i, startOffset: stemmed[i].startOffset, endOffset: stemmed[i + 1].endOffset, type: 'shingle' })
      }
      for (let i = 0; i < stemmed.length - 2; i++) {
        result.push({ term: stemmed[i].term + ' ' + stemmed[i + 1].term + ' ' + stemmed[i + 2].term, position: i, startOffset: stemmed[i].startOffset, endOffset: stemmed[i + 2].endOffset, type: 'shingle' })
      }
      return result.sort((a, b) => a.position - b.position)
    }

    return stemmed
  }

  return terms.map((t, i) => ({ term: t.term, position: i, startOffset: t.start, endOffset: t.end, type: 'word' }))
}

export function analyzeQuery(text: string, analyzer: AnalyzerName): string[] {
  return analyze(text, analyzer).map(t => t.term)
}

export const SYNONYMS: Record<string, string[]> = {
  tv: ['television', 'tv', 'tele'],
  television: ['television', 'tv', 'tele'],
  laptop: ['laptop', 'notebook', 'computer'],
  notebook: ['laptop', 'notebook', 'computer'],
  phone: ['phone', 'mobile', 'cellphone', 'smartphone'],
  mobile: ['phone', 'mobile', 'cellphone', 'smartphone'],
  cellphone: ['phone', 'mobile', 'cellphone', 'smartphone'],
  smartphone: ['phone', 'mobile', 'cellphone', 'smartphone'],
  sneakers: ['sneakers', 'trainers', 'kicks', 'shoes'],
  trainers: ['sneakers', 'trainers', 'kicks', 'shoes'],
  kicks: ['sneakers', 'trainers', 'kicks', 'shoes'],
  headphones: ['headphones', 'headset', 'cans'],
  headset: ['headphones', 'headset', 'cans'],
  camera: ['camera', 'cam', 'dslr', 'mirrorless'],
  running: ['running', 'jogging', 'run'],
  jogging: ['running', 'jogging', 'run'],
}

export function expandSynonyms(terms: string[]): string[] {
  const expanded = new Set<string>()
  for (const term of terms) {
    expanded.add(term)
    const syns = SYNONYMS[term.toLowerCase()]
    if (syns) syns.forEach(s => expanded.add(s))
  }
  return Array.from(expanded)
}
