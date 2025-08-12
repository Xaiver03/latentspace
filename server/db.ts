import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from "@shared/schema";
import * as aiSchema from "@shared/ai-matching-schema";
import * as collaborationSchema from "@shared/collaboration-schema";
import * as marketplaceSchema from "@shared/ai-marketplace-schema";
import * as reputationSchema from "@shared/reputation-schema";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: { ...schema, ...aiSchema, ...collaborationSchema, ...marketplaceSchema, ...reputationSchema } });