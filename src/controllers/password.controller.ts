import { Request, Response } from 'express';
import passwordService from '../services/password.service';
import Password from '../models/password.model';

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

      const passwords = await Password.find()
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .select('-ipAddress -userAgent -__v');

      const total = await Password.countDocuments();

      res.status(200).json({
        success: true,
        data: passwords,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
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

      res.status(200).json({
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
      });
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
}

export default new PasswordController();