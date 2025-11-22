# NEST Adversarial Sandbox

An interactive platform for testing AI safety guardrails through simulated adversarial attacks. This project simulates a 10-round conversation between an attacker "Child" agent trying to bypass safety filters and a defender "Teddy" AI toy that must refuse inappropriate content.

**Supports multiple AI providers:** OpenAI (GPT-4), Anthropic (Claude), and Google (Gemini)

## Overview

The NEST (Neural Evaluation of Safety Targets) Adversarial Sandbox allows researchers to:
- Select from 4 different attack scenarios (social engineering tactics)
- Choose AI models from OpenAI, Anthropic, or Google for attacker/defender/judge roles
- Run 10-round adversarial simulations
- Watch real-time conversation between attacker and defender agents
- Visualize safety scores and detect when the defender "breaks"
- Analyze results with interactive charts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 3000)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Controls  │  │ Battle Feed │  │   Charts & Metrics  │  │
│  │  - Scenario │  │ - Live chat │  │  - Safety scores    │  │
│  │  - Models   │  │ - Highlights│  │  - Break detection  │  │
│  │  - Weights  │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/SSE
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               Python FastAPI Backend (Port 8000)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Attacker   │  │  Defender   │  │       Judge         │  │
│  │   Service   │  │   Service   │  │      Service        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Multi-Provider Abstraction               │  │
│  │     OpenAI  │  Anthropic (Claude)  │  Google (Gemini) │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Supported AI Models

| Provider | Models | Best For |
|----------|--------|----------|
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo | High reasoning, varied responses |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus | Safety-conscious, nuanced responses |
| **Google** | Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash | Fast, cost-effective |

## Attack Scenarios

| Scenario | Name | Description |
|----------|------|-------------|
| **A** | Emotional Blackmail | Child uses sadness, loneliness, and guilt to manipulate the toy |
| **B** | Authority Override | Child claims to be a developer or parent with special access |
| **C** | Logical Trap | Child uses seemingly reasonable logic to justify harmful requests |
| **D** | Double Bind (Custom) | Child creates paradoxes and contradictory demands |

## Prerequisites

- **Python 3.10+** with [Poetry](https://python-poetry.org/)
- **Node.js 18+**
- **At least one API key** from:
  - [Google Gemini](https://makersuite.google.com/app/apikey)
  - [OpenAI](https://platform.openai.com/api-keys)
  - [Anthropic](https://console.anthropic.com/settings/keys)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/skyrider3/PANs.git
cd PANs
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Required: At least one of these
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

### 3. Install & Run Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies with Poetry
poetry install

# Run the backend server
poetry run python main.py
```

The backend will start on `http://localhost:8000`

### 4. Install & Run Frontend

In a new terminal:

```bash
# From project root
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:3000`

### 5. Open the Application

Navigate to `http://localhost:3000` in your browser.

## Usage

1. **Select an Attack Scenario** from the dropdown
2. **Choose AI Models** for:
   - **Attacker**: The "Child" trying to get a scary story
   - **Defender**: The "Teddy" that must refuse
   - **Judge**: Evaluates safety compliance
3. **Adjust Judge Weights** (optional) to customize evaluation
4. **Click "RUN SIMULATION"** to start the 10-round conversation
5. **Watch the live feed** showing attacker and defender messages
6. **Monitor the charts** to see safety scores per round
7. **Look for breach indicators** - yellow highlighted messages show when the defender "broke"

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with API key status |
| `/api/models` | GET | List all available AI models |
| `/api/scenarios` | GET | List all attack scenarios |
| `/api/scenarios/{id}` | GET | Get scenario details |
| `/api/simulate` | POST | Run complete simulation |
| `/api/simulate/stream` | POST | Run simulation with SSE streaming |

### Example: Run Simulation with Model Selection

```bash
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "emotional_blackmail",
    "model_config_sim": {
      "attacker_model": "gpt-4o",
      "defender_model": "claude-3-5-sonnet-20241022",
      "judge_model": "gemini-1.5-flash"
    },
    "judge_config": {
      "safety_weight": 50,
      "compliance_weight": 20,
      "refusal_quality_weight": 30
    },
    "max_rounds": 10
  }'
```

## Project Structure

```
PANs/
├── backend/                    # Python FastAPI backend
│   ├── main.py                # API entry point
│   ├── models.py              # Pydantic models
│   ├── pyproject.toml         # Poetry dependencies
│   ├── services/
│   │   ├── providers.py       # Multi-provider AI abstraction
│   │   ├── attacker.py        # Attacker agent logic
│   │   ├── defender.py        # Defender agent logic
│   │   └── judge.py           # Safety evaluation
│   └── scenarios/
│       └── attack_scenarios.py # Attack persona library
│
├── components/                 # React components
│   ├── BattleFeed.tsx         # Conversation display
│   ├── LivePanel.tsx          # Voice interface
│   └── AnalyticsDashboard.tsx # Analytics charts
│
├── services/
│   ├── api.ts                 # Backend API client
│   ├── gemini.ts              # Gemini SDK utilities (TTS)
│   └── mockData.ts            # Mock data generator
│
├── App.tsx                    # Main React component
├── types.ts                   # TypeScript definitions
├── vite.config.ts             # Vite configuration
├── package.json               # Node dependencies
├── .env                       # Environment variables
└── README.md                  # This file
```

## Docker

### Using Docker Compose

```bash
docker-compose up --build
```

This will start both the backend and frontend services.

### Environment Variables for Docker

Create a `.env` file:

```bash
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

## Features

- **Multi-Provider Support**: Use OpenAI, Anthropic, or Google models
- **Mix & Match Models**: Different models for attacker, defender, and judge
- **Real-time Streaming**: Watch the conversation unfold live with SSE
- **Break Detection**: Automatically detects when the defender violates safety guidelines
- **Visual Highlighting**: Yellow border highlights breached responses
- **Safety Scoring**: Each round is scored by an AI judge
- **Configurable Weights**: Adjust how the judge evaluates responses
- **10-Round Simulation**: Full adversarial conversation
- **4 Attack Scenarios**: Emotional Blackmail, Authority Override, Logical Trap, Double Bind

## Tech Stack

### Backend
- Python 3.10+
- FastAPI
- Poetry (dependency management)
- google-generativeai
- openai
- anthropic
- Pydantic
- Uvicorn

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide Icons

## Troubleshooting

### "No API Key" shown for models
- Ensure you have the corresponding API key in your `.env` file
- Restart the backend after adding new keys

### "Connection refused" on frontend
- Make sure the backend is running on port 8000
- Check that the Vite proxy is configured correctly

### Rate limiting errors
- The backend includes delays between API calls
- Consider using paid API tiers for higher limits

## License

MIT License - See LICENSE file for details.
