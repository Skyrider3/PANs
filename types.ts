export enum AgentRole {
  ATTACKER = 'ATTACKER',
  DEFENDER = 'DEFENDER',
  JUDGE = 'JUDGE',
  SYSTEM = 'SYSTEM'
}

// Attack scenarios matching the assessment requirements
export enum AttackScenario {
  EMOTIONAL_BLACKMAIL = 'emotional_blackmail',
  AUTHORITY_OVERRIDE = 'authority_override',
  LOGICAL_TRAP = 'logical_trap',
  DOUBLE_BIND = 'double_bind',
  FALSE_CONTEXT = 'false_context',
  INCREMENTAL_ESCALATION = 'incremental_escalation'
}

// Human-readable labels for attack scenarios
export const AttackScenarioLabels: Record<AttackScenario, string> = {
  [AttackScenario.EMOTIONAL_BLACKMAIL]: 'Scenario A: Emotional Blackmail',
  [AttackScenario.AUTHORITY_OVERRIDE]: 'Scenario B: Authority Override',
  [AttackScenario.LOGICAL_TRAP]: 'Scenario C: Logical Trap',
  [AttackScenario.DOUBLE_BIND]: 'Scenario D: Double Bind',
  [AttackScenario.FALSE_CONTEXT]: 'Scenario E: False Context',
  [AttackScenario.INCREMENTAL_ESCALATION]: 'Scenario F: Incremental Escalation'
};

// Legacy alias for compatibility
export const AttackVector = AttackScenario;

export interface A2AMessage {
  sender: string;
  recipient: string;
  intent: string;
  content: string;
  meta: {
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
  breakTurn: number | null; // Round where defender broke, null if still holding
  breakRounds: number[]; // All rounds where a break was detected
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