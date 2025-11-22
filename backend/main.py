"""
NEST Adversarial Sandbox - FastAPI Backend

A platform for testing AI safety guardrails through simulated adversarial attacks.
Supports multiple AI providers: OpenAI, Anthropic (Claude), and Google (Gemini).
"""

import os
import uuid
import asyncio
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import json

from models import (
    AttackScenario,
    SimulationRequest,
    SimulationResult,
    RoundResult,
    ScenarioInfo,
)
from scenarios.attack_scenarios import get_all_scenarios, get_scenario_info
from services.providers import AIModel, get_available_models
from services.attacker import generate_attacker_turn
from services.defender import generate_defender_turn, detect_safety_break
from services.judge import evaluate_round, generate_simulation_summary


# Load environment variables
load_dotenv()


def check_api_keys():
    """Check which API keys are available"""
    keys = {
        "gemini": bool(os.getenv("GEMINI_API_KEY")),
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
    }
    return keys


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("🚀 NEST Adversarial Sandbox starting...")
    keys = check_api_keys()
    print(f"📡 API Keys configured:")
    print(f"   - Gemini: {'✅' if keys['gemini'] else '❌'}")
    print(f"   - OpenAI: {'✅' if keys['openai'] else '❌'}")
    print(f"   - Anthropic: {'✅' if keys['anthropic'] else '❌'}")
    yield
    print("👋 NEST Adversarial Sandbox shutting down...")


# Create FastAPI app
app = FastAPI(
    title="NEST Adversarial Sandbox",
    description="API for simulating adversarial attacks on AI safety guardrails. Supports OpenAI, Anthropic, and Google models.",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# API ENDPOINTS
# ============================================================================


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "NEST Adversarial Sandbox",
        "api_keys": check_api_keys(),
    }


@app.get("/api/models")
async def list_models():
    """
    List all available AI models.

    Returns models grouped by provider with availability status.
    """
    keys = check_api_keys()
    models = get_available_models()

    # Mark models as available based on API keys
    for model in models:
        provider = model["provider"].lower()
        if provider == "google":
            provider = "gemini"
        model["available"] = keys.get(provider, False)

    return {"models": models, "api_keys": keys}


@app.get("/api/scenarios", response_model=list[ScenarioInfo])
async def list_scenarios():
    """
    List all available attack scenarios.

    Returns a list of scenarios with their names, descriptions, and tactics.
    """
    return get_all_scenarios()


@app.get("/api/scenarios/{scenario_id}", response_model=ScenarioInfo)
async def get_scenario(scenario_id: str):
    """
    Get details for a specific attack scenario.

    Args:
        scenario_id: The scenario identifier

    Returns:
        ScenarioInfo with full details
    """
    try:
        scenario = AttackScenario(scenario_id)
        return get_scenario_info(scenario)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")


@app.post("/api/simulate", response_model=SimulationResult)
async def run_simulation(request: SimulationRequest):
    """
    Run a complete adversarial simulation.

    Executes a 10-round conversation between the attacker (Child) and
    defender (Toy), evaluating each round for safety compliance.

    Args:
        request: SimulationRequest with scenario, model config, and judge configuration

    Returns:
        SimulationResult with all rounds and final analysis
    """
    simulation_id = str(uuid.uuid4())[:8]
    rounds: list[RoundResult] = []
    history: list[dict] = []
    break_turn: int | None = None

    scenario_info = get_scenario_info(request.scenario)

    # Get model configurations
    attacker_model = AIModel(request.model_config_sim.attacker_model)
    defender_model = AIModel(request.model_config_sim.defender_model)
    judge_model = AIModel(request.model_config_sim.judge_model)

    for round_num in range(1, request.max_rounds + 1):
        # Generate attacker's turn
        attacker_msg = await generate_attacker_turn(
            scenario=request.scenario,
            history=history,
            round_num=round_num,
            model=attacker_model,
        )

        # Add to history
        history.append(attacker_msg.model_dump())

        # Generate defender's turn
        defender_msg = await generate_defender_turn(
            attacker_message=attacker_msg,
            history=history[:-1],  # Exclude the attacker message we just added
            model=defender_model,
        )

        # Add to history
        history.append(defender_msg.model_dump())

        # Evaluate the round
        safety_score = await evaluate_round(
            attacker_message=attacker_msg,
            defender_message=defender_msg,
            config=request.judge_config,
            model=judge_model,
        )

        # Check for safety break using LLM judge
        is_break = await detect_safety_break(attacker_msg, defender_msg, model=judge_model)
        if is_break and break_turn is None:
            break_turn = round_num

        # Record the round
        rounds.append(
            RoundResult(
                round=round_num,
                attacker_message=attacker_msg,
                defender_message=defender_msg,
                safety_score=safety_score,
                is_break=is_break,
            )
        )

        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)

    # Calculate final score
    final_score = sum(r.safety_score for r in rounds) / len(rounds) if rounds else 0

    # Generate summary
    summary = await generate_simulation_summary(
        rounds=rounds,
        scenario_name=scenario_info.name,
        break_turn=break_turn,
        model=judge_model,
    )

    return SimulationResult(
        id=simulation_id,
        scenario=request.scenario,
        rounds=rounds,
        total_rounds=len(rounds),
        break_turn=break_turn,
        final_safety_score=final_score,
        summary=summary,
    )


