import { SearchHit } from '../lib/bm25'

interface Props {
  leftLabel: string
  rightLabel: string
  leftHits: SearchHit[]
  rightHits: SearchHit[]
}

export default function SideBySide({ leftLabel, rightLabel, leftHits, rightHits }: Props) {
  const leftIds = leftHits.map(h => h.product.product_id)
  const rightIds = rightHits.map(h => h.product.product_id)

  function rankChange(id: string, isLeft: boolean): string {
    if (isLeft) {
      const rightIdx = rightIds.indexOf(id)
      return rightIdx === -1 ? 'new' : rightIdx < leftIds.indexOf(id) ? 'down' : rightIdx > leftIds.indexOf(id) ? 'up' : 'same'
    } else {
      const leftIdx = leftIds.indexOf(id)
      return leftIdx === -1 ? 'new' : leftIdx < rightIds.indexOf(id) ? 'down' : leftIdx > rightIds.indexOf(id) ? 'up' : 'same'
    }
  }

  function RankBadge({ change }: { change: string }) {
    if (change === 'up') return <span className="text-green-400 text-xs">↑</span>
    if (change === 'down') return <span className="text-red-400 text-xs">↓</span>
    if (change === 'new') return <span className="text-yellow-400 text-xs">★</span>
    return null
  }

  const HitRow = ({ hit, isLeft }: { hit: SearchHit; isLeft: boolean }) => {
    const idx = isLeft ? leftIds.indexOf(hit.product.product_id) : rightIds.indexOf(hit.product.product_id)
    const change = rankChange(hit.product.product_id, isLeft)
    const inOther = isLeft ? rightIds.includes(hit.product.product_id) : leftIds.includes(hit.product.product_id)

    return (
      <div className={`card mb-2 text-xs ${!inOther ? 'border-yellow-800/50 bg-yellow-950/10' : ''}`}>
        <div className="flex items-start gap-2">
          <span className="text-gray-600 w-4 shrink-0">{idx + 1}</span>
          <RankBadge change={change} />
          <div className="min-w-0 flex-1">
            <div className="text-gray-200 font-medium truncate">{hit.product.title}</div>
            <div className="text-gray-500 mt-0.5">{hit.product.brand} · {hit.product.category_path.split(' > ').pop()}</div>
          </div>
          <span className="score-badge shrink-0">{hit.score.toFixed(3)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium text-indigo-400 mb-3 flex items-center gap-2">
          <span>🅐</span>
          <span>{leftLabel}</span>
          <span className="text-gray-600">({leftHits.length} hits)</span>
        </div>
        {leftHits.map(hit => <HitRow key={hit.product.product_id} hit={hit} isLeft={true} />)}
      </div>
      <div>
        <div className="text-xs font-medium text-purple-400 mb-3 flex items-center gap-2">
          <span>🅑</span>
          <span>{rightLabel}</span>
          <span className="text-gray-600">({rightHits.length} hits)</span>
        </div>
        {rightHits.map(hit => <HitRow key={hit.product.product_id} hit={hit} isLeft={false} />)}
      </div>
    </div>
  )
}
