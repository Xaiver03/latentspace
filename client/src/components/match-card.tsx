import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Heart, X, MessageCircle, MapPin, Briefcase, GraduationCap, Target, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MatchCandidate {
  id: number;
  fullName: string;
  username: string;
  avatarUrl?: string;
  researchField?: string;
  affiliation?: string;
  bio?: string;
  application: {
    id: number;
    researchField: string;
    startupDirection: string;
    experience?: string;
    lookingFor?: string;
    status: string;
  };
  matchScore: number;
  matchReasons: string[];
}

interface MatchCardProps {
  candidate: MatchCandidate;
  onInterest: (userId: number) => void;
  onPass: (userId: number) => void;
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

export function MatchCard({ candidate, onInterest, onPass }: MatchCardProps) {
  const queryClient = useQueryClient();
  const [showIceBreaker, setShowIceBreaker] = useState(false);
  const [iceQuestions, setIceQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(false);

  const expressInterestMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest("POST", `/api/matches/${userId}/interest`),
    onSuccess: () => {
      toast({
        title: "表达兴趣成功",
        description: "如果对方也感兴趣，你们就可以开始聊天了！",
      });
      onInterest(candidate.id);
    },
    onError: (error: any) => {
      toast({
        title: "表达兴趣失败",
        description: error.error || "操作失败，请重试",
        variant: "destructive",
      });
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: ({ userId, answers }: { userId: number; answers: string[] }) =>
      apiRequest("POST", `/api/matches/${userId}/start-conversation`, { answers }),
    onSuccess: () => {
      toast({
        title: "破冰消息发送成功",
        description: "已向对方发送破冰问答，期待回复！",
      });
      setShowIceBreaker(false);
      onInterest(candidate.id);
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "发送失败",
        description: error.error || "破冰消息发送失败",
        variant: "destructive",
      });
    },
  });

  const handleInterest = async () => {
    setLoading(true);
    try {
      // First get ice breaker questions
      const response = await apiRequest("GET", "/api/matches/ice-breakers");
      setIceQuestions(response.questions);
      setShowIceBreaker(true);
    } catch (error) {
      // Fallback to simple interest expression
      expressInterestMutation.mutate(candidate.id);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConversation = () => {
    if (answers.some(answer => !answer.trim())) {
      toast({
        title: "请完成破冰问答",
        description: "请回答所有问题后再发送",
        variant: "destructive",
      });
      return;
    }

    startConversationMutation.mutate({
      userId: candidate.id,
      answers: answers
    });
  };

  const scoreColor = candidate.matchScore >= 0.8 ? "bg-green-500" : 
                   candidate.matchScore >= 0.6 ? "bg-blue-500" : 
                   candidate.matchScore >= 0.4 ? "bg-yellow-500" : "bg-gray-400";

  return (
    <>
      <Card className="relative overflow-hidden hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-16 h-16">
                <AvatarImage src={candidate.avatarUrl} />
                <AvatarFallback className="text-lg font-medium">
                  {candidate.fullName?.charAt(0) || candidate.username.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-xl">{candidate.fullName || candidate.username}</CardTitle>
                <p className="text-sm text-gray-500">@{candidate.username}</p>
                <div className="flex items-center mt-1">
                  <div className={`w-3 h-3 rounded-full ${scoreColor} mr-2`}></div>
                  <span className="text-sm font-medium">
                    匹配度 {Math.round(candidate.matchScore * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Research Field & Affiliation */}
          <div className="space-y-2">
            {candidate.researchField && (
              <div className="flex items-center text-sm text-gray-600">
                <GraduationCap className="w-4 h-4 mr-2" />
                <span>{candidate.researchField}</span>
              </div>
            )}
            {candidate.affiliation && (
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2" />
                <span>{candidate.affiliation}</span>
              </div>
            )}
          </div>

          {/* Application Info */}
          <div className="space-y-2">
            <div className="flex items-start text-sm">
              <Target className="w-4 h-4 mr-2 mt-0.5 text-blue-500" />
              <div>
                <span className="font-medium">创业方向：</span>
                <span>{candidate.application.startupDirection}</span>
              </div>
            </div>

            {candidate.application.lookingFor && (
              <div className="flex items-start text-sm">
                <Briefcase className="w-4 h-4 mr-2 mt-0.5 text-green-500" />
                <div>
                  <span className="font-medium">寻找：</span>
                  <span>{candidate.application.lookingFor}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          {candidate.bio && (
            <div className="text-sm text-gray-700 line-clamp-3">
              {candidate.bio}
            </div>
          )}

          {/* Match Reasons */}
          {candidate.matchReasons.length > 0 && (
            <div>
              <Separator className="my-3" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">匹配亮点：</p>
                <div className="flex flex-wrap gap-1">
                  {candidate.matchReasons.slice(0, 3).map((reason, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPass(candidate.id)}
              className="flex-1 border-gray-300 hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              跳过
            </Button>
            <Button
              size="sm"
              onClick={handleInterest}
              disabled={loading || expressInterestMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Heart className="w-4 h-4 mr-2" />
              {loading ? "准备中..." : "感兴趣"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ice Breaker Dialog */}
      <Dialog open={showIceBreaker} onOpenChange={setShowIceBreaker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              破冰问答
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              回答这些问题来开始与 <strong>{candidate.fullName || candidate.username}</strong> 的对话：
            </p>
            
            {iceQuestions.map((question, index) => (
              <div key={index} className="space-y-2">
                <Label className="text-sm font-medium">
                  {index + 1}. {question}
                </Label>
                <Textarea
                  placeholder="在此输入你的回答..."
                  value={answers[index]}
                  onChange={(e) => {
                    const newAnswers = [...answers];
                    newAnswers[index] = e.target.value;
                    setAnswers(newAnswers);
                  }}
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))}
            
            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowIceBreaker(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleStartConversation}
                disabled={startConversationMutation.isPending || answers.some(a => !a.trim())}
                className="flex-1"
              >
                {startConversationMutation.isPending ? "发送中..." : "发送破冰消息"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}