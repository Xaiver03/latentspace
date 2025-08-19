import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  Eye, 
  Clock,
  ArrowRight,
  Star,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentCardProps {
  type: 'event' | 'article' | 'product' | 'story';
  title: string;
  description: string;
  author?: {
    name: string;
    avatar?: string;
    role?: string;
  };
  date?: string;
  category?: string;
  stats?: {
    views?: number;
    comments?: number;
    likes?: number;
    attendees?: number;
    usage?: number;
  };
  featured?: boolean;
  image?: string;
  link: string;
  className?: string;
}

export function ContentCard({
  type,
  title,
  description,
  author,
  date,
  category,
  stats,
  featured,
  image,
  link,
  className
}: ContentCardProps) {
  const typeConfig = {
    event: {
      icon: Calendar,
      color: 'blue',
      categoryLabel: '活动'
    },
    article: {
      icon: MessageSquare,
      color: 'green',
      categoryLabel: '文章'
    },
    product: {
      icon: TrendingUp,
      color: 'purple',
      categoryLabel: '产品'
    },
    story: {
      icon: Star,
      color: 'amber',
      categoryLabel: '案例'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Link href={link}>
      <Card className={cn(
        "group hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden",
        featured && "border-2 border-primary-blue",
        className
      )}>
        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-4 right-4 z-10">
            <Badge className="bg-primary-blue text-white">
              精选
            </Badge>
          </div>
        )}

        {/* Image Section */}
        {image && (
          <div className="aspect-w-16 aspect-h-9 bg-gray-100 overflow-hidden">
            <img 
              src={image} 
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        {/* Content Section */}
        <CardContent className="p-6">
          {/* Category & Date */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Icon className={cn("w-4 h-4", `text-${config.color}-600`)} />
              <Badge variant="secondary" className="text-xs">
                {category || config.categoryLabel}
              </Badge>
            </div>
            {date && (
              <span className="text-xs text-gray-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {new Date(date).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-blue transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {description}
          </p>

          {/* Author Section */}
          {author && (
            <div className="flex items-center space-x-3 mb-4">
              <Avatar className="w-8 h-8">
                {author.avatar ? (
                  <AvatarImage src={author.avatar} alt={author.name} />
                ) : (
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                    {author.name.charAt(0)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {author.name}
                </p>
                {author.role && (
                  <p className="text-xs text-gray-500 truncate">
                    {author.role}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stats Section */}
          {stats && Object.keys(stats).length > 0 && (
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              {stats.views && (
                <span className="flex items-center">
                  <Eye className="w-3 h-3 mr-1" />
                  {stats.views}
                </span>
              )}
              {stats.comments && (
                <span className="flex items-center">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {stats.comments}
                </span>
              )}
              {stats.likes && (
                <span className="flex items-center">
                  <Star className="w-3 h-3 mr-1" />
                  {stats.likes}
                </span>
              )}
              {stats.attendees && (
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {stats.attendees} 人
                </span>
              )}
              {stats.usage && (
                <span className="flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {stats.usage} 次使用
                </span>
              )}
            </div>
          )}

          {/* Read More Link */}
          <div className="mt-4 flex items-center text-sm font-medium text-primary-blue group-hover:text-primary-dark transition-colors">
            查看详情
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// 精简版卡片组件
export function CompactContentCard({
  type,
  title,
  description,
  date,
  category,
  stats,
  link,
  className
}: Omit<ContentCardProps, 'author' | 'featured' | 'image'>) {
  const typeConfig = {
    event: {
      icon: Calendar,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    article: {
      icon: MessageSquare,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600'
    },
    product: {
      icon: TrendingUp,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600'
    },
    story: {
      icon: Star,
      bgColor: 'bg-amber-100',
      iconColor: 'text-amber-600'
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <Link href={link}>
      <Card className={cn(
        "group hover:shadow-md transition-all duration-200 cursor-pointer",
        className
      )}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
              config.bgColor
            )}>
              <Icon className={cn("w-5 h-5", config.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                {category && (
                  <Badge variant="secondary" className="text-xs">
                    {category}
                  </Badge>
                )}
                {date && (
                  <span className="text-xs text-gray-500">
                    {new Date(date).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-gray-900 group-hover:text-primary-blue transition-colors line-clamp-1">
                {title}
              </h4>
              <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                {description}
              </p>
              {stats && Object.keys(stats).length > 0 && (
                <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                  {stats.views && (
                    <span className="flex items-center">
                      <Eye className="w-3 h-3 mr-1" />
                      {stats.views}
                    </span>
                  )}
                  {stats.comments && (
                    <span className="flex items-center">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {stats.comments}
                    </span>
                  )}
                  {stats.attendees && (
                    <span className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      {stats.attendees}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}