'use client';
import useSWR from 'swr';
import { fetcher, POLL_MS } from './api';

/*
 * Thin wrapper around SWR that polls the given endpoint on an interval.
 * This is our REAL-TIME strategy (see PART: Real-time data for the rationale).
 * Polling is used instead of WebSockets/SSE because it survives Render's free
 * tier sleeping, needs no persistent connection, and works cleanly on Vercel.
 */
export function useLiveData(path, { interval = POLL_MS, ...opts } = {}) {
  const { data, error, isLoading, mutate } = useSWR(path, fetcher, {
    refreshInterval: interval,
    revalidateOnFocus: true,
    keepPreviousData: true,
    ...opts,
  });

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
