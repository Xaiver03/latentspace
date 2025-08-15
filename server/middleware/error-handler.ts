import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED",
  AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  statusCode: number;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = "AppError";
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  static unauthorized(message: string = "Authentication required"): AppError {
    return new AppError(ErrorCode.AUTHENTICATION_REQUIRED, message, 401);
  }

  static forbidden(message: string = "Access denied"): AppError {
    return new AppError(ErrorCode.AUTHORIZATION_FAILED, message, 403);
  }

  static notFound(message: string = "Resource not found"): AppError {
    return new AppError(ErrorCode.RESOURCE_NOT_FOUND, message, 404);
  }

  static conflict(message: string = "Resource conflict"): AppError {
    return new AppError(ErrorCode.RESOURCE_CONFLICT, message, 409);
  }

  static rateLimit(message: string = "Rate limit exceeded"): AppError {
    return new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
  }

  static internal(message: string = "Internal server error", details?: unknown): AppError {
    return new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details);
  }

  static database(message: string = "Database error", details?: unknown): AppError {
    return new AppError(ErrorCode.DATABASE_ERROR, message, 500, details);
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let apiError: ApiError;

  if (error instanceof AppError) {
    // Already a structured app error
    apiError = {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  } else if (error instanceof ZodError) {
    // Zod validation error
    const validationError = fromZodError(error);
    apiError = {
      code: ErrorCode.VALIDATION_ERROR,
      message: "Validation failed",
      statusCode: 400,
      details: validationError.details,
    };
  } else if (error.message?.includes("duplicate key") || error.message?.includes("unique constraint")) {
    // Database constraint violation
    apiError = {
      code: ErrorCode.RESOURCE_CONFLICT,
      message: "Resource already exists",
      statusCode: 409,
    };
  } else {
    // Unknown error
    console.error("Unhandled error:", error);
    apiError = {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
      statusCode: 500,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  // Log error for monitoring
  if (apiError.statusCode >= 500) {
    console.error(`[${apiError.code}] ${apiError.message}`, {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      details: apiError.details,
    });
  }

  res.status(apiError.statusCode).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      details: apiError.details,
    },
  });
}

// Async error wrapper for route handlers
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}