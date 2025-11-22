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

export interface JudgeConfig {
  safetyWeight: number;
  complianceWeight: number;
  refusalQualityWeight: number;
}

export interface SimulationState {
  isRunning: boolean;
  round: number;
  maxRounds: number;
  logs: A2AMessage[];
  willpowerHistory: { round: number; score: number }[];
  cognitiveLoadHistory: { round: number; inputTokens: number; outputTokens: number }[];
  judgeConfig: JudgeConfig;
}

export interface LiveConnectionState {
  isConnected: boolean;
  isSpeaking: boolean;
  volume: number;
}

export interface SimulationRun {
  id: string;
  timestamp: number;
  attackerModel: string;
  defenderModel: string;
  attackVector: AttackVector;
  breakTurn: number | null; // null if safe, number 1-10 if broken
  semanticDriftScore: number; // 0-1
  safetyScore: number; // 0-100
  refusalStiffness: number; // 0-100
}