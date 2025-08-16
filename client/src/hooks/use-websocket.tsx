import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from './use-toast';

interface WebSocketMessage {
  type: 'message' | 'typing' | 'presence' | 'ping' | 'pong' | 'error';
  data?: any;
  targetUserId?: number;
}

interface OnlineUser {
  id: number;
  fullName: string;
  avatarUrl?: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  sendMessage: (targetUserId: number, content: string) => void;
  sendTypingIndicator: (targetUserId: number, isTyping: boolean) => void;
  isUserOnline: (userId: number) => boolean;
  getUserLastSeen: (userId: number) => Date | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [userPresence, setUserPresence] = useState<Map<number, { status: string; lastSeen?: Date }>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!user || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt to reconnect after a delay (unless it was a deliberate close)
        if (event.code !== 1000 && user) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [user]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setOnlineUsers([]);
  }, []);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'message':
        // New message received
        if (message.data) {
          // Invalidate conversations to refresh the message list
          queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
          
          // Show notification if message is from another user
          if (message.data.senderId !== user?.id) {
            toast({
              title: "新消息",
              description: `来自 ${message.data.senderName}: ${message.data.content}`,
              duration: 3000,
            });

            // Play notification sound (optional)
            try {
              new Audio('/notification.mp3').play().catch(() => {});
            } catch (e) {}
          }
        }
        break;

      case 'typing':
        // Handle typing indicators
        // This could be implemented with a separate state or event system
        console.log('Typing indicator:', message.data);
        break;

      case 'presence':
        if (message.data?.status) {
          setUserPresence(prev => {
            const newMap = new Map(prev);
            newMap.set(message.data.userId, {
              status: message.data.status,
              lastSeen: message.data.lastSeen ? new Date(message.data.lastSeen) : undefined
            });
            return newMap;
          });

          // Update online users list
          if (message.data.onlineUsers) {
            setOnlineUsers(message.data.onlineUsers);
          }
        }
        break;

      case 'pong':
        // Heartbeat response - connection is alive
        break;

      case 'error':
        console.error('WebSocket error message:', message.data);
        toast({
          title: "连接错误",
          description: message.data?.message || "连接出现问题",
          variant: "destructive",
        });
        break;
    }
  }, [queryClient, user]);

  const sendMessage = useCallback((targetUserId: number, content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        targetUserId,
        data: { content }
      }));
    } else {
      toast({
        title: "发送失败",
        description: "连接已断开，请重试",
        variant: "destructive",
      });
    }
  }, []);

  const sendTypingIndicator = useCallback((targetUserId: number, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        targetUserId,
        data: { isTyping }
      }));
    }
  }, []);

  const isUserOnline = useCallback((userId: number) => {
    return onlineUsers.some(u => u.id === userId);
  }, [onlineUsers]);

  const getUserLastSeen = useCallback((userId: number) => {
    const presence = userPresence.get(userId);
    return presence?.lastSeen || null;
  }, [userPresence]);

  // Connect when user logs in
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [user]); // Remove connect/disconnect from deps to prevent unnecessary reconnections

  const contextValue: WebSocketContextType = {
    isConnected,
    onlineUsers,
    sendMessage,
    sendTypingIndicator,
    isUserOnline,
    getUserLastSeen,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}