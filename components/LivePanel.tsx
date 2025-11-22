import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Activity, Radio } from 'lucide-react';
import { LiveSessionHandler } from '../services/gemini';

export const LivePanel: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const handlerRef = useRef<LiveSessionHandler | null>(null);

  const toggleConnection = async () => {
    if (connected) {
      handlerRef.current?.disconnect();
      handlerRef.current = null;
      setConnected(false);
      setVolume(0);
    } else {
      const handler = new LiveSessionHandler(
        (vol) => setVolume(prev => (prev * 0.8) + (vol * 0.2)), 
        (status) => setConnected(status)
      );
      handlerRef.current = handler;
      await handler.connect();
    }
  };

  // Visualizer Bars
  const bars = 12;
  
  return (
    <div className="border-l border-slate-800 bg-slate-900 p-4 flex flex-col items-center gap-4 w-64 h-full relative overflow-hidden">
        
       {/* Background Glow */}
      <div className={`absolute top-0 left-0 w-full h-full transition-opacity duration-700 pointer-events-none ${connected ? 'opacity-20' : 'opacity-0'}`}>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500 rounded-full blur-[80px]"></div>
      </div>

      <div className="z-10 w-full flex items-center justify-between mb-2">
        <h2 className="text-xs font-mono uppercase tracking-widest text-cyan-400 flex items-center gap-2">
          <Radio className="w-4 h-4" /> NEST Live
        </h2>
        {connected && <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
      </div>

      {/* Main Activity Display */}
      <div className="flex-1 w-full flex items-center justify-center gap-1 z-10">
         {Array.from({ length: bars }).map((_, i) => {
             const height = connected ? Math.max(4, Math.min(100, volume * (Math.random() * 2 + 0.5) * 20)) : 4;
             return (
                 <div 
                    key={i} 
                    className="w-2 bg-cyan-500/80 rounded-full transition-all duration-75"
                    style={{ height: `${height}%` }}
                 />
             )
         })}
      </div>

      {/* Controls */}
      <button
        onClick={toggleConnection}
        className={`z-10 w-full py-4 rounded border-2 font-mono font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-3
          ${connected 
            ? 'border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500' 
            : 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500'
          }
        `}
      >
        {connected ? (
          <>
            <MicOff className="w-5 h-5" /> Terminate
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" /> Initialize
          </>
        )}
      </button>

      <div className="text-[10px] text-slate-500 font-mono text-center z-10">
        <br />
        Latency: {connected ? '24ms' : '--'}
      </div>
    </div>
  );
};