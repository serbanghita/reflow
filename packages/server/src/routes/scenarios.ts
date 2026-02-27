import { Router } from "express";
import type { ReflowInput } from "@reflow/engine/types";
import { delayCascadeScenario } from "@reflow/engine/scenarios/delay-cascade";
import { blackoutScenario } from "@reflow/engine/scenarios/blackout";
import { multiConstraintScenario } from "@reflow/engine/scenarios/multi-constraint";
import { channelContentionScenario } from "@reflow/engine/scenarios/channel-contention";
import {
  circularDependencyScenario,
  regulatoryHoldConflictScenario,
  deadlineBreachScenario,
} from "@reflow/engine/scenarios/impossible";

interface ScenarioMeta {
  key: string;
  name: string;
  description: string;
  input: ReflowInput;
}

const scenarios: ScenarioMeta[] = [
  {
    key: "delay-cascade",
    name: "Scenario 1: Delay Cascade",
    description:
      "Fund transfer arrives 3 hours late. Margin check, disbursement, and reconciliation all shift downstream through the dependency chain.",
    input: delayCascadeScenario,
  },
  {
    key: "blackout",
    name: "Scenario 2: Market Hours + Blackout",
    description:
      "120-min task starts Mon 3PM. Pauses at market close, skips Tue 8-9AM Fedwire blackout, completes Tue 10AM.",
    input: blackoutScenario,
  },
  {
    key: "multi-constraint",
    name: "Scenario 3: Multi-Constraint",
    description:
      "Dependencies + channel conflict + blackout simultaneously. Task B blocked by A and blackout, Task C queued behind B.",
    input: multiConstraintScenario,
  },
  {
    key: "channel-contention",
    name: "Scenario 4: Channel Contention",
    description:
      "3 independent tasks compete for one ACH channel. Greedy earliest-fit sequences them without overlaps.",
    input: channelContentionScenario,
  },
  {
    key: "circular-dependency",
    name: "Scenario 5a: Circular Dependency",
    description:
      "Task A depends on B, B depends on A. CycleError detected before scheduling begins.",
    input: circularDependencyScenario,
  },
  {
    key: "regulatory-hold-conflict",
    name: "Scenario 5b: Regulatory Hold Conflict",
    description:
      "Pinned regulatory hold overlaps a blackout window. Hold cannot move, so conflict is reported as error.",
    input: regulatoryHoldConflictScenario,
  },
  {
    key: "deadline-breach",
    name: "Scenario 5c: Deadline Breach (SLA)",
    description:
      "Late start + cascading dependencies push final task past the T+1 settlement deadline. SLA breach detected.",
    input: deadlineBreachScenario,
  },
];

const router = Router();

router.get("/", (_req, res) => {
  const list = scenarios.map(({ key, name, description }) => ({
    key,
    name,
    description,
  }));
  res.json(list);
});

router.get("/:key", (req, res) => {
  const scenario = scenarios.find((s) => s.key === req.params.key);
  if (!scenario) {
    res.status(404).json({ error: `Scenario '${req.params.key}' not found` });
    return;
  }
  res.json(scenario.input);
});

export { router as scenariosRouter };
