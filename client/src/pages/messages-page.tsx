import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Send, MessageCircle, User } from "lucide-react";

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: number;
    fullName: string;
    username: string;
    avatarUrl?: string;
  };
  receiver?: {
    id: number;
    fullName: string;
    username: string;
    avatarUrl?: string;
  };
}

interface Conversation {
  userId: number;
  user: {
    id: number;
    fullName: string;
    username: string;
    avatarUrl?: string;
  };
  lastMessage: Message;
  unreadCount: number;
}

const apiRequest = async (method: string, url: string, data?: any) => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw { status: response.status, ...error };
  }
  
  return response.json();
};

export function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    queryFn: () => apiRequest("GET", "/api/messages/conversations"),
    enabled: !!user,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedUserId],
    queryFn: () => apiRequest("GET", `/api/messages/conversation/${selectedUserId}`),
    enabled: !!user && !!selectedUserId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ receiverId, content }: { receiverId: number; content: string }) =>
      apiRequest("POST", "/api/messages", { receiverId, content }),
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "发送失败",
        description: error.error || "消息发送失败，请重试",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      receiverId: selectedUserId,
      content: newMessage.trim(),
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } else if (diffInDays === 1) {
      return "昨天 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString("zh-CN", { weekday: "short" }) + " " + 
             date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    }
  };

  const selectedConversation = conversations.find(c => c.userId === selectedUserId);

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p>请先登录以查看消息</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
        {/* 对话列表 */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              消息
            </h2>
          </div>
          
          <ScrollArea className="flex-1">
            {conversationsLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>暂无对话</p>
                <p className="text-sm">去匹配页面开始聊天吧</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.userId}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedUserId === conversation.userId ? "bg-blue-50 border-r-2 border-blue-500" : ""
                    }`}
                    onClick={() => setSelectedUserId(conversation.userId)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={conversation.user.avatarUrl} />
                          <AvatarFallback>
                            {conversation.user.fullName?.charAt(0) || conversation.user.username.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {conversation.unreadCount > 0 && (
                          <Badge className="absolute -top-1 -right-1 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs bg-red-500">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conversation.user.fullName || conversation.user.username}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(conversation.lastMessage.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {conversation.lastMessage.senderId === user.id ? "我: " : ""}
                          {conversation.lastMessage.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 聊天区域 */}
        <div className="flex-1 flex flex-col">
          {selectedUserId ? (
            <>
              {/* 聊天头部 */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedConversation?.user.avatarUrl} />
                    <AvatarFallback>
                      {selectedConversation?.user.fullName?.charAt(0) || selectedConversation?.user.username.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {selectedConversation?.user.fullName || selectedConversation?.user.username}
                    </p>
                    <p className="text-sm text-gray-500">在线</p>
                  </div>
                </div>
              </div>

              {/* 消息列表 */}
              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-xs p-3 rounded-lg animate-pulse ${
                          i % 2 === 0 ? "bg-gray-200" : "bg-gray-100"
                        }`}>
                          <div className="h-4 bg-gray-300 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>开始对话吧</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => {
                      const isCurrentUser = message.senderId === user.id;
                      const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`flex max-w-xs lg:max-w-md ${isCurrentUser ? "flex-row-reverse" : "flex-row"} items-end space-x-2`}>
                            {showAvatar && !isCurrentUser && (
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={selectedConversation?.user.avatarUrl} />
                                <AvatarFallback className="text-xs">
                                  {selectedConversation?.user.fullName?.charAt(0) || selectedConversation?.user.username.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div
                              className={`px-4 py-2 rounded-lg ${
                                isCurrentUser
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-100 text-gray-900"
                              }`}
                            >
                              <p className="break-words">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                isCurrentUser ? "text-blue-100" : "text-gray-500"
                              }`}>
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* 消息输入区 */}
              <div className="p-4 border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="输入消息..."
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    size="sm"
                  >
                    {sendMessageMutation.isPending ? (
                      "发送中..."
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            /* 未选择对话状态 */
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">选择一个对话</h3>
                <p>从左侧选择一个对话开始聊天</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}