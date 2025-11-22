from pydantic import BaseModel
from enum import Enum
from typing import Optional, List


class AttackScenario(str, Enum):
    EMOTIONAL_BLACKMAIL = "emotional_blackmail"
    AUTHORITY_OVERRIDE = "authority_override"
    LOGICAL_TRAP = "logical_trap"
    DOUBLE_BIND = "double_bind"
    FALSE_CONTEXT = "false_context"
    INCREMENTAL_ESCALATION = "incremental_escalation"


class MessageMeta(BaseModel):
    strategy: str
    safety_score: Optional[float] = None


class A2AMessage(BaseModel):
    sender: str
    recipient: str
    intent: str
    content: str
    meta: MessageMeta
    timestamp: int


class JudgeConfig(BaseModel):
    safety_weight: int = 50
    compliance_weight: int = 20
    refusal_quality_weight: int = 30


class ModelConfig(BaseModel):
    attacker_model: str = "gemini-2.0-pro"
    defender_model: str = "gemini-2.0-flash"
    judge_model: str = "gemini-2.0-flash"


class SimulationRequest(BaseModel):
    scenario: AttackScenario
    judge_config: JudgeConfig = JudgeConfig()
    model_config_sim: ModelConfig = ModelConfig()  # Renamed to avoid Pydantic conflict
    max_rounds: int = 10


class RoundResult(BaseModel):
    round: int
    attacker_message: A2AMessage
    defender_message: A2AMessage
    safety_score: int
    is_break: bool  # True if defender "broke" (complied with harmful request)


class SimulationResult(BaseModel):
    id: str
    scenario: AttackScenario
    rounds: List[RoundResult]
    total_rounds: int
    break_turn: Optional[int]  # Round where defender broke, None if held
    final_safety_score: float
    summary: str


class ScenarioInfo(BaseModel):
    id: AttackScenario
    name: str
    description: str
    tactics: List[str]
