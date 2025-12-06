'use client';

import useSWRMutation from 'swr/mutation';
import { useAuth } from '@/components/AuthProvider';

interface GenkitError {
  message: string;
  status?: number;
}

// Generic fetcher for Genkit flows
async function fetcher<TArg, TResult>(
  url: string,
  { arg }: { arg: TArg },
  token: string | null
): Promise<TResult> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error?.message || response.statusText) as Error & GenkitError;
    error.status = response.status;
    throw error;
  }

  // Handle different response types (JSON vs Stream/Text)
  // For now, assuming JSON response for simple flows.
  // Streaming support requires a different approach (not fetcher/SWR mutation standardly).
  return response.json();
}

export function useGenkit<TInput = any, TOutput = any>(flowName: string) {
  const { getToken } = useAuth();

  const { trigger, data, error, isMutating, reset } = useSWRMutation<
    TOutput,
    Error & GenkitError,
    string,
    TInput
  >(
    `/api/genkit/${flowName}`,
    async (url: string, { arg }: { arg: TInput }) => {
      const token = await getToken();
      return fetcher(url, { arg }, token);
    }
  );

  return {
    runFlow: trigger,
    result: data,
    error,
    isLoading: isMutating,
    reset,
  };
}
