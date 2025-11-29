import * as React from "react";
import type { FheInstance } from "@zama-fhe/relayer-sdk/web";
import { initializeFHE } from "@/lib/fhe";

export function useFHE() {
  const [fhe, setFhe] = React.useState<FheInstance | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const initialize = React.useCallback(async () => {
    if (fhe || loading) return;
    try {
      setLoading(true);
      setError(null);
      const instance = await initializeFHE();
      setFhe(instance);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || "Failed to initialize FHE");
    } finally {
      setLoading(false);
    }
  }, [fhe, loading]);

  React.useEffect(() => {
    initializeFHE()
      .then((instance) => setFhe(instance))
      .catch(() => {
      });
  }, []);

  return {
    fhe,
    loading,
    error,
    initialize,
  };
}


