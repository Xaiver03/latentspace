import type { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { AppError } from "./error-handler";

interface TypedRequest<TBody = unknown, TQuery = unknown, TParams = unknown> extends Omit<Request, 'body' | 'query' | 'params'> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

// Create typed validation middleware
export function validate<TBody = unknown, TQuery = unknown, TParams = unknown>(
  schemas: ValidationSchemas
) {
  return (
    req: TypedRequest<TBody, TQuery, TParams>,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw AppError.validation("Invalid request data", error.errors);
      }
      throw error;
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  id: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
    sort: z.string().optional(),
    order: z.enum(["asc", "desc"]).default("desc"),
  }),

  search: z.object({
    q: z.string().min(1).optional(),
    category: z.string().optional(),
  }),
};

// Authentication middleware (replacing any types)
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.isAuthenticated() || !req.user) {
    throw AppError.unauthorized();
  }
  next();
}

// Admin authorization middleware
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.isAuthenticated() || !req.user) {
    throw AppError.unauthorized();
  }
  
  if (req.user.role !== "admin") {
    throw AppError.forbidden("Admin access required");
  }
  
  next();
}

// Role-based authorization
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated() || !req.user) {
      throw AppError.unauthorized();
    }
    
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden(`One of the following roles required: ${roles.join(", ")}`);
    }
    
    next();
  };
}

// Resource ownership validation
export function requireOwnership(resourceIdParam: string = "id") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated() || !req.user) {
      throw AppError.unauthorized();
    }

    const resourceId = parseInt(req.params[resourceIdParam]);
    const userId = req.user.id;

    // This should be customized based on the resource type
    // For now, we'll add this as a placeholder
    if (req.user.role !== "admin") {
      // Add specific ownership checks in route handlers
      // throw AppError.forbidden("You don't own this resource");
    }
    
    next();
  };
}