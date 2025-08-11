import { users, events, eventRegistrations, agentProducts, cofounderApplications, matches, messages, eventContents, eventFeedback, eventTags, matchingInteractions, iceBreakingQuestions, matchFeedback, collaborationSpaces, type User, type InsertUser, type Event, type InsertEvent, type EventRegistration, type AgentProduct, type InsertAgentProduct, type CofounderApplication, type InsertCofounderApplication, type Match, type Message, type InsertMessage, type EventContent, type InsertEventContent, type EventFeedback, type InsertEventFeedback, type EventTag, type InsertEventTag, type MatchingInteraction, type InsertMatchingInteraction, type IceBreakingQuestion, type InsertIceBreakingQuestion, type MatchFeedback, type InsertMatchFeedback, type CollaborationSpace, type InsertCollaborationSpace } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserProfile(id: number, profile: {
    fullName: string;
    researchField?: string | null;
    affiliation?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  }): Promise<User | undefined>;
  
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
  getUserConversations(userId: number): Promise<any[]>;
  getConversation(user1Id: number, user2Id: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<boolean>;
  
  // Event content methods
  getEventContents(eventId: number): Promise<EventContent[]>;
  getEventContent(id: number): Promise<EventContent | undefined>;
  createEventContent(content: InsertEventContent): Promise<EventContent>;
  updateEventContent(id: number, updates: Partial<EventContent>): Promise<EventContent | undefined>;
  deleteEventContent(id: number): Promise<boolean>;
  incrementContentViewCount(id: number): Promise<void>;
  incrementContentDownloadCount(id: number): Promise<void>;
  
  // Event feedback methods
  getEventFeedback(eventId: number): Promise<EventFeedback[]>;
  getUserEventFeedback(eventId: number, userId: number): Promise<EventFeedback | undefined>;
  createEventFeedback(feedback: InsertEventFeedback): Promise<EventFeedback>;
  getEventAverageRating(eventId: number): Promise<number>;
  
  // Event tag methods
  getEventTags(eventId: number): Promise<EventTag[]>;
  createEventTag(tag: InsertEventTag): Promise<EventTag>;
  deleteEventTag(eventId: number, tag: string): Promise<boolean>;
  getPopularTags(limit?: number): Promise<{ tag: string; count: number }[]>;
  
  // Matching interaction methods
  recordInteraction(interaction: InsertMatchingInteraction): Promise<MatchingInteraction>;
  getUserInteractions(userId: number): Promise<MatchingInteraction[]>;
  getInteractionsBetween(user1Id: number, user2Id: number): Promise<MatchingInteraction[]>;
  
  // Ice-breaking question methods
  getActiveQuestions(): Promise<IceBreakingQuestion[]>;
  getRandomQuestions(limit?: number): Promise<IceBreakingQuestion[]>;
  createQuestion(question: InsertIceBreakingQuestion): Promise<IceBreakingQuestion>;
  incrementQuestionUsage(id: number): Promise<void>;
  
  // Match feedback methods
  createMatchFeedback(feedback: InsertMatchFeedback): Promise<MatchFeedback>;
  getMatchFeedback(matchId: number): Promise<MatchFeedback[]>;
  getUserMatchFeedback(userId: number): Promise<MatchFeedback[]>;
  
  // Collaboration space methods
  createCollaborationSpace(space: InsertCollaborationSpace): Promise<CollaborationSpace>;
  getCollaborationSpace(matchId: number): Promise<CollaborationSpace | undefined>;
  updateCollaborationSpace(id: number, updates: Partial<CollaborationSpace>): Promise<CollaborationSpace | undefined>;
  getActiveCollaborationSpaces(userId: number): Promise<CollaborationSpace[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

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

  async getUserById(id: number): Promise<User | undefined> {
    // This is an alias for getUser for consistency with API naming
    return this.getUser(id);
  }

  async updateUserProfile(id: number, profile: {
    fullName: string;
    researchField?: string | null;
    affiliation?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        fullName: profile.fullName,
        researchField: profile.researchField,
        affiliation: profile.affiliation,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      })
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
    return (result.rowCount ?? 0) > 0;
  }

  async registerForEvent(eventId: number, userId: number): Promise<EventRegistration> {
    return await db.transaction(async (tx) => {
      // 1. Check if event exists and get current attendee count with row lock
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .for('update'); // Row lock to prevent concurrent modifications
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // 2. Check if event is full
      if ((event.currentAttendees ?? 0) >= (event.maxAttendees ?? 0)) {
        throw new Error('Event is full');
      }
      
      // 3. Check for duplicate registration
      const existingRegistration = await tx
        .select()
        .from(eventRegistrations)
        .where(and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, userId)
        ));
      
      if (existingRegistration.length > 0) {
        throw new Error('Already registered for this event');
      }
      
      // 4. Atomic operation: insert registration and update count
      const [registration] = await tx
        .insert(eventRegistrations)
        .values({ eventId, userId })
        .returning();
      
      await tx
        .update(events)
        .set({ 
          currentAttendees: (event.currentAttendees ?? 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(events.id, eventId));
      
      return registration;
    });
  }

  async unregisterFromEvent(eventId: number, userId: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // 1. Check if registration exists
      const existingRegistration = await tx
        .select()
        .from(eventRegistrations)
        .where(and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, userId)
        ));
      
      if (existingRegistration.length === 0) {
        return false; // Not registered
      }
      
      // 2. Get event details with row lock
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .for('update');
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // 3. Atomic operation: delete registration and update count
      const result = await tx
        .delete(eventRegistrations)
        .where(and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.userId, userId)
        ));
      
      if ((result.rowCount ?? 0) > 0) {
        await tx
          .update(events)
          .set({ 
            currentAttendees: Math.max(0, (event.currentAttendees ?? 0) - 1),
            updatedAt: new Date()
          })
          .where(eq(events.id, eventId));
        return true;
      }
      
      return false;
    });
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
      .values({
        ...product,
        tags: product.tags ? (Array.isArray(product.tags) ? product.tags : Array.from(product.tags as any)) as string[] : []
      })
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
    return (result.rowCount ?? 0) > 0;
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

  async getUserConversations(userId: number): Promise<any[]> {
    // Get all unique conversation partners
    const conversations = await db
      .select({
        otherUserId: sql<number>`CASE 
          WHEN ${messages.senderId} = ${userId} THEN ${messages.receiverId}
          ELSE ${messages.senderId}
        END`.as('otherUserId'),
        lastMessageId: sql<number>`MAX(${messages.id})`.as('lastMessageId'),
        lastMessageTime: sql<string>`MAX(${messages.createdAt})`.as('lastMessageTime')
      })
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .groupBy(sql`CASE 
        WHEN ${messages.senderId} = ${userId} THEN ${messages.receiverId}
        ELSE ${messages.senderId}
      END`)
      .orderBy(desc(sql`MAX(${messages.createdAt})`));

    // Get details for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        // Get other user details
        const [otherUser] = await db
          .select({
            id: users.id,
            fullName: users.fullName,
            username: users.username,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, conv.otherUserId));

        // Get last message details
        const [lastMessage] = await db
          .select()
          .from(messages)
          .where(eq(messages.id, conv.lastMessageId));

        // Count unread messages
        const [unreadResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.receiverId, userId),
              eq(messages.senderId, conv.otherUserId),
              eq(messages.isRead, false)
            )
          );

        return {
          userId: conv.otherUserId,
          user: otherUser,
          lastMessage: lastMessage,
          unreadCount: unreadResult?.count || 0,
        };
      })
    );

    return conversationsWithDetails.filter(conv => conv.user && conv.lastMessage);
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
    return (result.rowCount ?? 0) > 0;
  }

  // Event content methods implementation
  async getEventContents(eventId: number): Promise<EventContent[]> {
    return await db.select().from(eventContents)
      .where(eq(eventContents.eventId, eventId))
      .orderBy(desc(eventContents.uploadedAt));
  }

  async getEventContent(id: number): Promise<EventContent | undefined> {
    const [content] = await db.select().from(eventContents)
      .where(eq(eventContents.id, id));
    return content || undefined;
  }

  async createEventContent(content: InsertEventContent): Promise<EventContent> {
    const [newContent] = await db
      .insert(eventContents)
      .values(content)
      .returning();
    return newContent;
  }

  async updateEventContent(id: number, updates: Partial<EventContent>): Promise<EventContent | undefined> {
    const [content] = await db
      .update(eventContents)
      .set(updates)
      .where(eq(eventContents.id, id))
      .returning();
    return content || undefined;
  }

  async deleteEventContent(id: number): Promise<boolean> {
    const result = await db.delete(eventContents)
      .where(eq(eventContents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async incrementContentViewCount(id: number): Promise<void> {
    await db
      .update(eventContents)
      .set({ viewCount: sql`${eventContents.viewCount} + 1` })
      .where(eq(eventContents.id, id));
  }

  async incrementContentDownloadCount(id: number): Promise<void> {
    await db
      .update(eventContents)
      .set({ downloadCount: sql`${eventContents.downloadCount} + 1` })
      .where(eq(eventContents.id, id));
  }

  // Event feedback methods implementation
  async getEventFeedback(eventId: number): Promise<EventFeedback[]> {
    return await db.select().from(eventFeedback)
      .where(eq(eventFeedback.eventId, eventId))
      .orderBy(desc(eventFeedback.createdAt));
  }

  async getUserEventFeedback(eventId: number, userId: number): Promise<EventFeedback | undefined> {
    const [feedback] = await db.select().from(eventFeedback)
      .where(and(
        eq(eventFeedback.eventId, eventId),
        eq(eventFeedback.userId, userId)
      ));
    return feedback || undefined;
  }

  async createEventFeedback(feedback: InsertEventFeedback): Promise<EventFeedback> {
    const [newFeedback] = await db
      .insert(eventFeedback)
      .values(feedback)
      .returning();
    return newFeedback;
  }

  async getEventAverageRating(eventId: number): Promise<number> {
    const [result] = await db
      .select({ avgRating: sql<number>`AVG(${eventFeedback.rating})` })
      .from(eventFeedback)
      .where(eq(eventFeedback.eventId, eventId));
    return result?.avgRating || 0;
  }

  // Event tag methods implementation
  async getEventTags(eventId: number): Promise<EventTag[]> {
    return await db.select().from(eventTags)
      .where(eq(eventTags.eventId, eventId))
      .orderBy(eventTags.tag);
  }

  async createEventTag(tag: InsertEventTag): Promise<EventTag> {
    const [newTag] = await db
      .insert(eventTags)
      .values(tag)
      .returning();
    return newTag;
  }

  async deleteEventTag(eventId: number, tag: string): Promise<boolean> {
    const result = await db.delete(eventTags)
      .where(and(
        eq(eventTags.eventId, eventId),
        eq(eventTags.tag, tag)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getPopularTags(limit: number = 10): Promise<{ tag: string; count: number }[]> {
    const results = await db
      .select({
        tag: eventTags.tag,
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(eventTags)
      .groupBy(eventTags.tag)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);
    return results;
  }

  // Matching interaction methods implementation
  async recordInteraction(interaction: InsertMatchingInteraction): Promise<MatchingInteraction> {
    const [newInteraction] = await db
      .insert(matchingInteractions)
      .values(interaction)
      .returning();
    return newInteraction;
  }

  async getUserInteractions(userId: number): Promise<MatchingInteraction[]> {
    return await db.select().from(matchingInteractions)
      .where(eq(matchingInteractions.userId, userId))
      .orderBy(desc(matchingInteractions.createdAt));
  }

  async getInteractionsBetween(user1Id: number, user2Id: number): Promise<MatchingInteraction[]> {
    return await db.select().from(matchingInteractions)
      .where(
        or(
          and(
            eq(matchingInteractions.userId, user1Id),
            eq(matchingInteractions.targetUserId, user2Id)
          ),
          and(
            eq(matchingInteractions.userId, user2Id),
            eq(matchingInteractions.targetUserId, user1Id)
          )
        )
      )
      .orderBy(desc(matchingInteractions.createdAt));
  }

  // Ice-breaking question methods implementation
  async getActiveQuestions(): Promise<IceBreakingQuestion[]> {
    return await db.select().from(iceBreakingQuestions)
      .where(eq(iceBreakingQuestions.isActive, true))
      .orderBy(iceBreakingQuestions.usageCount);
  }

  async getRandomQuestions(limit: number = 3): Promise<IceBreakingQuestion[]> {
    // Get all active questions and randomly select
    const questions = await this.getActiveQuestions();
    const shuffled = questions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  async createQuestion(question: InsertIceBreakingQuestion): Promise<IceBreakingQuestion> {
    const [newQuestion] = await db
      .insert(iceBreakingQuestions)
      .values(question)
      .returning();
    return newQuestion;
  }

  async incrementQuestionUsage(id: number): Promise<void> {
    await db
      .update(iceBreakingQuestions)
      .set({ usageCount: sql`${iceBreakingQuestions.usageCount} + 1` })
      .where(eq(iceBreakingQuestions.id, id));
  }

  // Match feedback methods implementation
  async createMatchFeedback(feedback: InsertMatchFeedback): Promise<MatchFeedback> {
    const [newFeedback] = await db
      .insert(matchFeedback)
      .values(feedback)
      .returning();
    return newFeedback;
  }

  async getMatchFeedback(matchId: number): Promise<MatchFeedback[]> {
    return await db.select().from(matchFeedback)
      .where(eq(matchFeedback.matchId, matchId))
      .orderBy(desc(matchFeedback.createdAt));
  }

  async getUserMatchFeedback(userId: number): Promise<MatchFeedback[]> {
    return await db.select().from(matchFeedback)
      .where(eq(matchFeedback.userId, userId))
      .orderBy(desc(matchFeedback.createdAt));
  }

  // Collaboration space methods implementation
  async createCollaborationSpace(space: InsertCollaborationSpace): Promise<CollaborationSpace> {
    const [newSpace] = await db
      .insert(collaborationSpaces)
      .values(space)
      .returning();
    return newSpace;
  }

  async getCollaborationSpace(matchId: number): Promise<CollaborationSpace | undefined> {
    const [space] = await db.select().from(collaborationSpaces)
      .where(eq(collaborationSpaces.matchId, matchId));
    return space || undefined;
  }

  async updateCollaborationSpace(id: number, updates: Partial<CollaborationSpace>): Promise<CollaborationSpace | undefined> {
    const [space] = await db
      .update(collaborationSpaces)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(collaborationSpaces.id, id))
      .returning();
    return space || undefined;
  }

  async getActiveCollaborationSpaces(userId: number): Promise<CollaborationSpace[]> {
    // Get all matches for the user
    const userMatches = await this.getUserMatches(userId);
    const matchIds = userMatches.map(m => m.id);
    
    if (matchIds.length === 0) return [];
    
    return await db.select().from(collaborationSpaces)
      .where(
        and(
          eq(collaborationSpaces.isActive, true),
          sql`${collaborationSpaces.matchId} = ANY(${matchIds})`
        )
      )
      .orderBy(desc(collaborationSpaces.updatedAt));
  }
}

export const storage = new DatabaseStorage();
