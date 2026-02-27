import { DateTime } from "luxon";
import type { SettlementTask } from "./types.js";

export class CycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(" → ")}`);
    this.name = "CycleError";
  }
}

/**
 * Build adjacency list and in-degree map from settlement tasks.
 */
function buildGraph(tasks: SettlementTask[]): {
  adjacency: Map<string, string[]>;
  inDegree: Map<string, number>;
} {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const task of tasks) {
    adjacency.set(task.docId, []);
    inDegree.set(task.docId, 0);
  }

  const taskIds = new Set(tasks.map((t) => t.docId));

  // Build edges: if B dependsOn A, then edge A → B
  for (const task of tasks) {
    for (const depId of task.data.dependsOnTaskIds) {
      if (!taskIds.has(depId)) continue; // skip unknown deps
      adjacency.get(depId)!.push(task.docId);
      inDegree.set(task.docId, (inDegree.get(task.docId) ?? 0) + 1);
    }
  }

  return { adjacency, inDegree };
}

/**
 * Kahn's algorithm for topological sort with cycle detection.
 * Tie-breaks by original startDate (earliest first).
 *
 * Returns the sorted list of task docIds.
 * Throws CycleError if a cycle is detected.
 */
export function topologicalSort(tasks: SettlementTask[]): string[] {
  if (tasks.length === 0) return [];

  const { adjacency, inDegree } = buildGraph(tasks);
  const taskMap = new Map(tasks.map((t) => [t.docId, t]));

  // Collect all nodes with inDegree 0, sorted by startDate
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  sortByStartDate(queue, taskMap);

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const neighbors = adjacency.get(current) ?? [];
    const newRoots: string[] = [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        newRoots.push(neighbor);
      }
    }
    // Sort new roots by startDate and insert into queue maintaining order
    if (newRoots.length > 0) {
      sortByStartDate(newRoots, taskMap);
      // Merge newRoots into queue maintaining sorted order
      const merged: string[] = [];
      let qi = 0;
      let ni = 0;
      while (qi < queue.length && ni < newRoots.length) {
        if (compareByStartDate(queue[qi], newRoots[ni], taskMap) <= 0) {
          merged.push(queue[qi++]);
        } else {
          merged.push(newRoots[ni++]);
        }
      }
      while (qi < queue.length) merged.push(queue[qi++]);
      while (ni < newRoots.length) merged.push(newRoots[ni++]);
      queue.length = 0;
      queue.push(...merged);
    }
  }

  if (result.length !== tasks.length) {
    // Cycle detected — find the cycle for error message
    const remaining = tasks
      .filter((t) => !result.includes(t.docId))
      .map((t) => t.docId);
    throw new CycleError(remaining);
  }

  return result;
}

function sortByStartDate(
  ids: string[],
  taskMap: Map<string, SettlementTask>
): void {
  ids.sort((a, b) => compareByStartDate(a, b, taskMap));
}

function compareByStartDate(
  a: string,
  b: string,
  taskMap: Map<string, SettlementTask>
): number {
  const ta = taskMap.get(a)!;
  const tb = taskMap.get(b)!;
  const da = DateTime.fromISO(ta.data.startDate, { zone: "utc" });
  const db = DateTime.fromISO(tb.data.startDate, { zone: "utc" });
  return da.toMillis() - db.toMillis();
}
