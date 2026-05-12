import { useState } from 'react'
import { ExplainNode } from '../lib/bm25'

interface Props {
  node: ExplainNode
  depth?: number
}

function ExplainNodeView({ node, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.details && node.details.length > 0

  const color = node.value > 5 ? 'text-green-400' : node.value > 1 ? 'text-yellow-400' : 'text-gray-400'

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l border-gray-800 pl-3' : ''}`}>
      <div
        className={`flex items-start gap-2 py-1 ${hasChildren ? 'cursor-pointer hover:bg-gray-800/50 rounded px-1' : 'px-1'}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span className="text-gray-500 w-3 shrink-0 text-xs mt-0.5">{expanded ? '▼' : '▶'}</span>
        )}
        {!hasChildren && <span className="w-3 shrink-0" />}
        <span className={`font-mono text-xs shrink-0 ${color}`}>{node.value.toFixed(4)}</span>
        <span className="text-xs text-gray-400 leading-tight">{node.description}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.details!.map((child, i) => (
            <ExplainNodeView key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ExplainTree({ node }: { node: ExplainNode }) {
  return (
    <div className="explain-tree bg-gray-950 rounded-lg p-3 border border-gray-800">
      <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2">
        <span>🌳</span>
        <span>Score Breakdown</span>
        <span className="ml-auto font-mono text-indigo-400">total: {node.value.toFixed(4)}</span>
      </div>
      <ExplainNodeView node={node} depth={0} />
    </div>
  )
}
