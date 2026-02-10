import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database';
import redisClient from './config/redis';
import passwordRoutes from './routes/password.routes';
import { errorHandler, notFound } from './middleware/errorHandler';

// Load environment variables FIRST
dotenv.config();

console.log('🔧 Environment variables loaded');
console.log('📍 Current directory:', __dirname);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔌 PORT:', process.env.PORT);
console.log('🗄️  MONGODB_URI:', process.env.MONGODB_URI);
console.log('📦 REDIS_HOST:', process.env.REDIS_HOST);
console.log('📦 REDIS_PORT:', process.env.REDIS_PORT);

const app: Application = express();
const PORT = process.env.PORT || 5000;

console.log('✅ Express app created');

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.CLIENT_URL
].filter(Boolean);

console.log('🔓 CORS origins configured:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('✅ Middleware configured');

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api/passwords', passwordRoutes);

console.log('✅ Routes configured');

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Password Generator API is running',
    timestamp: new Date().toISOString(),
    redis: redisClient.isReady() ? 'connected' : 'disconnected',
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Password Generator API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      generate: 'POST /api/passwords/generate',
      history: 'GET /api/passwords/history',
      stats: 'GET /api/passwords/stats',
      clearHistory: 'DELETE /api/passwords/history',
      deletePassword: 'DELETE /api/passwords/:id',
      cacheStats: 'GET /api/passwords/cache-stats',
      clearCache: 'DELETE /api/passwords/cache',
    },
  });
});

// Error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

console.log('✅ Error handlers configured');

// Start server
const startServer = async () => {
  console.log('🚀 Starting server...');
  
  try {
    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected');
    
    // Connect to Redis (non-blocking - app works without Redis)
    console.log('📦 Connecting to Redis...');
    try {
      await redisClient.connect();
      console.log('✅ Redis connected');
    } catch (redisError) {
      console.warn('⚠️  Redis connection failed. Continuing without cache.');
      console.warn('   Redis Error:', redisError);
    }
    
    // Start listening
    console.log('🎧 Starting Express server...');
    app.listen(PORT, () => {
      console.log('=================================');
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔓 CORS allowed origins:`, allowedOrigins);
      console.log(`📦 Redis: ${redisClient.isReady() ? '✅ Connected' : '❌ Disconnected'}`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: Error) => {
  console.error('❌ Unhandled Rejection:', error);
  console.error('❌ Stack:', error.stack);
  // Don't exit immediately in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('❌ Stack:', error.stack);
  // Don't exit immediately in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  await redisClient.disconnect();
  process.exit(0);
});

console.log('🎬 Calling startServer()...');
startServer().catch((error) => {
  console.error('❌ startServer() failed:', error);
  process.exit(1);
});