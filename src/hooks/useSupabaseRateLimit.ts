import { useCallback } from 'react';
import { rateLimiter } from '@/lib/rateLimiter';

/**
 * Hook for executing Supabase queries with automatic rate limiting
 * 
 * Usage:
 * const { execute } = useSupabaseRateLimit();
 * 
 * const data = await execute(() => 
 *   supabase.from('exams').select('*')
 * );
 */
export function useSupabaseRateLimit() {
  const execute = useCallback(async <T,>(
    queryFn: () => Promise<T>,
    priority = 0
  ): Promise<T> => {
    return rateLimiter.execute(queryFn, priority);
  }, []);

  const getStatus = useCallback(() => {
    return rateLimiter.getStatus();
  }, []);

  return { execute, getStatus };
}

/**
 * Higher-order function to wrap Supabase queries
 * 
 * Usage:
 * const limitedQuery = withRateLimit(() => supabase.from('exams').select('*'));
 * const data = await limitedQuery();
 */
export function withRateLimit<T extends any[], R>(
  asyncFn: (...args: T) => Promise<R>,
  priority = 0
) {
  return async (...args: T): Promise<R> => {
    return rateLimiter.execute(() => asyncFn(...args), priority);
  };
}
