import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { AppError } from "./error-handler";

// General API rate limit
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later",
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    throw AppError.rateLimit();
  },
});

// Strict rate limit for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later",
    },
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    throw AppError.rateLimit("Too many authentication attempts");
  },
});

// Per-user rate limit for resource creation
export const createResourceRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 resource creations per hour
  keyGenerator: (req: Request) => {
    return req.user?.id ? `user:${req.user.id}` : req.ip || "anonymous";
  },
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many resources created, please try again later",
    },
  },
  handler: (req, res) => {
    throw AppError.rateLimit("Too many resources created");
  },
});

// File upload rate limit
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 uploads per hour
  keyGenerator: (req: Request) => {
    return req.user?.id ? `upload:${req.user.id}` : req.ip || "anonymous";
  },
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many uploads, please try again later",
    },
  },
  handler: (req, res) => {
    throw AppError.rateLimit("Upload limit exceeded");
  },
});

// Admin operations rate limit
export const adminRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit admin operations
  keyGenerator: (req: Request) => {
    return req.user?.id ? `admin:${req.user.id}` : req.ip || "anonymous";
  },
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many admin operations, please try again later",
    },
  },
  handler: (req, res) => {
    throw AppError.rateLimit("Admin operation limit exceeded");
  },
});