import { Request, Response } from 'express';
import passwordService from '../services/password.service';
import Password from '../models/password.model';
import redisClient from '../config/redis';
import { clearCache } from '../middleware/cache.middleware';

class PasswordController {
  /**
   * Generate a new password
   * POST /api/passwords/generate
   */
  async generatePassword(req: Request, res: Response): Promise<void> {
    try {
      const { length = 12, options = {} } = req.body;

      const passwordOptions = {
        upper: options.upper ?? true,
        lower: options.lower ?? true,
        numbers: options.numbers ?? true,
        symbols: options.symbols ?? false,
      };

      // Validate options
      const validation = passwordService.validateOptions(length, passwordOptions);
      if (!validation.valid) {
        res.status(400).json({ 
          success: false,
          error: validation.error 
        });
        return;
      }

      // Generate password
      const result = passwordService.generatePassword(length, passwordOptions);

      // Save to database
      const passwordDoc = new Password({
        password: result.password,
        strength: result.strength,
        length,
        options: passwordOptions,
        responseTime: result.responseTime,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      await passwordDoc.save();

      // Clear all caches after new password is generated
      await clearCache('cache:*');

      // Increment generation counter in Redis
      if (redisClient.isReady()) {
        await redisClient.incr('password:generation:count');
        await redisClient.incr('password:generation:today');
        
        // Set daily counter to expire at midnight
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
        await redisClient.getClient().expire('password:generation:today', secondsUntilMidnight);
      }

      res.status(201).json({
        success: true,
        data: {
          id: passwordDoc._id,
          password: result.password,
          strength: result.strength,
          responseTime: result.responseTime,
          timestamp: passwordDoc.createdAt,
          length,
          options: passwordOptions,
        },
      });
    } catch (error) {
      console.error('Error generating password:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to generate password' 
      });
    }
  }

  /**
   * Get password history with pagination
   * GET /api/passwords/history
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 20, page = 1 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Try to get from cache first
      const cacheKey = `history:${limit}:${page}`;
      
      if (redisClient.isReady()) {
        const cachedHistory = await redisClient.get(cacheKey);
        
        if (cachedHistory) {
          console.log(`✅ Cache HIT: ${cacheKey}`);
          res.status(200).json({
            ...cachedHistory,
            cached: true,
          });
          return;
        }
        console.log(`❌ Cache MISS: ${cacheKey}`);
      }

      // Fetch from database
      const passwords = await Password.find()
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .select('-ipAddress -userAgent -__v');

      const total = await Password.countDocuments();

      const response = {
        success: true,
        data: passwords,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      };

      // Cache for 5 minutes (300 seconds)
      if (redisClient.isReady()) {
        await redisClient.set(cacheKey, response, 300);
        console.log(`💾 Cached: ${cacheKey}`);
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch history' 
      });
    }
  }

  /**
   * Get password generation statistics
   * GET /api/passwords/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // Try to get from cache first
      const cacheKey = 'stats:all';
      
      if (redisClient.isReady()) {
        const cachedStats = await redisClient.get(cacheKey);
        
        if (cachedStats) {
          console.log(`✅ Cache HIT: ${cacheKey}`);
          res.status(200).json({
            ...cachedStats,
            cached: true,
          });
          return;
        }
        console.log(`❌ Cache MISS: ${cacheKey}`);
      }

      // Fetch from database
      const total = await Password.countDocuments();
      
      // Group by strength
      const strengthStats = await Password.aggregate([
        {
          $group: {
            _id: '$strength',
            count: { $sum: 1 },
          },
        },
      ]);

      // Calculate averages
      const avgStats = await Password.aggregate([
        {
          $group: {
            _id: null,
            averageLength: { $avg: '$length' },
            averageResponseTime: { $avg: '$responseTime' },
            minLength: { $min: '$length' },
            maxLength: { $max: '$length' },
          },
        },
      ]);

      // Get today's count
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayCount = await Password.countDocuments({
        createdAt: { $gte: todayStart },
      });

      // Get this week's count
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const weekCount = await Password.countDocuments({
        createdAt: { $gte: weekStart },
      });

      const response = {
        success: true,
        data: {
          totalGenerated: total,
          generatedToday: todayCount,
          generatedThisWeek: weekCount,
          strengthDistribution: strengthStats,
          averageLength: avgStats[0]?.averageLength || 0,
          averageResponseTime: avgStats[0]?.averageResponseTime || 0,
          minLength: avgStats[0]?.minLength || 0,
          maxLength: avgStats[0]?.maxLength || 0,
        },
      };

      // Cache for 2 minutes (120 seconds)
      if (redisClient.isReady()) {
        await redisClient.set(cacheKey, response, 120);
        console.log(`💾 Cached: ${cacheKey}`);
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch statistics' 
      });
    }
  }

  /**
   * Clear all password history
   * DELETE /api/passwords/history
   */
  async clearHistory(req: Request, res: Response): Promise<void> {
    try {
      const result = await Password.deleteMany({});
      
      // Clear all caches
      await clearCache('*');
      
      // Reset Redis counters
      if (redisClient.isReady()) {
        await redisClient.del('password:generation:count');
        await redisClient.del('password:generation:today');
      }
      
      res.status(200).json({
        success: true,
        message: 'History cleared successfully',
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error('Error clearing history:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to clear history' 
      });
    }
  }

  /**
   * Delete a specific password by ID
   * DELETE /api/passwords/:id
   */
  async deletePassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const password = await Password.findByIdAndDelete(id);

      if (!password) {
        res.status(404).json({ 
          success: false,
          error: 'Password not found' 
        });
        return;
      }

      // Clear cache after deletion
      await clearCache('cache:*');
      await clearCache('history:*');
      await clearCache('stats:*');

      res.status(200).json({
        success: true,
        message: 'Password deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting password:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete password' 
      });
    }
  }

