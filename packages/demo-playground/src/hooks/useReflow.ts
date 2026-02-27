import { useState, useCallback } from "react";
import type { ReflowInput, ReflowResult } from "../types";
import { runReflow } from "../api";

export function useReflow() {
  const [beforeResult, setBeforeResult] = useState<ReflowResult | null>(null);
  const [afterResult, setAfterResult] = useState<ReflowResult | null>(null);
  const [lastInput, setLastInput] = useState<ReflowInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runInitial = useCallback(async (input: ReflowInput) => {
    setLoading(true);
    setError(null);
    setAfterResult(null);
    try {
      const result = await runReflow(input);
      setBeforeResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reflow failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const runDisruption = useCallback(async (modifiedInput: ReflowInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await runReflow(modifiedInput);
      setAfterResult(result);
      setLastInput(modifiedInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reflow failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setBeforeResult(null);
    setAfterResult(null);
    setLastInput(null);
    setError(null);
  }, []);

  return {
    beforeResult,
    afterResult,
    lastInput,
    loading,
    error,
    runInitial,
    runDisruption,
    reset,
  };
}
