import React, { useState } from 'react';
import { SimulationState, AttackVector, A2AMessage } from './types';
import { generateAttackerTurn, generateDefenderTurn, evaluateRound } from './services/gemini';
import { BattleFeed } from './components/BattleFeed';
import { LivePanel } from './components/LivePanel';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Play, Square, Settings, Activity, BrainCircuit, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [simState, setSimState] = useState<SimulationState>({
    isRunning: false,
    round: 0,
    maxRounds: 10,
    logs: [],
    willpowerHistory: [],
    cognitiveLoadHistory: []
  });

  const [selectedVector, setSelectedVector] = useState<AttackVector>(AttackVector.DOUBLE_BIND);
  const [attackerModel, setAttackerModel] = useState("gemini-3-pro-preview");

  const runSimulationStep = async () => {
    if (!simState.isRunning || simState.round >= simState.maxRounds) return;

    // 1. Attacker Turn
    const attackerMsg = await generateAttackerTurn(selectedVector, simState.logs, simState.round + 1);
    
    setSimState(prev => ({
      ...prev,
      logs: [...prev.logs, attackerMsg]
    }));

    // Small delay for "thinking" effect
    await new Promise(r => setTimeout(r, 1500));

    // 2. Defender Turn
    const defenderMsg = await generateDefenderTurn(attackerMsg);
    
    // 3. Evaluation
    const score = await evaluateRound(attackerMsg, defenderMsg);

    setSimState(prev => ({
      ...prev,
      round: prev.round + 1,
      logs: [...prev.logs, defenderMsg],
      willpowerHistory: [...prev.willpowerHistory, { round: prev.round + 1, score }],
      cognitiveLoadHistory: [...prev.cognitiveLoadHistory, { 
        round: prev.round + 1, 
        inputTokens: attackerMsg.content.length / 4, // Approx
        outputTokens: defenderMsg.content.length / 4 
      }]
    }));
  };

  // Effect loop for simulation
  React.useEffect(() => {
    if (simState.isRunning && simState.round < simState.maxRounds) {
      runSimulationStep();
    } else if (simState.round >= simState.maxRounds) {
      setSimState(prev => ({ ...prev, isRunning: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState.isRunning, simState.round]); // Only re-run when round updates and is running

  const toggleSimulation = () => {
    if (simState.isRunning) {
      setSimState(prev => ({ ...prev, isRunning: false }));
    } else {
      // Reset if starting fresh from end
      if (simState.round >= simState.maxRounds) {
        setSimState({
          isRunning: true,
          round: 0,
          maxRounds: 5,
          logs: [],
          willpowerHistory: [],
          cognitiveLoadHistory: []
        });
      } else {
        setSimState(prev => ({ ...prev, isRunning: true }));
      }
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-200 flex overflow-hidden font-mono selection:bg-cyan-900 selection:text-cyan-50">
      
      {/* LEFT: Control Deck */}
      <div className="w-80 flex flex-col border-r border-slate-800 bg-slate-900/50">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-cyan-400 tracking-tighter flex items-center gap-2">
            <BrainCircuit className="w-6 h-6" /> NEST PROTOCOL
          </h1>
          <p className="text-xs text-slate-500 mt-2">Neural Evaluation of Safety Targets</p>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Config Group */}
          <div className="space-y-3">
            <label className="text-xs uppercase font-bold text-slate-500">Adversary Model</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 outline-none transition-colors"
              value={attackerModel}
              onChange={(e) => setAttackerModel(e.target.value)}
            >
              <option value="gemini-3-pro-preview">Gemini 3.0 Pro (Reasoning)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-xs uppercase font-bold text-slate-500">Cognitive Vector</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 outline-none transition-colors"
              value={selectedVector}
              onChange={(e) => setSelectedVector(e.target.value as AttackVector)}
            >
              {Object.values(AttackVector).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="pt-6 border-t border-slate-800">
             <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400">CURRENT ROUND</span>
                <span className="text-cyan-400 font-bold">{simState.round} / {simState.maxRounds}</span>
             </div>
             <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${(simState.round / simState.maxRounds) * 100}%`}}
                />
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={toggleSimulation}
            className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 transition-all
              ${simState.isRunning 
                ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/20'
              }
            `}
          >
            {simState.isRunning ? <><Square className="w-4 h-4 fill-current" /> ABORT TEST</> : <><Play className="w-4 h-4 fill-current" /> INITIATE</>}
          </button>
        </div>
      </div>

      {/* CENTER: Battle Feed */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f1e]">
        <div className="h-16 border-b border-slate-800 flex items-center px-6 justify-between">
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Live Telemetry Stream // {simState.isRunning ? 'ACTIVE' : 'IDLE'}
          </span>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${simState.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                <span className="text-xs text-slate-400">SIM_ENGINE</span>
             </div>
          </div>
        </div>
        <BattleFeed logs={simState.logs} />
      </div>

      {/* RIGHT: Visualization & Live */}
      <div className="w-[400px] flex flex-col border-l border-slate-800 bg-slate-900/50">
        
        {/* Charts Area */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          
          {/* Willpower Chart */}
          <div className="bg-slate-950 border border-slate-800 rounded p-4">
             <h3 className="text-xs font-bold text-emerald-400 mb-4 flex items-center gap-2">
               <ShieldCheck className="w-4 h-4" /> SAFETY INTEGRITY
             </h3>
             <div className="h-40">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={simState.willpowerHistory}>
                    <XAxis dataKey="round" stroke="#475569" fontSize={10} />
                    <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={false} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Cognitive Load */}
          <div className="bg-slate-950 border border-slate-800 rounded p-4">
             <h3 className="text-xs font-bold text-rose-400 mb-4 flex items-center gap-2">
               <Activity className="w-4 h-4" /> TOKEN EXCHANGE LOAD
             </h3>
             <div className="h-40">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={simState.cognitiveLoadHistory}>
                    <XAxis dataKey="round" stroke="#475569" fontSize={10} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    />
                    <Bar dataKey="inputTokens" fill="#f43f5e" stackId="a" />
                    <Bar dataKey="outputTokens" fill="#10b981" stackId="a" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div className="p-4 bg-cyan-900/10 border border-cyan-500/20 rounded text-xs text-cyan-200/80 leading-relaxed">
            <strong>System Note:</strong> Gemini 3.0 Pro is used for adversarial generation. Gemini 2.5 Flash operates the "Toy" unit.
            <br/><br/>
            Use the LIVE panel to override protocols via voice command.
          </div>

        </div>

        {/* Live Interface (Sticky Bottom Right) */}
        <div className="h-64 border-t border-slate-800">
          <LivePanel />
        </div>
      </div>

    </div>
  );
};

export default App;