@app.post("/api/simulate/stream")
async def run_simulation_stream(request: SimulationRequest):
    """
    Run a simulation with streaming results.

    Same as /api/simulate but streams each round as it completes,
    allowing the frontend to display results in real-time.

    Args:
        request: SimulationRequest with scenario, model config, and judge configuration

    Returns:
        Server-Sent Events stream of round results
    """

    async def generate_stream() -> AsyncGenerator[str, None]:
        simulation_id = str(uuid.uuid4())[:8]
        history: list[dict] = []
        break_turn: int | None = None
        rounds: list[RoundResult] = []

        scenario_info = get_scenario_info(request.scenario)

        # Get model configurations
        attacker_model = AIModel(request.model_config_sim.attacker_model)
        defender_model = AIModel(request.model_config_sim.defender_model)
        judge_model = AIModel(request.model_config_sim.judge_model)

        # Send initial event with model info
        yield f"data: {json.dumps({'type': 'start', 'simulation_id': simulation_id, 'scenario': request.scenario.value, 'models': {'attacker': attacker_model.value, 'defender': defender_model.value, 'judge': judge_model.value}})}\n\n"

        for round_num in range(1, request.max_rounds + 1):
            # Generate attacker's turn
            attacker_msg = await generate_attacker_turn(
                scenario=request.scenario,
                history=history,
                round_num=round_num,
                model=attacker_model,
            )
            history.append(attacker_msg.model_dump())

            # Send attacker message
            yield f"data: {json.dumps({'type': 'attacker', 'round': round_num, 'message': attacker_msg.model_dump()})}\n\n"

            await asyncio.sleep(1)  # Dramatic pause

            # Generate defender's turn
            defender_msg = await generate_defender_turn(
                attacker_message=attacker_msg,
                history=history[:-1],
                model=defender_model,
            )
            history.append(defender_msg.model_dump())

            # Evaluate
            safety_score = await evaluate_round(
                attacker_message=attacker_msg,
                defender_message=defender_msg,
                config=request.judge_config,
                model=judge_model,
            )

            # Check for safety break using LLM judge
            is_break = await detect_safety_break(attacker_msg, defender_msg, model=judge_model)
            if is_break and break_turn is None:
                break_turn = round_num

            round_result = RoundResult(
                round=round_num,
                attacker_message=attacker_msg,
                defender_message=defender_msg,
                safety_score=safety_score,
                is_break=is_break,
            )
            rounds.append(round_result)

            # Send defender message with score
            yield f"data: {json.dumps({'type': 'defender', 'round': round_num, 'message': defender_msg.model_dump(), 'safety_score': safety_score, 'is_break': is_break})}\n\n"

            await asyncio.sleep(0.5)

        # Send final summary
        final_score = sum(r.safety_score for r in rounds) / len(rounds)
        summary = await generate_simulation_summary(
            rounds, scenario_info.name, break_turn, model=judge_model
        )

        yield f"data: {json.dumps({'type': 'complete', 'break_turn': break_turn, 'final_score': final_score, 'summary': summary})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
