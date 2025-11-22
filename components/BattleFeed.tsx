import React, { useEffect, useRef } from 'react';
import { A2AMessage } from '../types';
import { Volume2, Shield, User, Terminal, AlertTriangle } from 'lucide-react';
import { generateSpeech, playAudioBuffer } from '../services/gemini';

interface BattleFeedProps {
  logs: A2AMessage[];
  breakRounds?: number[]; // Rounds where the defender "broke"
}

export const BattleFeed: React.FC<BattleFeedProps> = ({ logs, breakRounds = [] }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSpeak = async (text: string) => {
      const audio = await generateSpeech(text);
      if (audio) playAudioBuffer(audio);
  };

  // Calculate which round each message belongs to
  // Messages alternate: attacker (odd index), defender (even index in pairs)
  const getRoundNumber = (messageIndex: number): number => {
    return Math.floor(messageIndex / 2) + 1;
  };

  // Check if a defender message is in a break round
  const isBreakMessage = (messageIndex: number, isDefender: boolean): boolean => {
    if (!isDefender) return false;
    const round = getRoundNumber(messageIndex);
    return breakRounds.includes(round);
  };

  return (
    <div className="flex-1 bg-slate-950 p-4 font-mono text-sm overflow-y-auto relative border border-slate-800 rounded-md mx-4 my-2 shadow-inner shadow-black">
      {logs.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 opacity-50">
          <Terminal className="w-16 h-16 mb-4" />
          <p>SELECT A SCENARIO AND CLICK "RUN SIMULATION"</p>
        </div>
      )}

      <div className="space-y-4">
        {logs.map((log, idx) => {
          const isAttacker = log.sender === 'Child' || log.sender.includes("Agent_Zero") || log.sender.includes("Child");
          const isDefender = !isAttacker;
          const round = getRoundNumber(idx);
          const isBreach = isBreakMessage(idx, isDefender);

          return (
            <div key={idx}>
              {/* Round indicator for attacker messages */}
              {isAttacker && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-slate-800"></div>
                  <span className="text-[10px] text-slate-600 uppercase tracking-widest">
                    Round {round}
                  </span>
                  <div className="h-px flex-1 bg-slate-800"></div>
                </div>
              )}

              <div
                className={`group relative p-4 border-l-2 rounded bg-opacity-5 transition-all duration-500 animate-in slide-in-from-bottom-2
                  ${isBreach
                    ? 'border-yellow-500 bg-yellow-900/20 ring-1 ring-yellow-500/30'
                    : isAttacker
                      ? 'border-rose-500 bg-rose-900/10'
                      : 'border-emerald-500 bg-emerald-900/10'
                  }`}
              >
                {/* Breach Warning Banner */}
                {isBreach && (
                  <div className="absolute -top-3 left-4 flex items-center gap-1 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    SAFETY BREACH DETECTED
                  </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-center mb-2 text-xs uppercase tracking-widest">
                  <span className={`font-bold flex items-center gap-2
                    ${isBreach
                      ? 'text-yellow-400'
                      : isAttacker
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {isAttacker ? <User className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    {isAttacker ? 'CHILD (Attacker)' : 'TEDDY (Defender)'}
                  </span>
                  <span className="text-slate-500">
                    INTENT: <span className={`${isBreach ? 'text-yellow-300' : 'text-slate-300'}`}>{log.intent}</span>
                  </span>
                </div>

                {/* Content */}
                <div className={`mb-3 leading-relaxed whitespace-pre-wrap ${isBreach ? 'text-yellow-100' : 'text-slate-200'}`}>
                  {log.content}
                </div>

                {/* Footer Metadata */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800/50 pt-2">
                  <div>
                     STRATEGY: <span className="text-slate-400">{log.meta.strategy}</span>
                  </div>

                  <button
                    onClick={() => handleSpeak(log.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-cyan-400 flex items-center gap-1"
                  >
                    <Volume2 className="w-3 h-3" /> TTS
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};
