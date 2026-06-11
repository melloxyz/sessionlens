import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiOptions<T> {
  initialData?: T;
  immediate?: boolean;
  retries?: number;
  cache?: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: string;
}

interface CacheEntry {
  data: unknown;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 50;

const responseCache = new Map<string, CacheEntry>();

export function invalidateAllCaches(): void {
  responseCache.clear();
}
const inFlightRequests = new Map<string, Promise<unknown>>();

export function useApi<T>(url: string | null, options: UseApiOptions<T> = {}) {
  const { initialData, immediate = true, retries = 4, cache = true } = options;
  const initialValue = (cache ? getCachedData<T>(url) : undefined) ?? initialData;
  const initialDataRef = useRef(initialData);
  const dataRef = useRef<T | undefined>(initialValue);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [data, setStateData] = useState<T | undefined>(initialValue);
  const [loading, setLoading] = useState(
    () => immediate && Boolean(url) && initialValue === undefined,
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [validating, setValidating] = useState(false);

  const setData = useCallback((nextData: T | undefined) => {
    dataRef.current = nextData;
    setStateData(nextData);
  }, []);

  const fetchData = useCallback(
    async (force = false) => {
      if (!url) return;
      const requestId = ++requestIdRef.current;
      const cachedData = cache ? getCachedData<T>(url) : undefined;

      if (cachedData !== undefined && !force) {
        setData(cachedData);
        setLoading(false);
      } else {
        setLoading(dataRef.current === undefined);
      }

      setValidating(true);
      setError(null);

      const existingRequest = (cache && !force ? inFlightRequests.get(url) : undefined) as
        | Promise<T>
        | undefined;
      const request = existingRequest ?? requestWithRetries<T>(url, retries);
      if (cache && !existingRequest) inFlightRequests.set(url, request);

      try {
        const json = await request;
        if (cache) {
          if (responseCache.size >= CACHE_MAX_SIZE) {
            const firstKey = responseCache.keys().next().value;
            if (firstKey !== undefined) responseCache.delete(firstKey);
          }
          responseCache.set(url, { data: json, cachedAt: Date.now() });
        }

        if (mountedRef.current && requestIdRef.current === requestId) {
          setData(json);
          setLoading(false);
          setError(null);
        }

        return json;
      } catch (err) {
        if (mountedRef.current && requestIdRef.current === requestId) {
          setError(normalizeApiError(err));
          setLoading(false);
        }
        return undefined;
      } finally {
        if (inFlightRequests.get(url) === request) inFlightRequests.delete(url);
        if (mountedRef.current && requestIdRef.current === requestId) setValidating(false);
      }
    },
    [cache, retries, setData, url],
  );

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!url) {
      setData(initialDataRef.current);
      setLoading(false);
      setValidating(false);
      setError(null);
      return;
    }

    const cachedData = cache ? getCachedData<T>(url) : undefined;
    if (cachedData !== undefined) {
      setData(cachedData);
      setLoading(false);
    } else if (initialDataRef.current !== undefined) {
      setData(initialDataRef.current);
      setLoading(false);
    } else {
      setData(undefined);
      setLoading(immediate);
    }

    if (immediate) void fetchData(false);
  }, [fetchData, immediate, setData, url, cache]);

  return { data, loading, validating, error, refetch };
}

function getCachedData<T>(url: string | null): T | undefined {
  if (!url) return undefined;
  const entry = responseCache.get(url);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    responseCache.delete(url);
    return undefined;
  }
  return entry.data as T;
}

async function requestWithRetries<T>(url: string, retries: number): Promise<T> {
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestJson<T>(url);
    } catch (err) {
      lastError = normalizeApiError(err);
      if (attempt >= retries || !isRetryable(lastError)) break;
      await delay(500 + attempt * 350);
    }
  }

  throw lastError ?? { message: 'Unknown error' };
}

async function requestJson<T>(url: string): Promise<T> {
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
    const payload = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
    const nestedError =
      payload?.error && typeof payload.error === 'object'
        ? (payload.error as Record<string, unknown>)
        : null;
    throw {
      message:
        (nestedError?.message as string) ??
        (payload?.message as string) ??
        res.statusText ??
        'Request failed',
      status: res.status,
      code: (nestedError?.code ?? payload?.code) as string | undefined,
      details: (nestedError?.details ?? payload?.details ?? text) as string | undefined,
    } as ApiError;
  }

  return json as T;
}

function normalizeApiError(err: unknown): ApiError {
  if (typeof err === 'object' && err && 'message' in err) return err as ApiError;
  return { message: err instanceof Error ? err.message : 'Unknown error' };
}

function isRetryable(error: ApiError): boolean {
  return (
    error.status == null ||
    error.status >= 500 ||
    /ECONNREFUSED|Failed to fetch|fetch/i.test(error.details ?? error.message)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
