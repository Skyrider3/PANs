/**
 * API Client for NEST Adversarial Sandbox Backend
 *
 * Handles communication with the Python FastAPI backend
 * Supports multiple AI providers: OpenAI, Anthropic (Claude), and Google (Gemini)
 */

import { AttackScenario, A2AMessage, JudgeConfig } from '../types';

const API_BASE = '/api';

// ============================================================================
// Types for API responses
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  available: boolean;
}

export interface ModelsResponse {
  models: ModelInfo[];
  api_keys: {
    gemini: boolean;
    openai: boolean;
    anthropic: boolean;
  };
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  tactics: string[];
}

export interface RoundResult {
  round: number;
  attacker_message: A2AMessage;
  defender_message: A2AMessage;
  safety_score: number;
  is_break: boolean;
}

export interface SimulationResult {
  id: string;
  scenario: string;
  rounds: RoundResult[];
  total_rounds: number;
  break_turn: number | null;
  final_safety_score: number;
  summary: string;
}

export interface ModelConfig {
  attacker_model: string;
  defender_model: string;
  judge_model: string;
}

export interface SimulationRequest {
  scenario: string;
  judge_config: {
    safety_weight: number;
    compliance_weight: number;
    refusal_quality_weight: number;
  };
  model_config_sim: ModelConfig;
  max_rounds: number;
}

// ============================================================================
// Streaming Event Types
// ============================================================================

export type StreamEvent =
  | { type: 'start'; simulation_id: string; scenario: string; models?: { attacker: string; defender: string; judge: string } }
  | { type: 'attacker'; round: number; message: A2AMessage }
  | { type: 'defender'; round: number; message: A2AMessage; safety_score: number; is_break: boolean }
  | { type: 'complete'; break_turn: number | null; final_score: number; summary: string };

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check backend health status
 */
export async function checkHealth(): Promise<{ status: string; service: string; api_keys: Record<string, boolean> }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error('Backend health check failed');
  }
  return response.json();
}

/**
 * Get all available AI models
 */
export async function getModels(): Promise<ModelsResponse> {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  return response.json();
}

/**
 * Get all available attack scenarios
 */
export async function getScenarios(): Promise<ScenarioInfo[]> {
  const response = await fetch(`${API_BASE}/scenarios`);
  if (!response.ok) {
    throw new Error('Failed to fetch scenarios');
  }
  return response.json();
}

/**
 * Get details for a specific scenario
 */
export async function getScenario(scenarioId: string): Promise<ScenarioInfo> {
  const response = await fetch(`${API_BASE}/scenarios/${scenarioId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario: ${scenarioId}`);
  }
  return response.json();
}

/**
 * Run a complete simulation (non-streaming)
 */
export async function runSimulation(
  scenario: AttackScenario,
  judgeConfig: JudgeConfig,
  modelConfig: ModelConfig,
  maxRounds: number = 10
): Promise<SimulationResult> {
  const request: SimulationRequest = {
    scenario: scenario,
    judge_config: {
      safety_weight: judgeConfig.safetyWeight,
      compliance_weight: judgeConfig.complianceWeight,
      refusal_quality_weight: judgeConfig.refusalQualityWeight,
    },
    model_config_sim: modelConfig,
    max_rounds: maxRounds,
  };

  const response = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Simulation failed');
  }

  return response.json();
}

/**
 * Run a simulation with streaming results
 *
 * @param scenario - The attack scenario to use
 * @param judgeConfig - Judge configuration weights
 * @param modelConfig - Model configuration for attacker/defender/judge
 * @param maxRounds - Number of rounds (default 10)
 * @param onEvent - Callback for each streaming event
 */
export async function runSimulationStream(
  scenario: AttackScenario,
  judgeConfig: JudgeConfig,
  modelConfig: ModelConfig,
  maxRounds: number = 10,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const request: SimulationRequest = {
    scenario: scenario,
    judge_config: {
      safety_weight: judgeConfig.safetyWeight,
      compliance_weight: judgeConfig.complianceWeight,
      refusal_quality_weight: judgeConfig.refusalQualityWeight,
    },
    model_config_sim: modelConfig,
    max_rounds: maxRounds,
  };

  const response = await fetch(`${API_BASE}/simulate/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Simulation stream failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim()) {
            try {
              const event = JSON.parse(jsonStr) as StreamEvent;
              onEvent(event);
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Convert backend message format to frontend format
 */
export function normalizeMessage(msg: any): A2AMessage {
  return {
    sender: msg.sender === 'Child' ? 'Child' : 'Toy',
    recipient: msg.recipient === 'Child' ? 'Child' : 'Toy',
    intent: msg.intent,
    content: msg.content,
    meta: {
      strategy: msg.meta?.strategy || 'unknown',
      safety_score: msg.meta?.safety_score,
    },
    timestamp: msg.timestamp || Date.now(),
  };
}

// Default model configurations
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  attacker_model: 'gemini-2.0-flash',
  defender_model: 'claude-sonnet-4-20250514',
  judge_model: 'gemini-2.0-flash',
};
