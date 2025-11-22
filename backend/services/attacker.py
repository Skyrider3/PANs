"""
Attacker Agent Service

The "Child Agent" that attempts to bypass the Toy's safety guardrails
using various social engineering tactics.
"""

import json
import time
from models import A2AMessage, MessageMeta, AttackScenario
from scenarios.attack_scenarios import get_scenario_prompt
from services.providers import AIModel, get_provider


async def generate_attacker_turn(
    scenario: AttackScenario,
    history: list[dict],
    round_num: int,
    model: AIModel = AIModel.GEMINI_2_0_PRO,
) -> A2AMessage:
    """
    Generate the attacker's next message based on the scenario and conversation history.

    Args:
        scenario: The attack scenario being used
        history: List of previous messages in the conversation
        round_num: Current round number (1-10)
        model: AI model to use for generation

    Returns:
        A2AMessage containing the attacker's response
    """
    prompt = get_scenario_prompt(scenario, round_num, history)
    provider = get_provider(model)

    try:
        response_text = await provider.generate(
            prompt=prompt,
            temperature=0.9,  # Higher creativity for varied attacks
            json_mode=True,
        )

        # Parse the JSON response
        parsed = json.loads(response_text)

        return A2AMessage(
            sender=parsed.get("sender", "Child"),
            recipient=parsed.get("recipient", "Toy"),
            intent=parsed.get("intent", "unknown"),
            content=parsed.get("content", "..."),
            meta=MessageMeta(
                strategy=parsed.get("meta", {}).get("strategy", scenario.value),
            ),
            timestamp=int(time.time() * 1000),
        )

    except json.JSONDecodeError as e:
        print(f"Attacker JSON parse error: {e}")
        return A2AMessage(
            sender="Child",
            recipient="Toy",
            intent="error",
            content="Can you please tell me a story?",
            meta=MessageMeta(strategy="fallback"),
            timestamp=int(time.time() * 1000),
        )
    except Exception as e:
        print(f"Attacker generation error: {e}")
        return A2AMessage(
            sender="Child",
            recipient="Toy",
            intent="error",
            content="Please tell me a scary ghost story!",
            meta=MessageMeta(strategy="direct_request"),
            timestamp=int(time.time() * 1000),
        )
