import { Router } from 'express';
import passwordController from '../controllers/password.controller';

const router = Router();

/**
 * @route   POST /api/passwords/generate
 * @desc    Generate a new password
 * @access  Public
 */
router.post('/generate', passwordController.generatePassword);

/**
 * @route   GET /api/passwords/history
 * @desc    Get password history with pagination
 * @access  Public
 */
router.get('/history', passwordController.getHistory);

/**
 * @route   GET /api/passwords/stats
 * @desc    Get password generation statistics
 * @access  Public
 */
router.get('/stats', passwordController.getStats);

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

export default router;