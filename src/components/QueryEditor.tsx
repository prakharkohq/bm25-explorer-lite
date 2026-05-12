import { useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface Props {
  value: object
  onChange?: (val: string) => void
  readOnly?: boolean
  label?: string
}

export default function QueryEditor({ value, onChange, readOnly = false, label = 'Query JSON' }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [error, setError] = useState('')
  const json = JSON.stringify(value, null, 2)

  function startEdit() {
    setEditVal(json)
    setEditMode(true)
    setError('')
  }

  function handleSave() {
    try {
      const parsed = JSON.parse(editVal)
      onChange?.(JSON.stringify(parsed))
      setEditMode(false)
      setError('')
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="label">{label}</span>
        {!readOnly && (
          editMode ? (
            <div className="flex gap-2">
              <button className="text-xs text-gray-400 hover:text-gray-200" onClick={() => setEditMode(false)}>Cancel</button>
              <button className="text-xs text-indigo-400 hover:text-indigo-200 font-medium" onClick={handleSave}>Save</button>
            </div>
          ) : (
            <button className="text-xs text-gray-500 hover:text-gray-300" onClick={startEdit}>Edit</button>
          )
        )}
      </div>
      {editMode ? (
        <div>
          <textarea
            className="w-full h-48 bg-gray-950 border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            spellCheck={false}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden text-xs border border-gray-800">
          <SyntaxHighlighter
            language="json"
            style={atomOneDark}
            customStyle={{ margin: 0, padding: '12px', background: '#030712', maxHeight: '280px', overflow: 'auto' }}
          >
            {json}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}
