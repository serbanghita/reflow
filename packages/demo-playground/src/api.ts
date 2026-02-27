import type { ScenarioMeta, ReflowInput, ReflowResult } from "./types";

const BASE = "/api";

export async function fetchScenarios(): Promise<ScenarioMeta[]> {
  const res = await fetch(`${BASE}/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios: ${res.statusText}`);
  return res.json();
}

export async function fetchScenario(key: string): Promise<ReflowInput> {
  const res = await fetch(`${BASE}/scenarios/${key}`);
  if (!res.ok) throw new Error(`Failed to fetch scenario '${key}': ${res.statusText}`);
  return res.json();
}

export async function runReflow(input: ReflowInput): Promise<ReflowResult> {
  const res = await fetch(`${BASE}/reflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Reflow failed: ${res.statusText}`);
  return res.json();
}
