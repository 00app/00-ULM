# ZeroResearch Agent (OpenClaw)

Copy this folder to your OpenClaw agents directory so the gateway loads the agent:

```bash
mkdir -p ~/.openclaw/agents/ZeroResearch
cp -r config/openclaw/agents/ZeroResearch/* ~/.openclaw/agents/ZeroResearch/
```

- **SOUL.md** — Core truths, research protocol, and calculation rules (survives context compaction in OpenClaw v1.2+).
- **USER.md** — Optional: template for per-user context (postcode, home_type, etc.) so the agent does not suggest e.g. Heat Pump grants to renters.
