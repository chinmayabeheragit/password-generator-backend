import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis'; // ❌ WRONG: '../src/config/redis'

interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
}

export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = 300, keyPrefix = 'cache' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if Redis is not connected
    if (!redisClient.isReady()) {
      return next();
    }

    try {
      const cacheKey = `${keyPrefix}:${req.originalUrl}`;
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.status(200).json({
          ...cachedData,
          cached: true,
        });
      }

      console.log(`❌ Cache MISS: ${cacheKey}`);

      const originalJson = res.json.bind(res);

      res.json = function (body: any) {
        if (res.statusCode === 200) {
          redisClient.set(cacheKey, body, ttl).catch((err) => {
            console.error('Failed to cache response:', err);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

export const clearCache = async (pattern: string): Promise<void> => {
  try {
    if (redisClient.isReady()) {
      await redisClient.delPattern(pattern);
      console.log(`🗑️  Cache cleared: ${pattern}`);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

