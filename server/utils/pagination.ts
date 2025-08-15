import { sql, eq, and, or, asc, desc, SQL, AnyColumn } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";
import { AppError } from "../middleware/error-handler";

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order: "asc" | "desc";
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterOptions {
  search?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
  dateRange?: {
    field: string;
    from?: Date;
    to?: Date;
  };
}

export class PaginationService {
  /**
   * Apply pagination to a Drizzle query
   */
  static paginate<T extends PgSelect>(
    query: T,
    options: PaginationOptions
  ): T {
    const { page, limit, sort, order } = options;
    
    // Validate pagination parameters
    if (page < 1) {
      throw AppError.validation("Page number must be greater than 0");
    }
    
    if (limit < 1 || limit > 100) {
      throw AppError.validation("Limit must be between 1 and 100");
    }

    const offset = (page - 1) * limit;
    
    let paginatedQuery = query.limit(limit).offset(offset);
    
    // Apply sorting if specified
    if (sort && order) {
      // This would need to be customized per table/service
      // For now, we'll let the service handle the sorting
    }
    
    return paginatedQuery as T;
  }

  /**
   * Create pagination metadata
   */
  static createPaginationResult<T>(
    data: T[],
    total: number,
    options: PaginationOptions
  ): PaginationResult<T> {
    const { page, limit } = options;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Build search conditions for text fields
   */
  static buildSearchConditions(
    searchTerm: string,
    fields: AnyColumn[],
    tableName?: string
  ): SQL | undefined {
    if (!searchTerm || !fields.length) {
      return undefined;
    }

    const searchConditions = fields.map(field => 
      sql`${field} ILIKE ${`%${searchTerm}%`}`
    );

    return or(...searchConditions);
  }

  /**
   * Build date range conditions
   */
  static buildDateRangeConditions(
    field: AnyColumn,
    from?: Date,
    to?: Date
  ): SQL | undefined {
    const conditions: SQL[] = [];

    if (from) {
      conditions.push(sql`${field} >= ${from}`);
    }

    if (to) {
      conditions.push(sql`${field} <= ${to}`);
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Build filter conditions for exact matches
   */
  static buildFilterConditions(
    filters: Record<string, any>,
    fieldMap: Record<string, AnyColumn>
  ): SQL | undefined {
    const conditions: SQL[] = [];

    for (const [key, value] of Object.entries(filters)) {
      const field = fieldMap[key];
      if (field && value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          // IN condition for arrays
          conditions.push(sql`${field} = ANY(${value})`);
        } else {
          conditions.push(eq(field, value));
        }
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Build sorting conditions
   */
  static buildSortConditions(
    sortField: string,
    order: "asc" | "desc",
    fieldMap: Record<string, AnyColumn>
  ): SQL | undefined {
    const field = fieldMap[sortField];
    if (!field) {
      return undefined;
    }

    return order === "asc" ? asc(field) : desc(field);
  }

  /**
   * Validate and sanitize pagination options
   */
  static sanitizePaginationOptions(
    options: Partial<PaginationOptions>
  ): PaginationOptions {
    const page = Math.max(1, Math.floor(Number(options.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 10)));
    const order = options.order === "asc" ? "asc" : "desc";
    const sort = typeof options.sort === "string" ? options.sort : undefined;

    return { page, limit, sort, order };
  }

  /**
   * Calculate pagination stats for performance monitoring
   */
  static calculatePaginationStats(
    total: number,
    options: PaginationOptions
  ): {
    efficiency: number;
    recommendation?: string;
  } {
    const { page, limit } = options;
    const totalPages = Math.ceil(total / limit);
    const efficiency = Math.max(0, 1 - (page - 1) / totalPages);

    let recommendation: string | undefined;
    
    if (page > 10 && limit < 50) {
      recommendation = "Consider using larger page sizes for deep pagination";
    } else if (total > 10000 && page > total / (limit * 10)) {
      recommendation = "Consider implementing cursor-based pagination for better performance";
    }

    return { efficiency, recommendation };
  }
}

/**
 * Database-specific pagination helpers
 */
export class DatabasePagination {
  /**
   * Execute a paginated query with count
   */
  static async executeWithCount<T>(
    dataQuery: Promise<T[]>,
    countQuery: Promise<{ count: string }[]>,
    options: PaginationOptions
  ): Promise<PaginationResult<T>> {
    const [data, countResult] = await Promise.all([dataQuery, countQuery]);
    const total = parseInt(countResult[0]?.count || "0");

    return PaginationService.createPaginationResult(data, total, options);
  }

  /**
   * Optimize queries for large datasets
   */
  static optimizeForLargeDataset(
    options: PaginationOptions,
    totalEstimate?: number
  ): PaginationOptions & { useApproximateCount: boolean } {
    const isLargeDataset = totalEstimate ? totalEstimate > 100000 : false;
    const isDeepPagination = options.page > 100;

    return {
      ...options,
      useApproximateCount: isLargeDataset && isDeepPagination,
    };
  }
}

/**
 * Cursor-based pagination for high-performance scenarios
 */
export interface CursorPaginationOptions {
  limit: number;
  cursor?: string;
  direction: "forward" | "backward";
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasNext: boolean;
  hasPrev: boolean;
}

export class CursorPagination {
  /**
   * Encode cursor from record ID and timestamp
   */
  static encodeCursor(id: number, timestamp: Date): string {
    const cursorData = { id, timestamp: timestamp.getTime() };
    return Buffer.from(JSON.stringify(cursorData)).toString("base64");
  }

  /**
   * Decode cursor to get ID and timestamp
   */
  static decodeCursor(cursor: string): { id: number; timestamp: Date } | null {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      const { id, timestamp } = JSON.parse(decoded);
      return { id, timestamp: new Date(timestamp) };
    } catch {
      return null;
    }
  }

  /**
   * Create cursor pagination result
   */
  static createResult<T extends { id: number; createdAt: Date }>(
    data: T[],
    options: CursorPaginationOptions
  ): CursorPaginationResult<T> {
    const { limit, direction } = options;
    
    const hasNext = data.length === limit + 1;
    const hasPrev = direction === "backward" || Boolean(options.cursor);
    
    // Remove extra item used for hasNext detection
    if (hasNext) {
      data.pop();
    }

    const nextCursor = hasNext && data.length > 0 
      ? this.encodeCursor(data[data.length - 1].id, data[data.length - 1].createdAt)
      : undefined;

    const prevCursor = data.length > 0 && hasPrev
      ? this.encodeCursor(data[0].id, data[0].createdAt)
      : undefined;

    return {
      data,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev,
    };
  }
}