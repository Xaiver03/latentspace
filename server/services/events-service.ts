import { storage } from "../storage";
import { AppError } from "../middleware/error-handler";
import type { 
  Event, 
  InsertEvent, 
  EventRegistration, 
  EventContent, 
  InsertEventContent,
  EventFeedback,
  InsertEventFeedback,
  EventTag,
  InsertEventTag
} from "@shared/schema";

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order: "asc" | "desc";
}

export interface EventFilters {
  category?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedResult<T> {
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

export class EventsService {
  async getEvents(
    filters: EventFilters = {},
    pagination: PaginationParams = { page: 1, limit: 10, order: "desc" }
  ): Promise<PaginatedResult<Event>> {
    try {
      // For now, get all events and implement pagination in memory
      // In production, this should be done at the database level
      const allEvents = await storage.getEvents();
      
      let filteredEvents = allEvents;

      // Apply filters
      if (filters.category) {
        filteredEvents = filteredEvents.filter(event => event.category === filters.category);
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredEvents = filteredEvents.filter(event => 
          event.title.toLowerCase().includes(searchTerm) ||
          event.description.toLowerCase().includes(searchTerm)
        );
      }

      if (filters.startDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.date) >= filters.startDate!);
      }

      if (filters.endDate) {
        filteredEvents = filteredEvents.filter(event => new Date(event.date) <= filters.endDate!);
      }

      // Apply sorting
      filteredEvents.sort((a, b) => {
        const aValue = pagination.sort === "title" ? a.title : new Date(a.date).getTime();
        const bValue = pagination.sort === "title" ? b.title : new Date(b.date).getTime();
        
        if (pagination.order === "asc") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Apply pagination
      const total = filteredEvents.length;
      const totalPages = Math.ceil(total / pagination.limit);
      const offset = (pagination.page - 1) * pagination.limit;
      const paginatedEvents = filteredEvents.slice(offset, offset + pagination.limit);

      return {
        data: paginatedEvents,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
        },
      };
    } catch (error) {
      throw AppError.database("Failed to fetch events", error);
    }
  }

  async getEvent(id: number): Promise<Event> {
    try {
      const event = await storage.getEvent(id);
      if (!event) {
        throw AppError.notFound("Event not found");
      }
      return event;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to fetch event", error);
    }
  }

  async createEvent(eventData: InsertEvent, userId: number): Promise<Event> {
    try {
      const enrichedEventData = {
        ...eventData,
        createdBy: userId,
      };
      
      return await storage.createEvent(enrichedEventData);
    } catch (error) {
      if (error?.message?.includes("duplicate") || error?.message?.includes("unique")) {
        throw AppError.conflict("Event with this title already exists");
      }
      throw AppError.database("Failed to create event", error);
    }
  }

  async updateEvent(id: number, updates: Partial<Event>, userId: number): Promise<Event> {
    try {
      // First check if event exists and user has permission
      const existingEvent = await this.getEvent(id);
      
      // Check ownership or admin role
      if (existingEvent.createdBy !== userId) {
        throw AppError.forbidden("You can only update your own events");
      }

      const updatedEvent = await storage.updateEvent(id, updates);
      if (!updatedEvent) {
        throw AppError.notFound("Event not found");
      }
      
      return updatedEvent;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to update event", error);
    }
  }

  async deleteEvent(id: number, userId: number): Promise<void> {
    try {
      // First check if event exists and user has permission
      const existingEvent = await this.getEvent(id);
      
      // Check ownership or admin role
      if (existingEvent.createdBy !== userId) {
        throw AppError.forbidden("You can only delete your own events");
      }

      const success = await storage.deleteEvent(id);
      if (!success) {
        throw AppError.notFound("Event not found");
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to delete event", error);
    }
  }

  async registerForEvent(eventId: number, userId: number): Promise<EventRegistration> {
    try {
      // First check if event exists
      await this.getEvent(eventId);
      
      return await storage.registerForEvent(eventId, userId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      const errorMessage = error?.message || "";
      
      if (errorMessage.includes("Event is full")) {
        throw AppError.conflict("Event is full");
      }
      if (errorMessage.includes("Already registered")) {
        throw AppError.conflict("Already registered for this event");
      }
      
      throw AppError.database("Failed to register for event", error);
    }
  }

  async unregisterFromEvent(eventId: number, userId: number): Promise<void> {
    try {
      // First check if event exists
      await this.getEvent(eventId);
      
      const success = await storage.unregisterFromEvent(eventId, userId);
      if (!success) {
        throw AppError.notFound("Registration not found");
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to unregister from event", error);
    }
  }

  async getUserEventRegistrations(userId: number): Promise<EventRegistration[]> {
    try {
      return await storage.getUserEventRegistrations(userId);
    } catch (error) {
      throw AppError.database("Failed to fetch user registrations", error);
    }
  }

  async getEventRegistrations(eventId: number): Promise<EventRegistration[]> {
    try {
      // First check if event exists
      await this.getEvent(eventId);
      
      return await storage.getEventRegistrations(eventId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to fetch event registrations", error);
    }
  }

  // Event content management
  async getEventContents(eventId: number): Promise<EventContent[]> {
    try {
      // First check if event exists
      await this.getEvent(eventId);
      
      return await storage.getEventContents(eventId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to fetch event contents", error);
    }
  }

  async getEventContent(contentId: number): Promise<EventContent> {
    try {
      const content = await storage.getEventContent(contentId);
      if (!content) {
        throw AppError.notFound("Content not found");
      }
      return content;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to fetch event content", error);
    }
  }

  async createEventContent(contentData: InsertEventContent): Promise<EventContent> {
    try {
      // First check if event exists
      await this.getEvent(contentData.eventId);
      
      return await storage.createEventContent(contentData);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database("Failed to create event content", error);
    }
  }
}

export const eventsService = new EventsService();