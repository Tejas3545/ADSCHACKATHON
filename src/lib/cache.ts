/**
 * Server-side cache manager for leaderboard data
 * Reduces database load and improves response time
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ServerCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly DEFAULT_TTL = 15 * 1000; // 15 seconds default
  
  /**
   * Get cached data if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set cache with optional TTL (time to live in milliseconds)
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }
  
  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Invalidate all cache keys matching a pattern
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache stats
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
    };
  }
  
  /**
   * Clean expired entries (run periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const serverCache = new ServerCache();

// Cleanup expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    serverCache.cleanup();
  }, 60 * 1000);
}

/**
 * Cache keys enum for consistency
 */
export const CacheKeys = {
  LEADERBOARD: 'leaderboard:main',
  TEAM: (teamId: string) => `team:${teamId}`,
  MILESTONES: 'milestones:active',
  ADMIN_DASHBOARD: 'admin:dashboard',
} as const;

/**
 * Cache TTL configurations (in milliseconds)
 */
export const CacheTTL = {
  LEADERBOARD: 10 * 1000,      // 10 seconds - frequently updated
  TEAM: 15 * 1000,             // 15 seconds
  MILESTONES: 5 * 60 * 1000,   // 5 minutes - rarely changes
  ADMIN_DASHBOARD: 5 * 1000,   // 5 seconds
} as const;
