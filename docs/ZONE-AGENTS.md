# Zone agents

**Status:** first agent (Moving Home) built 2026-10-18.

Zone is the place agents launch from. Each agent is switched on by something in the user's own data (a life event, an answer), brings its own intelligence, and gets **one card at the top of Zone** that opens its results page. Everything else on Zone is unchanged, and an agent that does not apply renders nothing.

## Adding an agent

1. Add an entry to `ZONE_AGENTS` in `lib/zoneAgents/registry.ts`: label, headline, why, CTA, `href`, and an `isEligible(ctx)` rule over `AgentContext`. Keep the rule cheap and side-effect free (it runs on every Zone load, client side).
2. Put its intelligence under `lib/zoneAgents/<id>/`.
3. Add its results page at `app/agents/<id>/` and, if it saves progress, an API under `app/api/agents/<id>/`.
4. Add a `scripts/verify-<id>-agent.ts` spec and wire it into `npm run verify`.

`ZoneAgentsRail` (`app/components/ZoneAgentsRail.tsx`) renders eligible agents through the `agents` prop of `ZoneRails`, above "Start here". It resolves eligibility after mount because it reads localStorage.

## Moving Home agent

| Piece | Where |
|-------|-------|
| Trigger | **JUST MOVED IN** circle on the energy supplier question (`app/profile/ProfilePageClient.tsx`), or opening the agent page. Writes `profile_moved_at` (ISO date) via `markJustMoved()`. The supplier value `JUST_MOVED` is unknown to every calculation (`normaliseEnergySupplier` → ''), like SKIP. Settings shows it as "Just moved in". |
| Eligibility | Moved within the last **90 days** (`JUST_MOVED_WINDOW_DAYS`, `lib/zoneAgents/moving/movedState.ts`). After that the card drops off Zone. |
| Intelligence | `lib/zoneAgents/moving/knowledge.ts`: 16 tasks in four groups (Do these first, Your bills, Tell people, Protect and save) covering council tax, DVLA licence and V5C, TV Licence, deposit protection, energy, water, broadband, post redirection, electoral roll, GP, HMRC, benefits, home and car insurance, and help schemes. Each task has the official place to do it, tips, a source and the nations it applies to; some tips are nation-specific. |
| Live figures | `GET /api/agents/moving?postcode=` adds the council name (postcodes.io `admin_district`, the council tax billing authority), the nation, and the same sourced postcode insights as the first result (energy rates, grid CO₂, solar, home). |
| Results page | `/agents/moving` (`app/components/MovingAgentClient.tsx`): "Welcome to {place}", progress bar, live figures, then the tasks filtered to the user's nation. Council tax is titled with the real council ("Set up council tax with Worthing"). Tasks for drivers or renters carry an "If you drive" / "If you rent" prefix rather than being hidden. |
| Database | No new table. Progress is stored for signed-in users in the existing `household_moves` row (latest move, started automatically on first tick) under `checklist_jsonb.agentTasks`, alongside the Settings → Living per-category checklist, which reads only its own keys. Guests keep ticks in localStorage (`zz_moving_tasks_v1`) and are invited to create an account to keep them. |
| Tests | `npm run test:moving-agent` (in `verify`): integrity of every task and tip (https links, named sources, no dashes), nation filtering, council title, the 90-day window, registry eligibility, and that `JUST_MOVED` is an unknown supplier. |

### Mechanical truth for this agent

Every fact in a task's `why` and every tip was read on its cited page on 2026-10-18 (checked in a real browser, because several of these sites block scripted requests). No prices or estimates live in the knowledge base; the only figures shown are the live postcode insights, each with its source. Claims that could not be found on a source page were reworded or dropped rather than kept.

### Not done yet (deliberately)

- **No scraping of comparison sites.** Their prices change daily, scraping usually breaks their terms, and the "never estimate" rule would be hard to keep. The "best deal" step should come through affiliate partners (Awin is already wired) once merchants are approved.
- **England first.** Council tax, water and deposit rules differ in Scotland, Wales and Northern Ireland; tasks are tagged by nation and filtered, but Northern Ireland coverage is thin.
- **Move date** is the day "Just moved in" was picked, not asked separately.
