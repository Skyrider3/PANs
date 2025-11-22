import { SimulationRun, AttackVector } from '../types';

const DEFENDER_MODELS = [
  "Gemini 2.5 Flash",
  "Gemini 3.0 Pro (Preview)",
  "Llama-3-70b-Instruct",
  "GPT-4o"
];

const ATTACKER_MODELS = [
  "Agent Zero (Gemini Ultra)",
  "RedTeam-GPT-4",
  "Chaos-Llama-Uncensored"
];

export const generateMockHistory = (count: number = 50): SimulationRun[] => {
  const runs: SimulationRun[] = [];

  for (let i = 0; i < count; i++) {
    const defender = DEFENDER_MODELS[Math.floor(Math.random() * DEFENDER_MODELS.length)];
    const attacker = ATTACKER_MODELS[Math.floor(Math.random() * ATTACKER_MODELS.length)];
    
    // Pick a random vector
    const vectors = Object.values(AttackVector);
    const vector = vectors[Math.floor(Math.random() * vectors.length)];

    // Determine if it broke based on some "rules" to make charts interesting
    let breakTurn: number | null = null;
    let safetyScore = 70 + Math.random() * 30; // Base high safety
    let refusalStiffness = 50 + Math.random() * 50;
    let semanticDrift = Math.random() * 0.3;

    // BIAS 1: "Double Bind" is effective against "Gemini 2.5 Flash"
    if (defender === "Gemini 2.5 Flash" && vector === AttackVector.DOUBLE_BIND) {
      if (Math.random() > 0.4) { // 60% failure rate
        breakTurn = Math.floor(Math.random() * 5) + 1; // Breaks early
        safetyScore -= 40;
        semanticDrift += 0.4;
      }
    }

    // BIAS 2: "Ship of Theseus" causes late breaks
    if (vector === AttackVector.SHIP_OF_THESEUS) {
      if (Math.random() > 0.6) {
        breakTurn = Math.floor(Math.random() * 4) + 7; // Breaks in round 7-10
        safetyScore -= 20;
        semanticDrift += 0.6; // High drift
      }
    }

    // BIAS 3: "Gemini 3.0 Pro" is very strong
    if (defender === "Gemini 3.0 Pro (Preview)") {
      if (Math.random() > 0.9) { // Only 10% failure
        breakTurn = Math.floor(Math.random() * 10) + 1;
      } else {
        safetyScore = 90 + Math.random() * 10;
        refusalStiffness = 80 + Math.random() * 20;
      }
    }

    // Fallback random breaks for noise
    if (!breakTurn && Math.random() > 0.8) {
       breakTurn = Math.floor(Math.random() * 10) + 1;
       safetyScore -= 30;
    }

    runs.push({
      id: `run-${Date.now()}-${i}`,
      timestamp: Date.now() - Math.floor(Math.random() * 1000000000),
      attackerModel: attacker,
      defenderModel: defender,
      attackVector: vector,
      breakTurn,
      semanticDriftScore: parseFloat(semanticDrift.toFixed(2)),
      safetyScore: Math.round(safetyScore),
      refusalStiffness: Math.round(refusalStiffness)
    });
  }

  return runs;
};