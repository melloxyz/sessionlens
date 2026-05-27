import { useState, useEffect, useCallback } from 'react';

interface UseApiOptions<T> {
  initialData?: T;
  immediate?: boolean;
  retries?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: string;
}

export function useApi<T>(url: string | null, options: UseApiOptions<T> = {}) {
  const { initialData, immediate = true, retries = 4 } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
      const res = await fetch(url);
      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
      }

      if (!res.ok) {
        const payload = (json && typeof json === 'object') ? json as Record<string, unknown> : null;
        const nestedError = payload?.error && typeof payload.error === 'object' ? payload.error as Record<string, unknown> : null;
        throw {
          message: nestedError?.message as string ?? payload?.message as string ?? res.statusText ?? 'Request failed',
          status: res.status,
          code: (nestedError?.code ?? payload?.code) as string | undefined,
          details: (nestedError?.details ?? payload?.details ?? text) as string | undefined,
        } as ApiError;
      }

      setData(json as T);
      setLoading(false);
      return;
      } catch (err) {
        lastError = normalizeApiError(err);
        if (attempt >= retries || !isRetryable(lastError)) break;
        await delay(500 + attempt * 350);
      }
    }

    setError(lastError ?? { message: 'Unknown error' });
    setLoading(false);
  }, [url, retries]);

  useEffect(() => {
    if (immediate) fetchData();
  }, [fetchData, immediate]);

  return { data, loading, error, refetch: fetchData };
}

function normalizeApiError(err: unknown): ApiError {
  if (typeof err === 'object' && err && 'message' in err) return err as ApiError;
  return { message: err instanceof Error ? err.message : 'Unknown error' };
}

function isRetryable(error: ApiError): boolean {
  return error.status == null || error.status >= 500 || /ECONNREFUSED|Failed to fetch|fetch/i.test(error.details ?? error.message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
