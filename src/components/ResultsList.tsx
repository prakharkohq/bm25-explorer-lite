import { SearchHit } from '../lib/bm25'

interface Props {
  hits: SearchHit[]
  total: number
  took: number
  onSelect?: (hit: SearchHit) => void
  selectedId?: string
}

export default function ResultsList({ hits, total, took, onSelect, selectedId }: Props) {
  if (hits.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-2">🔍</div>
        <p>No results found. Try a different query.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
        <span>{total} hits</span>
        <span className="font-mono">{took}ms</span>
      </div>
      <div className="space-y-2">
        {hits.map((hit, idx) => (
          <div
            key={hit.product.product_id}
            onClick={() => onSelect?.(hit)}
            className={`card cursor-pointer transition-all hover:border-indigo-700 ${
              selectedId === hit.product.product_id ? 'border-indigo-600 bg-indigo-950/30' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-lg font-bold text-gray-600 w-6 shrink-0 text-right">{idx + 1}</span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-100 text-sm leading-tight">{hit.product.title}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-indigo-400 font-medium">{hit.product.brand}</span>
                    <span className="text-xs text-gray-500">{hit.product.category_path}</span>
                    <span className="text-xs text-green-400 font-mono">${hit.product.price.toFixed(2)}</span>
                    {!hit.product.in_stock && (
                      <span className="text-xs text-red-500">Out of stock</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-1">{hit.product.description.slice(0, 120)}…</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="score-badge">{hit.score.toFixed(4)}</div>
                <div className="text-xs text-gray-600 mt-1">pop: {hit.product.popularity_score}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
