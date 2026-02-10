import { Router } from 'express';
import passwordController from '../controllers/password.controller';
import { cacheMiddleware } from '../middleware/cache.middleware';

const router = Router();

/**
 * @route   POST /api/passwords/generate
 * @desc    Generate a new password
 * @access  Public
 */
router.post('/generate', passwordController.generatePassword);

/**
 * @route   GET /api/passwords/history
 * @desc    Get password history with pagination (cached)
 * @access  Public
 */
router.get(
  '/history',
  cacheMiddleware({ ttl: 300, keyPrefix: 'cache' }), // Cache for 5 minutes
  passwordController.getHistory
);

/**
 * @route   GET /api/passwords/stats
 * @desc    Get password generation statistics (cached)
 * @access  Public
 */
router.get(
  '/stats',
  cacheMiddleware({ ttl: 120, keyPrefix: 'cache' }), // Cache for 2 minutes
  passwordController.getStats
);

/**
 * @route   DELETE /api/passwords/history
 * @desc    Clear all password history
 * @access  Public
 */
router.delete('/history', passwordController.clearHistory);

/**
 * @route   DELETE /api/passwords/:id
 * @desc    Delete a specific password
 * @access  Public
 */
router.delete('/:id', passwordController.deletePassword);

/**
 * @route   GET /api/passwords/cache-stats
 * @desc    Get cache statistics
 * @access  Public
 */
router.get('/cache-stats', passwordController.getCacheStats);

/**
 * @route   DELETE /api/passwords/cache
 * @desc    Clear cache manually
 * @access  Public
 */
router.delete('/cache', passwordController.clearCacheManually);

/**
 * @route   GET /api/passwords/performance
 * @desc    Get cache performance metrics
 * @access  Public
 */
router.get('/performance', passwordController.getPerformanceMetrics);

/**
 * @route   POST /api/passwords/reset-cache-stats
 * @desc    Reset cache statistics
 * @access  Public
 */
router.post('/reset-cache-stats', passwordController.resetCacheStats);

export default router;