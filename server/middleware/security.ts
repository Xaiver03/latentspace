import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "./error-handler";

const scryptAsync = promisify(scrypt);

// Enhanced password validation schema
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
  .refine((password) => {
    // Check for common patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
    ];
    return !commonPatterns.some(pattern => pattern.test(password));
  }, "Password contains common patterns and is not secure")
  .refine((password) => {
    // Check for repeated characters
    return !/(.)\1{2,}/.test(password);
  }, "Password cannot contain more than 2 consecutive identical characters");

// Username validation schema
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters long")
  .max(30, "Username must not exceed 30 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
  .refine((username) => {
    // Prevent reserved usernames
    const reserved = [
      "admin", "administrator", "root", "system", "api", "www", "mail", "ftp",
      "support", "help", "info", "contact", "about", "privacy", "terms",
      "login", "register", "signup", "signin", "logout", "profile", "settings"
    ];
    return !reserved.includes(username.toLowerCase());
  }, "This username is reserved and cannot be used");

// Email validation schema  
export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .max(254, "Email address is too long")
  .refine((email) => {
    // Check for disposable email domains
    const disposableDomains = [
      "10minutemail.com", "tempmail.org", "guerrillamail.com", "mailinator.com"
    ];
    const domain = email.split("@")[1]?.toLowerCase();
    return !disposableDomains.includes(domain);
  }, "Disposable email addresses are not allowed");

export interface PasswordStrengthResult {
  score: number; // 0-4
  feedback: string[];
  isStrong: boolean;
}

export class SecurityService {
  // Enhanced password hashing with higher cost
  static async hashPassword(password: string): Promise<string> {
    // Validate password strength first
    passwordSchema.parse(password);
    
    const salt = randomBytes(32).toString("hex"); // Increased salt size
    const iterations = 64;
    const keyLength = 64;
    
    const buf = (await scryptAsync(password, salt, keyLength)) as Buffer;
    return `${buf.toString("hex")}.${salt}.${iterations}`;
  }

  static async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    try {
      const [hashed, salt, iterations] = stored.split(".");
      const hashedBuf = Buffer.from(hashed, "hex");
      const keyLength = hashedBuf.length;
      
      const suppliedBuf = (await scryptAsync(supplied, salt, keyLength)) as Buffer;
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } catch (error) {
      return false;
    }
  }

  // Check if password needs rehashing (older format or weaker parameters)
  static needsRehash(hash: string): boolean {
    const parts = hash.split(".");
    if (parts.length !== 3) return true; // Old format
    
    const iterations = parseInt(parts[2]);
    return iterations < 64; // Upgrade if less than current standard
  }

  // Analyze password strength
  static analyzePasswordStrength(password: string): PasswordStrengthResult {
    let score = 0;
    const feedback: string[] = [];

    // Length check
    if (password.length >= 8) score++;
    else feedback.push("Use at least 8 characters");

    if (password.length >= 12) score++;
    else feedback.push("Use 12 or more characters for better security");

    // Character variety
    if (/[a-z]/.test(password)) score++;
    else feedback.push("Add lowercase letters");

    if (/[A-Z]/.test(password)) score++;
    else feedback.push("Add uppercase letters");

    if (/[0-9]/.test(password)) score++;
    else feedback.push("Add numbers");

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push("Add special characters");

    // Pattern checks
    if (/(.)\1{2,}/.test(password)) {
      score--;
      feedback.push("Avoid repeated characters");
    }

    if (/123|abc|qwe/i.test(password)) {
      score--;
      feedback.push("Avoid common sequences");
    }

    // Normalize score to 0-4 range
    score = Math.max(0, Math.min(4, score));

    return {
      score,
      feedback,
      isStrong: score >= 3
    };
  }

  // Generate secure random password
  static generateSecurePassword(length: number = 16): string {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = "";
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split("").sort(() => Math.random() - 0.5).join("");
  }
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy
  res.setHeader("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  
  next();
}

// Request sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  // Remove null bytes and other dangerous characters
  const sanitize = (obj: any): any => {
    if (typeof obj === "string") {
      return obj.replace(/\0/g, "").trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[sanitize(key)] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
}

// Session timeout middleware
export function sessionTimeout(timeoutMinutes: number = 30) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.session && req.user) {
      const now = Date.now();
      const session = req.session as any;
      const lastActivity = session.lastActivity || now;
      const timeoutMs = timeoutMinutes * 60 * 1000;
      
      if (now - lastActivity > timeoutMs) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destruction error:", err);
          }
        });
        throw AppError.unauthorized("Session expired");
      }
      
      session.lastActivity = now;
    }
    
    next();
  };
}