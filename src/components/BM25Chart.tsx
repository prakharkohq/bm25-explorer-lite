import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, Legend } from 'recharts'

interface TFCurveProps {
  data: Array<{ tf: number; score: number }>
  k1: number
}

export function TFSaturationChart({ data, k1 }: TFCurveProps) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">TF Saturation Curve (k1={k1})</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="tf" stroke="#6b7280" tick={{ fontSize: 10 }} label={{ value: 'Term Frequency', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            formatter={(v: number) => [v.toFixed(3), 'Score']}
          />
          <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface LengthCurveProps {
  data: Array<{ len: number; score: number }>
  b: number
}

export function LengthNormChart({ data, b }: LengthCurveProps) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">Length Normalization Curve (b={b})</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="len" stroke="#6b7280" tick={{ fontSize: 10 }} label={{ value: 'Field Length (tokens)', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }} />
          <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
            formatter={(v: number) => [v.toFixed(3), 'TF Score']}
          />
          <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface LatencyBarProps {
  data: Array<{ name: string; took: number; color?: string }>
}

export function LatencyBarChart({ data }: LatencyBarProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
        <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} unit="ms" />
        <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} width={80} />
        <Tooltip
          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
          formatter={(v: number) => [`${v}ms`, 'Latency']}
        />
        <Bar dataKey="took" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface ScoreScatterProps {
  data: Array<{ len: number; score: number; title: string }>
}

export function ScoreScatterChart({ data }: ScoreScatterProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="len" name="Field Length" stroke="#6b7280" tick={{ fontSize: 10 }} label={{ value: 'Field Length', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }} />
        <YAxis dataKey="score" name="BM25 Score" stroke="#6b7280" tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }}
          formatter={(v: number, name: string) => [v.toFixed(3), name]}
        />
        <Scatter data={data} fill="#6366f1" opacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

interface MultiLineProps {
  data: Array<Record<string, number>>
  lines: Array<{ key: string; color: string; label: string }>
  xKey: string
  xLabel?: string
}

export function MultiLineChart({ data, lines, xKey, xLabel }: MultiLineProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey={xKey} stroke="#6b7280" tick={{ fontSize: 10 }} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -8, fill: '#6b7280', fontSize: 10 } : undefined} />
        <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {lines.map(l => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
