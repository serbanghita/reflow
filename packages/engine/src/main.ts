import { ReflowService } from "./reflow/reflow.service.js";
import type { ReflowInput, ReflowResult } from "./reflow/types.js";
import { delayCascadeScenario } from "./data/scenario-delay-cascade.js";
import { blackoutScenario } from "./data/scenario-blackout.js";
import { multiConstraintScenario } from "./data/scenario-multi-constraint.js";
import { channelContentionScenario } from "./data/scenario-channel-contention.js";
import {
  circularDependencyScenario,
  regulatoryHoldConflictScenario,
  deadlineBreachScenario,
} from "./data/scenario-impossible.js";

const service = new ReflowService();

interface Scenario {
  name: string;
  input: ReflowInput;
}

const scenarios: Scenario[] = [
  { name: "Scenario 1: Delay Cascade", input: delayCascadeScenario },
  { name: "Scenario 2: Market Hours + Blackout", input: blackoutScenario },
  { name: "Scenario 3: Multi-Constraint", input: multiConstraintScenario },
  { name: "Scenario 4: Channel Contention", input: channelContentionScenario },
  { name: "Scenario 5a: Circular Dependency", input: circularDependencyScenario },
  { name: "Scenario 5b: Regulatory Hold Conflict", input: regulatoryHoldConflictScenario },
  { name: "Scenario 5c: Deadline Breach (SLA)", input: deadlineBreachScenario },
];

function printDivider(char: string = "=", length: number = 72): void {
  console.log(char.repeat(length));
}

function printResult(name: string, result: ReflowResult): void {
  printDivider();
  console.log(`  ${name}`);
  printDivider();
  console.log();

  // Changes
  if (result.changes.length > 0) {
    console.log("  Changes:");
    for (const change of result.changes) {
      const direction = change.deltaMinutes >= 0 ? "+" : "";
      console.log(
        `    ${change.taskReference} | ${change.field}: ${change.oldValue} → ${change.newValue} (${direction}${change.deltaMinutes} min)`
      );
      console.log(`      Reason: ${change.reason}`);
    }
  } else {
    console.log("  No changes.");
  }
  console.log();

  // Updated schedule timeline
  if (result.updatedTasks.length > 0) {
    console.log("  Updated Schedule:");
    for (const task of result.updatedTasks) {
      const reg = task.data.isRegulatoryHold ? " [PINNED]" : "";
      console.log(
        `    ${task.data.taskReference} (${task.data.taskType}${reg}): ${task.data.startDate} → ${task.data.endDate} (${task.data.durationMinutes} min)`
      );
    }
  }
  console.log();

  // Metrics
  console.log("  Metrics:");
  console.log(`    Tasks affected: ${result.metrics.tasksAffected}`);
  console.log(`    Total delay: ${result.metrics.totalDelayMinutes} min`);

  const channels = Object.keys(result.metrics.channelUtilization);
  if (channels.length > 0) {
    console.log("    Channel utilization:");
    for (const ch of channels) {
      const util = (result.metrics.channelUtilization[ch] * 100).toFixed(1);
      const idle = result.metrics.channelIdleMinutes[ch] ?? 0;
      console.log(`      ${ch}: ${util}% utilization, ${idle} min idle`);
    }
  }

  if (result.metrics.slaBreaches.length > 0) {
    console.log("    SLA Breaches:");
    for (const breach of result.metrics.slaBreaches) {
      console.log(
        `      Task ${breach.taskId}: target ${breach.targetDate}, actual ${breach.actualEndDate} (+${breach.breachMinutes} min)`
      );
    }
  }
  console.log();

  // Explanation
  console.log("  Explanation:");
  for (const line of result.explanation) {
    console.log(`    ${line}`);
  }
  console.log();

  // Errors
  if (result.errors.length > 0) {
    console.log("  Errors:");
    for (const err of result.errors) {
      console.log(`    - ${err}`);
    }
    console.log();
  }
}

// Run all scenarios
console.log();
console.log("  Settlement Schedule Reflow Engine — Demo Output");
console.log();

for (const scenario of scenarios) {
  const result = service.reflow(scenario.input);
  printResult(scenario.name, result);
}

printDivider();
console.log("  All scenarios complete.");
printDivider();
