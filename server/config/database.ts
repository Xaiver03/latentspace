import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

// Connection pool configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Pool optimization settings
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum number of clients in the pool
  min: parseInt(process.env.DB_POOL_MIN || '5'),  // Minimum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // Close idle clients after 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // Return error if connection takes > 2 seconds
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'), // Return error if acquiring a connection takes > 60 seconds
  maxUses: parseInt(process.env.DB_MAX_USES || '7500'), // Close a connection after it has been used this many times
  allowExitOnIdle: true, // Allow the pool to exit when all clients are idle
};

// Create connection pool
const pool = new Pool(poolConfig);

// Pool event handlers for monitoring
pool.on('connect', () => {
  console.log('🔗 Database connection established');
});

pool.on('error', (err) => {
  console.error('💥 Database pool error:', err);
});

pool.on('remove', () => {
  console.log('🔌 Database connection removed from pool');
});

// Create Drizzle database instance with optimized pool
export const db = drizzle(pool, { 
  schema,
  logger: process.env.NODE_ENV === 'development' 
});

// Export pool for direct access when needed
export { pool };

// Health check function
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  poolStats: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  latency?: number;
}> {
  try {
    const start = Date.now();
    const client = await pool.connect();
    
    try {
      await client.query('SELECT 1');
      const latency = Date.now() - start;
      
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      };
      
      return {
        isHealthy: true,
        poolStats,
        latency,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      isHealthy: false,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    };
  }
}

// Graceful shutdown function
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    console.log('🔒 Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
}