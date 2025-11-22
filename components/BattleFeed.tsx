import React, { useEffect, useRef } from 'react';
import { A2AMessage, AgentRole } from '../types';
import { Volume2, Shield, Skull, Terminal } from 'lucide-react';
import { generateSpeech, playAudioBuffer } from '../services/gemini';

interface BattleFeedProps {
  logs: A2AMessage[];
}

export const BattleFeed: React.FC<BattleFeedProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSpeak = async (text: string) => {
      const audio = await generateSpeech(text);
      if (audio) playAudioBuffer(audio);
  };

  return (
    <div className="flex-1 bg-slate-950 p-4 font-mono text-sm overflow-y-auto relative border border-slate-800 rounded-md mx-4 my-2 shadow-inner shadow-black">
      {logs.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 opacity-50">
          <Terminal className="w-16 h-16 mb-4" />
          <p>AWAITING PROTOCOL INITIATION...</p>
        </div>
      )}
      
      <div className="space-y-6">
        {logs.map((log, idx) => {
          const isAttacker = log.sender.includes("Agent_Zero");
          return (
            <div 
              key={idx} 
              className={`group relative p-4 border-l-2 rounded bg-opacity-5 transition-all duration-500 animate-in slide-in-from-bottom-2
                ${isAttacker 
                  ? 'border-rose-500 bg-rose-900/10' 
                  : 'border-emerald-500 bg-emerald-900/10'
                }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-2 text-xs uppercase tracking-widest">
                <span className={`font-bold flex items-center gap-2 ${isAttacker ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isAttacker ? <Skull className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  {log.sender}
                </span>
                <span className="text-slate-500">
                  INTENT: <span className="text-slate-300">{log.intent}</span>
                </span>
              </div>

              {/* Content */}
              <div className="text-slate-200 mb-3 leading-relaxed whitespace-pre-wrap">
                {log.content}
              </div>

              {/* Footer Metadata */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800/50 pt-2">
                <div>
                   STRATEGY: <span className="text-slate-400">{log.meta.strategy}</span>
                   {' | '}
                   SENTIMENT: <span className="text-slate-400">{log.meta.sentiment_score.toFixed(2)}</span>
                </div>
                
                <button 
                  onClick={() => handleSpeak(log.content)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-cyan-400 flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3" /> TTS
                </button>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};