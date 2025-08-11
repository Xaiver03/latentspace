import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { storage } from "../storage";
import type { User } from "@shared/schema";

interface WebSocketClient {
  ws: WebSocket;
  userId: number;
  user: User;
  lastSeen: Date;
}

interface WebSocketMessage {
  type: 'message' | 'typing' | 'presence' | 'ping' | 'pong' | 'error';
  data?: any;
  targetUserId?: number;
  conversationId?: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients = new Map<number, WebSocketClient>(); // userId -> client
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers() {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      try {
        // Extract user info from session/auth
        const userId = await this.authenticateConnection(req);
        if (!userId) {
          ws.close(1008, 'Authentication required');
          return;
        }

        const user = await storage.getUser(userId);
        if (!user) {
          ws.close(1008, 'User not found');
          return;
        }

        // Store client connection
        const client: WebSocketClient = {
          ws,
          userId,
          user,
          lastSeen: new Date()
        };

        this.clients.set(userId, client);

        console.log(`User ${user.fullName} (${userId}) connected to WebSocket`);

        // Send welcome message
        this.sendToClient(userId, {
          type: 'presence',
          data: { status: 'connected', onlineUsers: this.getOnlineUserIds() }
        });

        // Broadcast user online status to relevant users
        await this.broadcastUserStatus(userId, 'online');

        // Handle incoming messages
        ws.on('message', async (data: Buffer) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            await this.handleMessage(userId, message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.sendToClient(userId, {
              type: 'error',
              data: { message: 'Invalid message format' }
            });
          }
        });

        // Handle connection close
        ws.on('close', async () => {
          console.log(`User ${user.fullName} (${userId}) disconnected`);
          this.clients.delete(userId);
          await this.broadcastUserStatus(userId, 'offline');
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${userId}:`, error);
          this.clients.delete(userId);
        });

        // Update last seen
        client.lastSeen = new Date();

      } catch (error) {
        console.error('Error setting up WebSocket connection:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  private async authenticateConnection(req: IncomingMessage): Promise<number | null> {
    try {
      // Extract session from cookies
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) return null;

      // Parse session cookie (simplified - in production you'd properly parse and decrypt)
      const sessionMatch = cookieHeader.match(/connect\.sid=([^;]+)/);
      if (!sessionMatch) return null;

      // For now, extract user ID from URL query params as a simpler approach
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const userIdParam = url.searchParams.get('userId');
      
      if (userIdParam) {
        return parseInt(userIdParam);
      }

      return null;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  private async handleMessage(userId: number, message: WebSocketMessage) {
    const client = this.clients.get(userId);
    if (!client) return;

    switch (message.type) {
      case 'message':
        await this.handleChatMessage(userId, message);
        break;
      
      case 'typing':
        await this.handleTypingIndicator(userId, message);
        break;
      
      case 'presence':
        await this.handlePresenceUpdate(userId, message);
        break;
      
      case 'ping':
        this.sendToClient(userId, { type: 'pong' });
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }

    // Update last seen
    client.lastSeen = new Date();
  }

  private async handleChatMessage(senderId: number, message: WebSocketMessage) {
    try {
      if (!message.data?.content || !message.targetUserId) {
        return;
      }

      // Store message in database
      const savedMessage = await storage.createMessage({
        senderId,
        receiverId: message.targetUserId,
        content: message.data.content
      });

      // Record interaction
      await storage.recordInteraction({
        userId: senderId,
        targetUserId: message.targetUserId,
        action: 'messaged',
        metadata: { messageId: savedMessage.id }
      });

      // Send to recipient if online
      const recipientClient = this.clients.get(message.targetUserId);
      if (recipientClient) {
        this.sendToClient(message.targetUserId, {
          type: 'message',
          data: {
            id: savedMessage.id,
            senderId,
            senderName: this.clients.get(senderId)?.user.fullName,
            content: savedMessage.content,
            createdAt: savedMessage.createdAt,
            isRead: false
          }
        });
      }

      // Confirm to sender
      this.sendToClient(senderId, {
        type: 'message',
        data: {
          id: savedMessage.id,
          status: 'sent',
          delivered: !!recipientClient
        }
      });

    } catch (error) {
      console.error('Error handling chat message:', error);
      this.sendToClient(senderId, {
        type: 'error',
        data: { message: 'Failed to send message' }
      });
    }
  }

  private async handleTypingIndicator(userId: number, message: WebSocketMessage) {
    if (!message.targetUserId) return;

    const targetClient = this.clients.get(message.targetUserId);
    if (targetClient) {
      this.sendToClient(message.targetUserId, {
        type: 'typing',
        data: {
          userId,
          userName: this.clients.get(userId)?.user.fullName,
          isTyping: message.data?.isTyping || false
        }
      });
    }
  }

  private async handlePresenceUpdate(userId: number, message: WebSocketMessage) {
    // Update user's presence status
    const client = this.clients.get(userId);
    if (client) {
      client.lastSeen = new Date();
    }

    // Broadcast updated online users list to relevant conversations
    await this.broadcastUserStatus(userId, 'online');
  }

  private async broadcastUserStatus(userId: number, status: 'online' | 'offline') {
    try {
      // Get user's recent conversation partners
      const conversations = await storage.getUserConversations(userId);
      const relevantUserIds = conversations.map(conv => conv.userId);

      // Broadcast to online conversation partners
      for (const partnerId of relevantUserIds) {
        const partnerClient = this.clients.get(partnerId);
        if (partnerClient) {
          this.sendToClient(partnerId, {
            type: 'presence',
            data: {
              userId,
              userName: status === 'online' ? this.clients.get(userId)?.user.fullName : undefined,
              status,
              lastSeen: status === 'offline' ? new Date() : undefined
            }
          });
        }
      }
    } catch (error) {
      console.error('Error broadcasting user status:', error);
    }
  }

  private sendToClient(userId: number, message: WebSocketMessage) {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        // Remove dead connection
        this.clients.delete(userId);
      }
    }
  }

  private getOnlineUserIds(): number[] {
    return Array.from(this.clients.keys());
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      for (const [userId, client] of Array.from(this.clients.entries())) {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping to check if connection is alive
          try {
            client.ws.ping();
          } catch (error) {
            console.log(`Removing dead connection for user ${userId}`);
            this.clients.delete(userId);
          }
        } else {
          // Remove dead connections
          this.clients.delete(userId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Public methods for external use
  public sendMessageToUser(userId: number, message: WebSocketMessage) {
    this.sendToClient(userId, message);
  }

  public isUserOnline(userId: number): boolean {
    return this.clients.has(userId);
  }

  public getOnlineUsers(): User[] {
    return Array.from(this.clients.values()).map(client => client.user);
  }

  public getUserLastSeen(userId: number): Date | null {
    const client = this.clients.get(userId);
    return client ? client.lastSeen : null;
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}

let webSocketService: WebSocketService | null = null;

export function initializeWebSocketService(server: HttpServer): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server);
  }
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}