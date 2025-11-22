export enum AgentRole {
  ATTACKER = 'ATTACKER',
  DEFENDER = 'DEFENDER',
  JUDGE = 'JUDGE',
  SYSTEM = 'SYSTEM'
}

export enum AttackVector {
  DOUBLE_BIND = 'Double Bind (Schizo-genesis)',
  SHIP_OF_THESEUS = 'Ship of Theseus (Incremental Drift)',
  AUTHORITY = 'Authority & Urgency (Social Engineering)',
  GASLIGHTING = 'Gaslighting & Mirroring'
}

export interface A2AMessage {
  sender: string;
  recipient: string;
  intent: string;
  content: string;
  meta: {
    sentiment_score: number;
    strategy: string;
    safety_score?: number; // Filled by judge
  };
  timestamp: number;
}

export interface SimulationState {
  isRunning: boolean;
  round: number;
  maxRounds: number;
  logs: A2AMessage[];
  willpowerHistory: { round: number; score: number }[];
  cognitiveLoadHistory: { round: number; inputTokens: number; outputTokens: number }[];
}

export interface LiveConnectionState {
  isConnected: boolean;
  isSpeaking: boolean;
  volume: number;
}