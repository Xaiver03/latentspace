import { users, events, eventRegistrations, agentProducts, cofounderApplications, matches, messages, type User, type InsertUser, type Event, type InsertEvent, type EventRegistration, type AgentProduct, type InsertAgentProduct, type CofounderApplication, type InsertCofounderApplication, type Match, type Message, type InsertMessage } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.SessionStore;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Event methods
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  
  // Event registration methods
  registerForEvent(eventId: number, userId: number): Promise<EventRegistration>;
  unregisterFromEvent(eventId: number, userId: number): Promise<boolean>;
  getUserEventRegistrations(userId: number): Promise<EventRegistration[]>;
  getEventRegistrations(eventId: number): Promise<EventRegistration[]>;
  
  // Agent product methods
  getAgentProducts(): Promise<AgentProduct[]>;
  getAgentProduct(id: number): Promise<AgentProduct | undefined>;
  createAgentProduct(product: InsertAgentProduct): Promise<AgentProduct>;
  updateAgentProduct(id: number, updates: Partial<AgentProduct>): Promise<AgentProduct | undefined>;
  deleteAgentProduct(id: number): Promise<boolean>;
  
  // Cofounder application methods
  getCofounderApplications(): Promise<CofounderApplication[]>;
  getCofounderApplication(id: number): Promise<CofounderApplication | undefined>;
  getUserCofounderApplication(userId: number): Promise<CofounderApplication | undefined>;
  createCofounderApplication(application: InsertCofounderApplication): Promise<CofounderApplication>;
  updateCofounderApplication(id: number, updates: Partial<CofounderApplication>): Promise<CofounderApplication | undefined>;
  
  // Match methods
  getUserMatches(userId: number): Promise<Match[]>;
  createMatch(user1Id: number, user2Id: number, matchScore: number): Promise<Match>;
  updateMatch(id: number, status: string): Promise<Match | undefined>;
  
  // Message methods
  getUserMessages(userId: number): Promise<Message[]>;
  getConversation(user1Id: number, user2Id: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.date));
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values(event)
      .returning();
    return newEvent;
  }

  async updateEvent(id: number, updates: Partial<Event>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount > 0;
  }

  async registerForEvent(eventId: number, userId: number): Promise<EventRegistration> {
    const [registration] = await db
      .insert(eventRegistrations)
      .values({ eventId, userId })
      .returning();
    
    // Update event attendee count
    await db
      .update(events)
      .set({ currentAttendees: sql`${events.currentAttendees} + 1` })
      .where(eq(events.id, eventId));
    
    return registration;
  }

  async unregisterFromEvent(eventId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)));
    
    if (result.rowCount > 0) {
      // Update event attendee count
      await db
        .update(events)
        .set({ currentAttendees: sql`${events.currentAttendees} - 1` })
        .where(eq(events.id, eventId));
      return true;
    }
    return false;
  }

  async getUserEventRegistrations(userId: number): Promise<EventRegistration[]> {
    return await db.select().from(eventRegistrations).where(eq(eventRegistrations.userId, userId));
  }

  async getEventRegistrations(eventId: number): Promise<EventRegistration[]> {
    return await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
  }

  async getAgentProducts(): Promise<AgentProduct[]> {
    return await db.select().from(agentProducts).orderBy(desc(agentProducts.createdAt));
  }

  async getAgentProduct(id: number): Promise<AgentProduct | undefined> {
    const [product] = await db.select().from(agentProducts).where(eq(agentProducts.id, id));
    return product || undefined;
  }

  async createAgentProduct(product: InsertAgentProduct): Promise<AgentProduct> {
    const [newProduct] = await db
      .insert(agentProducts)
      .values(product)
      .returning();
    return newProduct;
  }

  async updateAgentProduct(id: number, updates: Partial<AgentProduct>): Promise<AgentProduct | undefined> {
    const [product] = await db
      .update(agentProducts)
      .set(updates)
      .where(eq(agentProducts.id, id))
      .returning();
    return product || undefined;
  }

  async deleteAgentProduct(id: number): Promise<boolean> {
    const result = await db.delete(agentProducts).where(eq(agentProducts.id, id));
    return result.rowCount > 0;
  }

  async getCofounderApplications(): Promise<CofounderApplication[]> {
    return await db.select().from(cofounderApplications).orderBy(desc(cofounderApplications.createdAt));
  }

  async getCofounderApplication(id: number): Promise<CofounderApplication | undefined> {
    const [application] = await db.select().from(cofounderApplications).where(eq(cofounderApplications.id, id));
    return application || undefined;
  }

  async getUserCofounderApplication(userId: number): Promise<CofounderApplication | undefined> {
    const [application] = await db.select().from(cofounderApplications).where(eq(cofounderApplications.userId, userId));
    return application || undefined;
  }

  async createCofounderApplication(application: InsertCofounderApplication): Promise<CofounderApplication> {
    const [newApplication] = await db
      .insert(cofounderApplications)
      .values(application)
      .returning();
    return newApplication;
  }

  async updateCofounderApplication(id: number, updates: Partial<CofounderApplication>): Promise<CofounderApplication | undefined> {
    const [application] = await db
      .update(cofounderApplications)
      .set(updates)
      .where(eq(cofounderApplications.id, id))
      .returning();
    return application || undefined;
  }

  async getUserMatches(userId: number): Promise<Match[]> {
    return await db.select().from(matches)
      .where(or(eq(matches.user1Id, userId), eq(matches.user2Id, userId)))
      .orderBy(desc(matches.createdAt));
  }

  async createMatch(user1Id: number, user2Id: number, matchScore: number): Promise<Match> {
    const [match] = await db
      .insert(matches)
      .values({ user1Id, user2Id, matchScore })
      .returning();
    return match;
  }

  async updateMatch(id: number, status: string): Promise<Match | undefined> {
    const [match] = await db
      .update(matches)
      .set({ status })
      .where(eq(matches.id, id))
      .returning();
    return match || undefined;
  }

  async getUserMessages(userId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .orderBy(desc(messages.createdAt));
  }

  async getConversation(user1Id: number, user2Id: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(
        or(
          and(eq(messages.senderId, user1Id), eq(messages.receiverId, user2Id)),
          and(eq(messages.senderId, user2Id), eq(messages.receiverId, user1Id))
        )
      )
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  }

  async markMessageAsRead(id: number): Promise<boolean> {
    const result = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
