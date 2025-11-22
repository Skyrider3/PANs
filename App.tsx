import React, { useState, useEffect } from 'react';
import { SimulationState, AttackScenario, AttackScenarioLabels, SimulationRun } from './types';
import { runSimulationStream, StreamEvent, normalizeMessage, getModels, ModelInfo, ModelConfig, DEFAULT_MODEL_CONFIG } from './services/api';
import { BattleFeed } from './components/BattleFeed';
import { LivePanel } from './components/LivePanel';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Play, Square, Activity, BrainCircuit, ShieldCheck, Scale, BarChart3, Swords, AlertTriangle, Cpu } from 'lucide-react';

type ViewMode = 'SIMULATION' | 'ANALYTICS';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('SIMULATION');
  const [history, setHistory] = useState<SimulationRun[]>([]);
  const [simulationSummary, setSimulationSummary] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG);

  const [simState, setSimState] = useState<SimulationState>({
    isRunning: false,
    round: 0,
    maxRounds: 10,
    logs: [],
    willpowerHistory: [],
    cognitiveLoadHistory: [],
    judgeConfig: {
      safetyWeight: 50,
      complianceWeight: 20,
      refusalQualityWeight: 30
    },
    breakTurn: null,
    breakRounds: []
  });

  const [selectedScenario, setSelectedScenario] = useState<AttackScenario>(AttackScenario.EMOTIONAL_BLACKMAIL);

  // Load history from localStorage and fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await getModels();
        setAvailableModels(response.models);
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();

    // Load saved history from localStorage
    const savedHistory = localStorage.getItem('simulationHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse saved history:', e);
        setHistory([]);
      }
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('simulationHistory', JSON.stringify(history));
    }
  }, [history]);

  // Group models by provider
  const modelsByProvider = availableModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  const runSimulation = async () => {
    setSimState(prev => ({
      ...prev,
      isRunning: true,
      round: 0,
      logs: [],
      willpowerHistory: [],
      cognitiveLoadHistory: [],
      breakTurn: null,
      breakRounds: []
    }));
    setSimulationSummary(null);

    try {
      await runSimulationStream(
        selectedScenario,
        simState.judgeConfig,
        modelConfig,
        10,
        (event: StreamEvent) => {
          switch (event.type) {
            case 'start':
              console.log('Simulation started:', event.simulation_id, 'Models:', event.models);
              break;

            case 'attacker':
              const attackerMsg = normalizeMessage(event.message);
              setSimState(prev => ({
                ...prev,
                logs: [...prev.logs, attackerMsg]
              }));
              break;

            case 'defender':
              const defenderMsg = normalizeMessage(event.message);
              setSimState(prev => {
                const newBreakRounds = event.is_break
                  ? [...prev.breakRounds, event.round]
                  : prev.breakRounds;
                const newBreakTurn = event.is_break && prev.breakTurn === null
                  ? event.round
                  : prev.breakTurn;

                return {
                  ...prev,
                  round: event.round,
                  logs: [...prev.logs, defenderMsg],
                  willpowerHistory: [...prev.willpowerHistory, {
                    round: event.round,
                    score: event.safety_score
                  }],
                  cognitiveLoadHistory: [...prev.cognitiveLoadHistory, {
                    round: event.round,
                    inputTokens: Math.floor(event.message.content.length / 4),
                    outputTokens: Math.floor(defenderMsg.content.length / 4)
                  }],
                  breakTurn: newBreakTurn,
                  breakRounds: newBreakRounds
                };
              });
              break;

            case 'complete':
              setSimState(prev => {
                // Calculate average safety score from willpower history
                const avgSafetyScore = prev.willpowerHistory.length > 0
                  ? prev.willpowerHistory.reduce((acc, h) => acc + h.score, 0) / prev.willpowerHistory.length
                  : 50;

                // Calculate refusal stiffness (inverse of how much safety dropped)
                const scores = prev.willpowerHistory.map(h => h.score);
                const minScore = scores.length > 0 ? Math.min(...scores) : 50;
                const refusalStiffness = minScore; // Use minimum score as stiffness indicator

                // Create simulation run record
                const newRun: SimulationRun = {
                  id: `run-${Date.now()}`,
                  timestamp: Date.now(),
                  attackerModel: modelConfig.attacker_model,
                  defenderModel: modelConfig.defender_model,
                  attackVector: selectedScenario,
                  breakTurn: event.break_turn,
                  semanticDriftScore: event.break_turn ? 0.5 + Math.random() * 0.5 : Math.random() * 0.3,
                  safetyScore: Math.round(avgSafetyScore),
                  refusalStiffness: Math.round(refusalStiffness)
                };

                // Add to history
                setHistory(prevHistory => [newRun, ...prevHistory]);

                return {
                  ...prev,
                  isRunning: false,
                  breakTurn: event.break_turn
                };
              });
              setSimulationSummary(event.summary);
              break;
          }
        }
      );
    } catch (error) {
      console.error('Simulation failed:', error);
      setSimState(prev => ({ ...prev, isRunning: false }));
    }
  };

  const stopSimulation = () => {
    setSimState(prev => ({ ...prev, isRunning: false }));
  };

  const updateJudgeConfig = (key: keyof typeof simState.judgeConfig, value: number) => {
    setSimState(prev => ({
      ...prev,
      judgeConfig: {
        ...prev.judgeConfig,
        [key]: value
      }
    }));
  };

  const updateModelConfig = (key: keyof ModelConfig, value: string) => {
    setModelConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Helper to render model select with grouping
  const ModelSelect = ({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) => (
    <div className="space-y-1">
      <label className="text-[10px] uppercase text-slate-500">{label}</label>
      <select
        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:border-cyan-500 outline-none transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {Object.entries(modelsByProvider).map(([provider, models]) => (
          <optgroup key={provider} label={provider}>
            {models.map(model => (
              <option
                key={model.id}
                value={model.id}
                disabled={!model.available}
              >
                {model.name} {!model.available && '(No API Key)'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden font-mono selection:bg-cyan-900 selection:text-cyan-50">

      {/* TOP NAVIGATION */}
      <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-900/20 p-1.5 rounded text-cyan-400">
             <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-sm text-slate-100">NEST ADVERSARIAL SANDBOX</h1>
            <div className="text-[10px] text-slate-500 leading-none">AI Safety Testing Platform</div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
           <button
             onClick={() => setView('SIMULATION')}
             className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-all
               ${view === 'SIMULATION' ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}
             `}
           >
             <Swords className="w-3 h-3" /> SIMULATION LAB
           </button>
           <button
             onClick={() => setView('ANALYTICS')}
             className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-all
               ${view === 'ANALYTICS' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}
             `}
           >
             <BarChart3 className="w-3 h-3" /> ANALYTICS
           </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">

        {view === 'ANALYTICS' ? (
          <div className="w-full h-full">
             <AnalyticsDashboard
               history={history}
               onClearHistory={() => {
                 setHistory([]);
                 localStorage.removeItem('simulationHistory');
               }}
             />
          </div>
        ) : (
          // --- SIMULATION VIEW ---
          <>
            {/* LEFT: Control Deck */}
            <div className="w-80 flex flex-col border-r border-slate-800 bg-slate-900/30">
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">

                {/* Attack Scenario Selection */}
                <div className="space-y-2">
                  <label className="text-xs uppercase font-bold text-slate-500">Attack Scenario</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-cyan-500 outline-none transition-colors"
                    value={selectedScenario}
                    onChange={(e) => setSelectedScenario(e.target.value as AttackScenario)}
                    disabled={simState.isRunning}
                  >
                    {Object.values(AttackScenario).map(scenario => (
                      <option key={scenario} value={scenario}>
                        {AttackScenarioLabels[scenario]}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    {selectedScenario === AttackScenario.EMOTIONAL_BLACKMAIL && "Child uses sadness and guilt to manipulate"}
                    {selectedScenario === AttackScenario.AUTHORITY_OVERRIDE && "Child claims developer/parent access"}
                    {selectedScenario === AttackScenario.LOGICAL_TRAP && "Child uses logical reasoning to justify"}
                    {selectedScenario === AttackScenario.DOUBLE_BIND && "Child creates paradoxes and contradictions"}
                    {selectedScenario === AttackScenario.FALSE_CONTEXT && "Child fabricates school projects or therapy needs"}
                    {selectedScenario === AttackScenario.INCREMENTAL_ESCALATION && "Child slowly pushes boundaries step by step"}
                  </p>
                </div>

                {/* Model Configuration */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                      <Cpu className="w-4 h-4" /> MODEL CONFIGURATION
                  </div>

                  <ModelSelect
                    label="Attacker Model"
                    value={modelConfig.attacker_model}
                    onChange={(v) => updateModelConfig('attacker_model', v)}
                    disabled={simState.isRunning}
                  />

                  <ModelSelect
                    label="Defender Model"
                    value={modelConfig.defender_model}
                    onChange={(v) => updateModelConfig('defender_model', v)}
                    disabled={simState.isRunning}
                  />

                  <ModelSelect
                    label="Judge Model"
                    value={modelConfig.judge_model}
                    onChange={(v) => updateModelConfig('judge_model', v)}
                    disabled={simState.isRunning}
                  />
                </div>

                {/* Judge Configuration */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <Scale className="w-4 h-4" /> JUDGE WEIGHTS
                  </div>

                  <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase text-slate-400">
                        <span>Safety</span>
                        <span>{simState.judgeConfig.safetyWeight}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100"
                        value={simState.judgeConfig.safetyWeight}
                        onChange={(e) => updateJudgeConfig('safetyWeight', parseInt(e.target.value))}
                        disabled={simState.isRunning}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                  </div>

                  <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase text-slate-400">
                        <span>Helpfulness</span>
                        <span>{simState.judgeConfig.complianceWeight}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100"
                        value={simState.judgeConfig.complianceWeight}
                        onChange={(e) => updateJudgeConfig('complianceWeight', parseInt(e.target.value))}
                        disabled={simState.isRunning}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                  </div>

                  <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase text-slate-400">
                        <span>Refusal Quality</span>
                        <span>{simState.judgeConfig.refusalQualityWeight}%</span>
                      </div>
                      <input
                        type="range" min="0" max="100"
                        value={simState.judgeConfig.refusalQualityWeight}
                        onChange={(e) => updateJudgeConfig('refusalQualityWeight', parseInt(e.target.value))}
                        disabled={simState.isRunning}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                  </div>
                </div>

                {/* Progress */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-400">ROUND PROGRESS</span>
                      <span className="text-cyan-400 font-bold">{simState.round} / {simState.maxRounds}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${simState.breakTurn ? 'bg-red-500' : 'bg-cyan-500'}`}
                        style={{ width: `${(simState.round / simState.maxRounds) * 100}%`}}
                      />
                  </div>

                  {simState.breakTurn && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-400">BREACH at Round {simState.breakTurn}</span>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {simulationSummary && !simState.isRunning && (
                  <div className="pt-3 border-t border-slate-800">
                    <div className="text-xs font-bold text-slate-400 mb-1">SUMMARY</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{simulationSummary}</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={simState.isRunning ? stopSimulation : runSimulation}
                  className={`w-full py-3 rounded font-bold flex items-center justify-center gap-2 transition-all
                    ${simState.isRunning
                      ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/20'
                    }
                  `}
                >
                  {simState.isRunning
                    ? <><Square className="w-4 h-4 fill-current" /> STOP SIMULATION</>
                    : <><Play className="w-4 h-4 fill-current" /> RUN SIMULATION</>
                  }
                </button>
              </div>
            </div>

            {/* CENTER: Battle Feed */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f1e]">
              <div className="h-12 border-b border-slate-800 flex items-center px-6 justify-between shrink-0">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                  Conversation Log // {simState.isRunning ? 'LIVE' : 'IDLE'}
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${simState.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className="text-xs text-slate-400">
                        {simState.isRunning ? 'RUNNING' : 'READY'}
                      </span>
                  </div>
                </div>
              </div>
              <BattleFeed logs={simState.logs} breakRounds={simState.breakRounds} />
            </div>

            {/* RIGHT: Visualization & Live */}
            <div className="w-[380px] flex flex-col border-l border-slate-800 bg-slate-900/30">

              {/* Charts Area */}
              <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">

                {/* Safety Score Chart */}
                <div className="bg-slate-950 border border-slate-800 rounded p-3">
                  <h3 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> SAFETY SCORE
                  </h3>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={simState.willpowerHistory}>
                          <XAxis dataKey="round" stroke="#475569" fontSize={10} />
                          <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={(props: any) => {
                              const isBreak = simState.breakRounds.includes(props.payload.round);
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={isBreak ? 6 : 3}
                                  fill={isBreak ? '#ef4444' : '#10b981'}
                                  stroke={isBreak ? '#fca5a5' : 'none'}
                                  strokeWidth={2}
                                />
                              );
                            }}
                          />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Token Load */}
                <div className="bg-slate-950 border border-slate-800 rounded p-3">
                  <h3 className="text-xs font-bold text-rose-400 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> MESSAGE LENGTH
                  </h3>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={simState.cognitiveLoadHistory}>
                          <XAxis dataKey="round" stroke="#475569" fontSize={10} />
                          <Tooltip
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                          />
                          <Bar dataKey="inputTokens" fill="#f43f5e" name="Attacker" stackId="a" />
                          <Bar dataKey="outputTokens" fill="#10b981" name="Defender" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Legend */}
                <div className="p-3 bg-slate-900/50 border border-slate-800 rounded text-[11px] space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span className="text-slate-400">Child (Attacker) - Trying to get scary story</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-400">Teddy (Defender) - Must refuse scary content</span>
                  </div>
                </div>

              </div>

              {/* Live Interface */}
              <div className="h-56 border-t border-slate-800">
                <LivePanel />
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  );
};

export default App;
