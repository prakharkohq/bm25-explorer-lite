# bm25-explorer-lite

An interactive demo application that teaches every major Elasticsearch/OpenSearch lexical search concept at a principal-engineer level. Runs entirely in the browser — no server, no Elasticsearch required.

**[Live Demo →](https://prakharkohq.github.io/bm25-explorer-lite/)**

## Quick Start

```bash
git clone https://github.com/prakharkohq/bm25-explorer-lite
cd bm25-explorer-lite
npm install
npm run dev
```

Open http://localhost:5173/bm25-explorer-lite/

## Deploy to GitHub Pages

1. Fork/push this repo to GitHub
2. Go to **Settings → Pages → Source: GitHub Actions**
3. Push to `main` — the deploy workflow handles the rest

Your app will be live at `https://prakharkohq.github.io/bm25-explorer-lite/`

## Features

| Section | Concepts Covered |
|---|---|
| **Query Playground** | multi_match (best_fields, most_fields, cross_fields), bool, dis_max, match_phrase, match_phrase with slop, match_phrase_prefix, wildcard/regexp, prefix, terms_lookup, function_score, more_like_this, constant_score, bool+rescore |
| **BM25 Scoring Lab** | k1/b parameter tuning, TF saturation curves, length normalization, _explain tree decoder, negative scoring demo |
| **Analyzers Lab** | standard, english (stemmer), english_unstemmed, english_shingles, edge_ngram, part_number — token-by-token comparison, stemming precision/recall tradeoffs, synonym expansion, copy_to vs multi-field |
| **Performance Dashboard** | Filter cache visualization, cache-friendly date rounding, query profiler waterfall, wildcard vs match latency, bool clause explosion |
| **Autocomplete Lab** | search_as_you_type field type, completion suggester (FST), edge n-gram vs phrase prefix, "Did You Mean" spell correction |
| **Relevance Eval** | A/B side-by-side comparator with rank-change indicators, NDCG@10 calculator with live grading, zero-result rate monitor with categorization |

## Architecture

All search runs client-side in TypeScript:

- **Porter Stemmer**: `src/lib/stemmer.ts` — simplified Porter stemmer + stop words
- **Analyzers**: `src/lib/analyzer.ts` — standard, english, edge_ngram, shingles, part_number, keyword
- **BM25 Engine**: `src/lib/bm25.ts` — inverted index, IDF/TF computation, multi_match, phrase, wildcard, function_score, MLT, explain trees
- **Product Data**: `src/data/products.ts` — 500+ generated e-commerce products across 5 categories

The BM25 formula implemented:

```
score(D, Q) = Σ IDF(qᵢ) × tfNorm(qᵢ, D)

IDF(q)    = ln(1 + (N − df + 0.5) / (df + 0.5))
tfNorm    = tf × (k1 + 1) / (tf + k1 × (1 − b + b × len/avgLen))
```

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Recharts (data visualization)
- react-syntax-highlighter (JSON display)
- GitHub Actions (CI/CD to GitHub Pages)

## No Backend Needed

This is a fully static app deployable to GitHub Pages, Netlify, Vercel, or any CDN. The BM25 index is built in-memory on first load (~100ms for 500 products).
