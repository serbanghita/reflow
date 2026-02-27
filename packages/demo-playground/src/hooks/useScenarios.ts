import { useState, useEffect, useCallback } from "react";
import type { ScenarioMeta, ReflowInput } from "../types";
import { fetchScenarios, fetchScenario } from "../api";

export function useScenarios() {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [input, setInput] = useState<ReflowInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScenarios()
      .then((list) => {
        setScenarios(list);
        if (list.length > 0) {
          setSelectedKey(list[0].key);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const selectScenario = useCallback(async (key: string) => {
    setSelectedKey(key);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScenario(key);
      setInput(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKey) {
      selectScenario(selectedKey);
    }
  }, [selectedKey, selectScenario]);

  return {
    scenarios,
    selectedKey,
    selectScenario,
    input,
    setInput,
    loading,
    error,
  };
}
