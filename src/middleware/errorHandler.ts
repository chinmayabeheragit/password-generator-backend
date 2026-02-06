import { Request, Response, NextFunction } from 'express';

interface ErrorResponse {
  success: false;
  error: string;
  stack?: string;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  const errorResponse: ErrorResponse = {
    success: false,
    error: err.message || 'Internal Server Error',
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  res.status(500).json(errorResponse);
};

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
};