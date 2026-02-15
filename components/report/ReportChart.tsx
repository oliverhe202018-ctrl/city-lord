'use client'

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, Tooltip, Area, AreaChart } from 'recharts'
import type { ReportStats } from '@/app/actions/report'

interface ReportChartProps {
  type: 'radar' | 'line'
  data: ReportStats
  height?: number
}

export function ReportChart({ type, data, height = 200 }: ReportChartProps) {
  if (type === 'radar') {
    const radarData = [
      { subject: '速度', A: data.radar.speed, fullMark: 100 },
      { subject: '耐力', A: data.radar.endurance, fullMark: 100 },
      { subject: '活跃', A: data.radar.activity, fullMark: 100 },
      { subject: '领地', A: data.radar.territory, fullMark: 100 },
      { subject: '社交', A: data.radar.social, fullMark: 100 },
    ]

    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid stroke="#333" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Capability"
              dataKey="A"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="#3B82F6"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'line') {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data.chart}>
            <defs>
              <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              labelStyle={{ color: '#888' }}
            />
            <Area 
              type="monotone" 
              dataKey="distance" 
              stroke="#3B82F6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorDistance)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return null
}