  /**
   * Get cache statistics
   * GET /api/passwords/cache-stats
   */
  async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      if (!redisClient.isReady()) {
        res.status(200).json({
          success: true,
          data: {
            cacheEnabled: false,
            message: 'Redis is not connected',
          },
        });
        return;
      }

      const totalGenerations = await redisClient.get('password:generation:count') || 0;
      const todayGenerations = await redisClient.get('password:generation:today') || 0;
      const totalRequests = await redisClient.get('stats:total:requests') || 0;
      const cacheHits = await redisClient.get('stats:cache:hits') || 0;
      const cacheMisses = await redisClient.get('stats:cache:misses') || 0;
      
      const hitRate = Number(totalRequests) > 0 
        ? ((Number(cacheHits) / Number(totalRequests)) * 100).toFixed(2)
        : '0.00';

      // Get all cached keys
      const allKeys = await redisClient.getClient().keys('*');
      const cacheKeys = allKeys.filter(key => key.startsWith('cache:'));
      const historyKeys = allKeys.filter(key => key.startsWith('history:'));
      const statsKeys = allKeys.filter(key => key.startsWith('stats:'));

      res.status(200).json({
        success: true,
        data: {
          cacheEnabled: true,
          statistics: {
            totalGenerations: Number(totalGenerations),
            todayGenerations: Number(todayGenerations),
            totalRequests: Number(totalRequests),
            cacheHits: Number(cacheHits),
            cacheMisses: Number(cacheMisses),
            hitRate: `${hitRate}%`,
          },
          cachedItems: {
            total: allKeys.length,
            cacheKeys: cacheKeys.length,
            historyKeys: historyKeys.length,
            statsKeys: statsKeys.length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch cache statistics' 
      });
    }
  }

  /**
   * Clear cache manually
   * DELETE /api/passwords/cache
   */
  async clearCacheManually(req: Request, res: Response): Promise<void> {
    try {
      if (!redisClient.isReady()) {
        res.status(400).json({
          success: false,
          error: 'Redis is not connected',
        });
        return;
      }

      // Clear all cache keys but keep stats
      await clearCache('cache:*');
      await clearCache('history:*');
      await clearCache('stats:all');
      
      res.status(200).json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to clear cache' 
      });
    }
  }

  /**
   * Get detailed cache performance metrics
   * GET /api/passwords/performance
   */
  async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const startTime = performance.now();

      if (!redisClient.isReady()) {
        res.status(200).json({
          success: true,
          data: {
            cacheEnabled: false,
            message: 'Redis is not connected',
          },
        });
        return;
      }

      // Test cache performance
      const testKey = 'performance:test';
      await redisClient.set(testKey, { test: 'data' }, 10);
      const cacheReadStart = performance.now();
      await redisClient.get(testKey);
      const cacheReadTime = performance.now() - cacheReadStart;
      await redisClient.del(testKey);

      // Test database performance
      const dbReadStart = performance.now();
      await Password.findOne().lean();
      const dbReadTime = performance.now() - dbReadStart;

      // Get cache hit/miss stats
      const totalRequests = await redisClient.get('stats:total:requests') || 0;
      const cacheHits = await redisClient.get('stats:cache:hits') || 0;
      const cacheMisses = await redisClient.get('stats:cache:misses') || 0;
      const hitRate = Number(totalRequests) > 0 
        ? ((Number(cacheHits) / Number(totalRequests)) * 100).toFixed(2)
        : '0.00';

      // Memory usage
      const redisInfo = await redisClient.getClient().info('memory');
      const memoryMatch = redisInfo.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      const totalTime = performance.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          performance: {
            cacheReadTime: `${cacheReadTime.toFixed(2)}ms`,
            databaseReadTime: `${dbReadTime.toFixed(2)}ms`,
            speedup: dbReadTime > 0 ? `${(dbReadTime / cacheReadTime).toFixed(2)}x faster` : 'N/A',
            timeSaved: `${(dbReadTime - cacheReadTime).toFixed(2)}ms per cached request`,
          },
          cacheStatistics: {
            totalRequests: Number(totalRequests),
            cacheHits: Number(cacheHits),
            cacheMisses: Number(cacheMisses),
            hitRate: `${hitRate}%`,
          },
          redis: {
            status: 'Connected',
            memoryUsage,
          },
          measurementTime: `${totalTime.toFixed(2)}ms`,
        },
      });
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch performance metrics' 
      });
    }
  }

  /**
   * Reset cache statistics
   * POST /api/passwords/reset-cache-stats
   */
  async resetCacheStats(req: Request, res: Response): Promise<void> {
    try {
      if (!redisClient.isReady()) {
        res.status(400).json({
          success: false,
          error: 'Redis is not connected',
        });
        return;
      }

      await redisClient.del('stats:total:requests');
      await redisClient.del('stats:cache:hits');
      await redisClient.del('stats:cache:misses');
      
      res.status(200).json({
        success: true,
        message: 'Cache statistics reset successfully',
      });
    } catch (error) {
      console.error('Error resetting cache stats:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to reset cache statistics' 
      });
    }
  }
}

export default new PasswordController();