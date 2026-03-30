/**
 * Rate Limiter for Supabase Free Tier Constraints
 * - Max 50 concurrent connections
 * - Max 200 API requests per 60 seconds
 */

interface QueuedRequest {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  retries: number;
}

class RateLimiter {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private requestTimestamps: number[] = [];
  
  // Configuration
  private maxConcurrent = 10; // Conservative limit (out of 50 max connections)
  private maxRequestsPer60s = 150; // Conservative limit (out of 200 max)
  private requestWindow = 60000; // 60 seconds in ms
  private maxRetries = 3;
  private baseRetryDelay = 1000; // 1 second
  
  constructor() {
    this.startProcessor();
  }

  /**
   * Execute a function with rate limiting
   * @param fn - Async function to execute
   * @param priority - Higher priority requests go first (default 0)
   */
  async execute<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${Date.now()}-${Math.random()}`,
        fn,
        resolve,
        reject,
        retries: 0,
      };

      // Insert by priority (higher priority first)
      if (priority > 0) {
        let inserted = false;
        for (let i = 0; i < this.queue.length; i++) {
          if (priority > (this.queue[i] as any).priority) {
            this.queue.splice(i, 0, request);
            inserted = true;
            break;
          }
        }
        if (!inserted) this.queue.push(request);
      } else {
        this.queue.push(request);
      }
    });
  }

  /**
   * Process queued requests at controlled rate
   */
  private startProcessor() {
    setInterval(() => {
      this.processQueue();
    }, 100); // Check every 100ms
  }

  /**
   * Main processing loop
   */
  private async processQueue() {
    while (this.queue.length > 0 && this.canProcessRequest()) {
      const request = this.queue.shift();
      if (!request) break;

      this.activeRequests++;
      this.requestTimestamps.push(Date.now());

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error: any) {
        // Retry logic with exponential backoff
        if (request.retries < this.maxRetries) {
          request.retries++;
          const delay = this.baseRetryDelay * Math.pow(2, request.retries - 1);
          
          console.warn(`Rate limiter retry ${request.retries}/${this.maxRetries} after ${delay}ms`, error?.message);
          
          // Re-queue with delay
          setTimeout(() => {
            this.queue.unshift(request);
          }, delay);
        } else {
          console.error(`Request failed after ${this.maxRetries} retries`, error);
          request.reject(error);
        }
      } finally {
        this.activeRequests--;
      }
    }
  }

  /**
   * Check if we can process another request
   */
  private canProcessRequest(): boolean {
    // Check concurrent connection limit
    if (this.activeRequests >= this.maxConcurrent) {
      return false;
    }

    // Check 60-second request rate limit
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.requestWindow
    );

    if (recentRequests.length >= this.maxRequestsPer60s) {
      return false;
    }

    // Clean old timestamps
    this.requestTimestamps = recentRequests;
    return true;
  }

  /**
   * Get current status
   */
  getStatus() {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.requestWindow
    );

    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      requestsInLast60s: recentRequests.length,
      maxConcurrent: this.maxConcurrent,
      maxRequestsPer60s: this.maxRequestsPer60s,
      utilisationPercent: Math.round(
        ((this.activeRequests / this.maxConcurrent) * 100 + 
         (recentRequests.length / this.maxRequestsPer60s) * 100) / 2
      ),
    };
  }

  /**
   * Set configuration (for testing or custom limits)
   */
  configure(config: Partial<{
    maxConcurrent: number;
    maxRequestsPer60s: number;
    maxRetries: number;
    baseRetryDelay: number;
  }>) {
    if (config.maxConcurrent) this.maxConcurrent = config.maxConcurrent;
    if (config.maxRequestsPer60s) this.maxRequestsPer60s = config.maxRequestsPer60s;
    if (config.maxRetries) this.maxRetries = config.maxRetries;
    if (config.baseRetryDelay) this.baseRetryDelay = config.baseRetryDelay;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Hook wrapper for React components
 */
export function useRateLimiter() {
  return {
    execute: (fn: () => Promise<any>, priority?: number) => 
      rateLimiter.execute(fn, priority),
    getStatus: () => rateLimiter.getStatus(),
    configure: (config: any) => rateLimiter.configure(config),
  };
}
