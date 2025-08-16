// ================================
// 数据转换器 - 统一的数据处理逻辑
// ================================

import type { User, Event } from "@shared/index";
import type { EventWithStats, MatchRecommendation, ConversationPreview } from "../api/types";

// ================================
// 日期时间转换器
// ================================

/**
 * 将ISO日期字符串转换为本地化的显示格式
 */
export function formatDate(dateStr: string | Date, format: 'full' | 'short' | 'relative' = 'short'): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  
  if (isNaN(date.getTime())) {
    return '无效日期';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  switch (format) {
    case 'relative':
      if (diffDays === 0) return '今天';
      if (diffDays === 1) return '昨天';
      if (diffDays === -1) return '明天';
      if (diffDays > 0 && diffDays < 7) return `${diffDays}天前`;
      if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)}天后`;
      return date.toLocaleDateString('zh-CN');
      
    case 'full':
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      });
      
    case 'short':
    default:
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
  }
}

/**
 * 格式化时间范围
 */
export function formatTimeRange(startDate: string | Date, endDate: string | Date): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startStr = start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  
  return `${startStr} - ${endStr}`;
}

// ================================
// 用户数据转换器
// ================================

/**
 * 获取用户显示名称
 */
export function getUserDisplayName(user: User): string {
  return user.fullName || user.username || '未知用户';
}

/**
 * 获取用户头像URL
 */
export function getUserAvatarUrl(user: User, size: number = 40): string {
  if (user.avatarUrl) {
    return `${user.avatarUrl}?s=${size}`;
  }
  
  // 生成默认头像
  const name = getUserDisplayName(user);
  const firstChar = name.charAt(0).toUpperCase();
  const bgColor = generateColorFromString(name);
  
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${bgColor}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" 
            fill="white" text-anchor="middle" dominant-baseline="central">${firstChar}</text>
    </svg>
  `)}`;
}

/**
 * 根据字符串生成一致的颜色
 */
function generateColorFromString(str: string): string {
  const colors = [
    '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#6366F1', '#84CC16', '#F97316'
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// ================================
// 事件数据转换器
// ================================

/**
 * 转换事件类别为中文显示
 */
export function formatEventCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'tech_share': '技术分享',
    'startup_share': '创业分享',
    'networking': '网络聚会',
    'workshop': '工作坊',
    'seminar': '研讨会',
    'conference': '会议',
  };
  
  return categoryMap[category] || category;
}

/**
 * 转换事件状态为中文显示
 */
export function formatEventStatus(event: Event): {
  status: 'upcoming' | 'ongoing' | 'completed';
  label: string;
  color: string;
} {
  const now = new Date();
  const eventDate = new Date(event.date);
  
  if (eventDate > now) {
    return {
      status: 'upcoming',
      label: '即将开始',
      color: 'blue'
    };
  } else if (eventDate.toDateString() === now.toDateString()) {
    return {
      status: 'ongoing',
      label: '进行中',
      color: 'green'
    };
  } else {
    return {
      status: 'completed',
      label: '已结束',
      color: 'gray'
    };
  }
}

/**
 * 计算事件报名状态
 */
export function calculateEventRegistrationStatus(event: EventWithStats): {
  canRegister: boolean;
  isFull: boolean;
  isRegistered: boolean;
  message: string;
} {
  const { maxAttendees, currentAttendees, isRegistered } = event;
  const isFull = maxAttendees ? currentAttendees >= maxAttendees : false;
  const eventStatus = formatEventStatus(event);
  
  if (isRegistered) {
    return {
      canRegister: false,
      isFull,
      isRegistered: true,
      message: '已报名'
    };
  }
  
  if (eventStatus.status === 'completed') {
    return {
      canRegister: false,
      isFull,
      isRegistered: false,
      message: '活动已结束'
    };
  }
  
  if (isFull) {
    return {
      canRegister: false,
      isFull: true,
      isRegistered: false,
      message: '报名已满'
    };
  }
  
  return {
    canRegister: true,
    isFull: false,
    isRegistered: false,
    message: '立即报名'
  };
}

// ================================
// 匹配数据转换器
// ================================

/**
 * 转换匹配分数为可读的描述
 */
export function formatMatchScore(score: number): {
  level: 'low' | 'medium' | 'high' | 'excellent';
  label: string;
  color: string;
  percentage: number;
} {
  const percentage = Math.round(score * 100);
  
  if (score >= 0.9) {
    return { level: 'excellent', label: '极高匹配', color: 'emerald', percentage };
  } else if (score >= 0.7) {
    return { level: 'high', label: '高度匹配', color: 'green', percentage };
  } else if (score >= 0.5) {
    return { level: 'medium', label: '中等匹配', color: 'yellow', percentage };
  } else {
    return { level: 'low', label: '低匹配度', color: 'red', percentage };
  }
}

/**
 * 转换匹配原因为中文显示
 */
export function formatMatchReasons(reasons: string[]): string[] {
  const reasonMap: Record<string, string> = {
    'role_compatibility': '角色互补',
    'skill_match': '技能匹配',
    'location_proximity': '地理位置接近',
    'experience_level': '经验水平相当',
    'industry_overlap': '行业经验重叠',
    'commitment_alignment': '投入程度一致',
    'timezone_compatible': '时区兼容',
    'startup_stage_match': '创业阶段匹配',
  };
  
  return reasons.map(reason => reasonMap[reason] || reason);
}

// ================================
// 通知数据转换器
// ================================

/**
 * 转换通知类型为中文显示
 */
export function formatNotificationType(type: string): {
  label: string;
  icon: string;
  color: string;
} {
  const typeMap: Record<string, { label: string; icon: string; color: string }> = {
    'match': { label: '新匹配', icon: '🤝', color: 'blue' },
    'message': { label: '新消息', icon: '💬', color: 'green' },
    'event': { label: '活动通知', icon: '📅', color: 'purple' },
    'system': { label: '系统通知', icon: '⚙️', color: 'gray' },
    'feedback': { label: '反馈请求', icon: '📝', color: 'orange' },
    'reminder': { label: '提醒', icon: '⏰', color: 'yellow' },
  };
  
  return typeMap[type] || { label: type, icon: '📢', color: 'gray' };
}

// ================================
// 数字格式化转换器
// ================================

/**
 * 格式化大数字
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * 格式化百分比
 */
export function formatPercentage(ratio: number, decimals = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/**
 * 格式化评分
 */
export function formatRating(rating: number, maxRating = 5): string {
  const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(maxRating - Math.floor(rating));
  return `${stars} ${rating.toFixed(1)}`;
}

// ================================
// 文本处理转换器
// ================================

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 高亮搜索关键词
 */
export function highlightSearchText(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
}

/**
 * 转换Markdown为HTML (简单版本)
 */
export function simpleMarkdownToHtml(markdown: string): string {
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ================================
// URL和链接处理
// ================================

/**
 * 验证URL格式
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 格式化URL显示
 */
export function formatUrlForDisplay(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch (_) {
    return url;
  }
}

// ================================
// 数据验证和清理
// ================================

/**
 * 清理HTML标签
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}