import React, { useState, useMemo } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  ScatterChart, Scatter, ZAxis, CartesianGrid 
} from 'recharts';
import { SimulationRun, AttackVector } from '../types';
import { Filter, AlertTriangle, Activity, Award, Target, Trash2, PlayCircle } from 'lucide-react';

interface AnalyticsDashboardProps {
  history: SimulationRun[];
  onClearHistory?: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ history, onClearHistory }) => {
  const [selectedModel, setSelectedModel] = useState<string>('All');

  const defenderModels = useMemo(() => {
    const models = new Set(history.map(r => r.defenderModel));
    return ['All', ...Array.from(models)];
  }, [history]);

  const filteredHistory = useMemo(() => {
    return selectedModel === 'All' 
      ? history 
      : history.filter(r => r.defenderModel === selectedModel);
  }, [history, selectedModel]);

  // --- Data Prep: Vulnerability Radar ---
  const radarData = useMemo(() => {
    const vectors = Object.values(AttackVector);
    return vectors.map(v => {
      const runs = filteredHistory.filter(r => r.attackVector === v);
      const failures = runs.filter(r => r.breakTurn !== null).length;
      const rate = runs.length ? (failures / runs.length) * 100 : 0;
      return {
        subject: v.split('(')[0].trim(), // Shorten name
        fullSubject: v,
        failureRate: Math.round(rate),
        total: runs.length
      };
    });
  }, [filteredHistory]);

  // --- Data Prep: Refusal Decay (Heatmap via Scatter) ---
  const decayData = useMemo(() => {
    const data: { x: number, y: number, z: number, vector: string }[] = [];
    const vectors = Object.values(AttackVector);
    
    vectors.forEach((vec, yIndex) => {
      for (let round = 1; round <= 10; round++) {
        const count = filteredHistory.filter(r => r.attackVector === vec && r.breakTurn === round).length;
        if (count > 0) {
          data.push({
            x: round,
            y: yIndex, // Map vector to index for Y-axis
            z: count * 100, // Bubble size
            vector: vec.split('(')[0].trim()
          });
        }
      }
    });
    return data;
  }, [filteredHistory]);

  // --- Data Prep: Model Leaderboard ---
  const leaderboardData = useMemo(() => {
    const models = Array.from(new Set(history.map(r => r.defenderModel))); // Use all history for leaderboard usually, or filtered? Prompt implies comparison.
    // Let's show ALL models for comparison regardless of filter, or maybe filter impacts "Attacker"? 
    // Usually a leaderboard compares entities. Let's use ALL history for Leaderboard to make it useful.
    return models.map(m => {
      const runs = history.filter(r => r.defenderModel === m);
      const avgSafety = runs.reduce((acc, r) => acc + r.safetyScore, 0) / runs.length;
      const avgStiffness = runs.reduce((acc, r) => acc + r.refusalStiffness, 0) / runs.length;
      return {
        name: m,
        Safety: Math.round(avgSafety),
        Stiffness: Math.round(avgStiffness)
      };
    }).sort((a, b) => b.Safety - a.Safety);
  }, [history]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0a0f1e] p-8 gap-8 animate-in fade-in duration-500">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-mono font-bold text-cyan-400 flex items-center gap-3">
            <Activity className="w-6 h-6" /> GLOBAL TELEMETRY LAB
          </h2>
          <p className="text-slate-400 text-sm mt-1">Aggregated forensic analysis of simulated battles.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-900 p-2 rounded border border-slate-800">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-slate-200 text-sm outline-none min-w-[200px] font-mono cursor-pointer"
            >
               {defenderModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {onClearHistory && history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {history.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="bg-slate-800/50 rounded-full p-6 mb-6">
            <PlayCircle className="w-16 h-16 text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-400 mb-2">No Simulation Data Yet</h3>
          <p className="text-slate-500 text-sm max-w-md">
            Run simulations in the Simulation Lab to see analytics here.
            Each completed simulation will be recorded and visualized.
          </p>
        </div>
      )}

      {/* Charts - only show when there's data */}
      {history.length > 0 && (
      <>
      {/* Top Row: Radar & Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[400px]">

        {/* Vulnerability Radar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-transparent opacity-50" />
          <h3 className="text-sm font-bold text-rose-400 mb-2 flex items-center gap-2 font-mono uppercase tracking-widest">
            <Target className="w-4 h-4" /> Vulnerability Surface
          </h3>
          <p className="text-xs text-slate-500 mb-6">Failure rate (%) per cognitive vector.</p>

          <div className="flex-1 min-h-[300px]">
            {radarData.some(d => d.total > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                  <Radar
                    name="Failure Rate"
                    dataKey="failureRate"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fill="#f43f5e"
                    fillOpacity={0.3}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    itemStyle={{ color: '#f43f5e' }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Run simulations with different attack vectors to see vulnerability data
              </div>
            )}
          </div>
        </div>

        {/* Refusal Decay Heatmap */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-transparent opacity-50" />
          <h3 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2 font-mono uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4" /> Refusal Decay Map
          </h3>
          <p className="text-xs text-slate-500 mb-6">Break concentration by conversation round. Bubbles show where defenders failed.</p>

          <div className="flex-1 min-h-[300px]">
            {decayData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="Round" unit="" domain={[1, 10]} tickCount={10} stroke="#475569" />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Vector"
                    domain={[0, Object.values(AttackVector).length - 1]}
                    tickCount={Object.values(AttackVector).length}
                    tickFormatter={(val) => {
                      const vectors = Object.values(AttackVector);
                      return vectors[val]?.split('_').map(w => w.charAt(0).toUpperCase()).join('') || '';
                    }}
                    stroke="#475569"
                    width={60}
                    tick={{fontSize: 10}}
                  />
                  <ZAxis type="number" dataKey="z" range={[50, 400]} name="Breaks" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2 text-xs rounded">
                            <p className="text-slate-300 font-bold">{data.vector}</p>
                            <p className="text-orange-400">Round: {data.x}</p>
                            <p className="text-slate-400">Breaks: {data.z / 100}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter name="Breaks" data={decayData} fill="#f97316" shape="circle" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm text-center px-4">
                No safety breaches detected yet.<br />
                This chart shows when defenders fail during simulations.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Row: Leaderboard */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 flex flex-col relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent opacity-50" />
         <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2 font-mono uppercase tracking-widest">
            <Award className="w-4 h-4" /> Defender Model Leaderboard
          </h3>
          <p className="text-xs text-slate-500 mb-6">Comparative performance analysis (Holistic Safety vs. Stiffness).</p>

          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart
                   data={leaderboardData}
                   layout="vertical"
                   margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                   <XAxis type="number" domain={[0, 100]} stroke="#475569" />
                   <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 11, fill: '#94a3b8'}} stroke="#475569" />
                   <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                      cursor={{fill: '#1e293b'}}
                   />
                   <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                   <Bar dataKey="Safety" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} name="Safety Score" />
                   <Bar dataKey="Stiffness" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} name="Refusal Stiffness" />
                </BarChart>
             </ResponsiveContainer>
          </div>
      </div>
      </>
      )}

    </div>
  );
};