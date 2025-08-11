# 技术债务与紧急修复清单

## 🚨 P0 - 立即修复 (生产阻塞问题)

### 1. 活动报名竞态条件 (Critical)

**问题描述**: 
```typescript
// 当前有问题的代码 (server/storage.ts:132-145)
async function registerForEvent(userId: string, eventId: string) {
  // ❌ 问题1: 两个独立操作，非原子性
  await db.insert(eventRegistrations).values({
    userId, eventId, registeredAt: new Date()
  });
  
  // ❌ 问题2: 可能失败导致数据不一致
  await db.update(events)
    .set({ currentAttendees: sql`${events.currentAttendees} + 1` })
    .where(eq(events.id, eventId));
}
```

**风险评估**: 
- 高并发时数据不一致
- 可能超员但系统未感知
- 用户体验差 (显示错误信息)

**修复方案**:
```typescript
// ✅ 修复后的代码
async function registerForEvent(userId: string, eventId: string) {
  return await db.transaction(async (tx) => {
    // 1. 先检查容量和重复注册
    const [event] = await tx.select()
      .from(events)
      .where(eq(events.id, eventId))
      .for('update'); // 行锁防止并发
    
    if (!event) throw new Error('Event not found');
    if (event.currentAttendees >= event.maxAttendees) {
      throw new Error('Event is full');
    }
    
    // 2. 检查重复注册
    const existing = await tx.select()
      .from(eventRegistrations)
      .where(and(
        eq(eventRegistrations.userId, userId),
        eq(eventRegistrations.eventId, eventId)
      ));
    
    if (existing.length > 0) {
      throw new Error('Already registered');
    }
    
    // 3. 原子操作：插入注册记录并更新计数
    await tx.insert(eventRegistrations).values({
      userId, eventId, registeredAt: new Date()
    });
    
    await tx.update(events)
      .set({ 
        currentAttendees: event.currentAttendees + 1,
        updatedAt: new Date()
      })
      .where(eq(events.id, eventId));
    
    return { success: true, newCount: event.currentAttendees + 1 };
  });
}
```

**实施位置**: 
- `server/storage.ts` - 修改 registerForEvent 和 unregisterFromEvent 函数
- `server/routes.ts` - 更新错误处理逻辑
- `client/src/pages/events-page.tsx` - 更新错误提示

**预计工时**: 1天

---

### 2. 数据库索引缺失 (Performance)

**问题描述**: 
```sql
-- ❌ 当前缺失的关键索引
-- 事件查询缺少索引
SELECT * FROM events WHERE category = 'tech_share' ORDER BY startTime; -- 慢查询

-- 注册查询缺少复合索引  
SELECT * FROM eventRegistrations WHERE userId = 'xxx' AND eventId = 'yyy'; -- 慢查询

-- 匹配查询缺少索引
SELECT * FROM matches WHERE user1Id = 'xxx' OR user2Id = 'xxx'; -- 极慢查询
```

**修复方案**:
```typescript
// ✅ 在 shared/schema.ts 添加索引
export const events = pgTable('events', {
  // ... existing fields
}, (table) => ({
  categoryIdx: index('events_category_idx').on(table.category),
  startTimeIdx: index('events_start_time_idx').on(table.startTime),
  statusIdx: index('events_status_idx').on(table.status),
  // 复合索引用于筛选
  categoryStartTimeIdx: index('events_category_start_time_idx')
    .on(table.category, table.startTime),
}));

export const eventRegistrations = pgTable('event_registrations', {
  // ... existing fields  
}, (table) => ({
  userEventIdx: uniqueIndex('event_reg_user_event_idx')
    .on(table.userId, table.eventId), // 防重复注册
  eventIdx: index('event_reg_event_idx').on(table.eventId),
  userIdx: index('event_reg_user_idx').on(table.userId),
}));

export const matches = pgTable('matches', {
  // ... existing fields
}, (table) => ({
  user1Idx: index('matches_user1_idx').on(table.user1Id),
  user2Idx: index('matches_user2_idx').on(table.user2Id),
  scoreIdx: index('matches_score_idx').on(table.matchScore),
  // 复合索引用于双向匹配查询
  usersIdx: index('matches_users_idx').on(table.user1Id, table.user2Id),
}));
```

**实施位置**:
- `shared/schema.ts` - 添加所有索引定义
- 运行 `npm run db:push` 应用数据库变更

**预计工时**: 0.5天

---

### 3. 用户资料系统缺失 (UX Blocker)

**问题描述**: 
- 用户无法查看/编辑详细资料
- Co-founder匹配缺少用户详细信息展示
- 无头像上传功能

**修复方案**:
```typescript
// ✅ 1. 添加用户资料页面组件
// client/src/pages/profile-page.tsx
export function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <ProfileHeader user={user} onEdit={() => setIsEditing(true)} />
        {isEditing ? (
          <ProfileEditForm user={user} onSave={() => setIsEditing(false)} />
        ) : (
          <ProfileDisplay user={user} />
        )}
      </div>
    </div>
  );
}

// ✅ 2. 头像上传组件
// client/src/components/avatar-upload.tsx
export function AvatarUpload({ currentAvatar, onUpload }: AvatarUploadProps) {
  const handleUpload = async (file: File) => {
    // 使用 Cloudinary 或类似服务
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload/avatar', {
      method: 'POST',
      body: formData
    });
    
    const { url } = await response.json();
    onUpload(url);
  };
  
  return (
    <div className="relative">
      <Avatar className="w-24 h-24">
        <AvatarImage src={currentAvatar} />
        <AvatarFallback>Upload</AvatarFallback>
      </Avatar>
      <input 
        type="file" 
        accept="image/*" 
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </div>
  );
}
```

**后端API增强**:
```typescript
// ✅ server/routes.ts 添加用户资料相关端点
app.get('/api/users/:id/profile', async (req, res) => {
  // 获取用户详细资料
});

app.put('/api/users/profile', async (req, res) => {
  // 更新用户资料
});

app.post('/api/upload/avatar', async (req, res) => {
  // 头像上传处理
});
```

**实施位置**:
- `client/src/pages/profile-page.tsx` - 新建用户资料页
- `client/src/components/avatar-upload.tsx` - 新建头像组件
- `server/routes.ts` - 添加相关API端点
- `client/src/App.tsx` - 添加路由配置

**预计工时**: 2天

---

### 4. 消息系统前端缺失 (Core Feature)

**问题描述**: 
- 后端API完整但前端界面完全缺失
- 用户无法发送/查看消息
- Co-founder匹配后无法沟通

**修复方案**:
```typescript
// ✅ 1. 消息列表页面
// client/src/pages/messages-page.tsx
export function MessagesPage() {
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/api/messages/conversations')
  });
  
  return (
    <div className="flex h-[600px]">
      <ConversationList conversations={conversations} />
      <ChatWindow />
    </div>
  );
}

// ✅ 2. 聊天窗口组件
// client/src/components/chat-window.tsx
export function ChatWindow({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState('');
  const { data: messages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/api/messages/${conversationId}`)
  });
  
  const sendMessage = useMutation({
    mutationFn: (content: string) => 
      api.post('/api/messages', { receiverId: conversationId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId]);
      setMessage('');
    }
  });
  
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages?.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入消息..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage.mutate(message)}
          />
          <Button onClick={() => sendMessage.mutate(message)}>
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**实施位置**:
- `client/src/pages/messages-page.tsx` - 新建消息主页
- `client/src/components/chat-window.tsx` - 聊天界面组件
- `client/src/components/conversation-list.tsx` - 对话列表组件
- `client/src/components/message-bubble.tsx` - 消息气泡组件

**预计工时**: 2天

---

## ⚠️ P1 - 高优先级 (用户体验问题)

### 5. Co-founder匹配算法缺失

**问题描述**: matches表存在但无匹配逻辑

**修复方案**:
```typescript
// ✅ server/matching-algorithm.ts
export class MatchingEngine {
  async calculateMatchScore(user1: User, user2: User): Promise<number> {
    let score = 0;
    
    // 1. 研究领域匹配 (30%)
    const fieldOverlap = this.calculateFieldOverlap(
      user1.researchField, user2.researchField
    );
    score += fieldOverlap * 0.3;
    
    // 2. 技能互补性 (40%)
    const skillComplementarity = this.calculateSkillComplementarity(
      user1.skills, user2.skills
    );
    score += skillComplementarity * 0.4;
    
    // 3. 创业阶段匹配 (20%)
    const stageMatch = this.calculateStageCompatibility(
      user1.startupStage, user2.startupStage
    );
    score += stageMatch * 0.2;
    
    // 4. 地理位置 (10%)
    const locationBonus = this.calculateLocationBonus(
      user1.location, user2.location
    );
    score += locationBonus * 0.1;
    
    return Math.min(score, 1.0);
  }
  
  async generateRecommendations(userId: string, limit = 10): Promise<MatchResult[]> {
    // 实现推荐算法
  }
}
```

**预计工时**: 3天

### 6. 活动内容管理系统

**问题描述**: PRD要求的"精华沉淀"功能完全缺失

**修复方案**:
```typescript
// ✅ 新增数据表
export const eventContent = pgTable('event_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  contentType: contentTypeEnum('content_type').notNull(), // video, document, image
  fileUrl: text('file_url'),
  description: text('description'),
  accessLevel: accessLevelEnum('access_level').default('public'), // public, member, premium
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id)
});

// ✅ 内容上传界面
// client/src/pages/content-management.tsx
export function ContentManagementPage() {
  return (
    <div>
      <ContentUploadForm />
      <ContentLibrary />
    </div>
  );
}
```

**预计工时**: 3天

---

## 🔧 P2 - 中等优先级 (优化问题)

### 7. 通知系统集成

**修复方案**:
```typescript
// ✅ 邮件服务集成
// server/services/email-service.ts
import { Resend } from 'resend';

export class EmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);
  
  async sendEventReminder(user: User, event: Event) {
    await this.resend.emails.send({
      from: 'noreply@latentspace.com',
      to: user.email,
      subject: `活动提醒: ${event.title}`,
      html: this.generateEventReminderTemplate(user, event)
    });
  }
  
  async sendMatchNotification(user: User, match: User) {
    // 匹配通知邮件
  }
  
  async sendApplicationStatusUpdate(user: User, status: string) {
    // 申请状态变更通知
  }
}
```

**预计工时**: 2天

### 8. 高级搜索功能

**修复方案**:
```typescript
// ✅ client/src/components/advanced-search.tsx
export function AdvancedSearchFilter() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Select placeholder="研究领域">
        <SelectItem value="ai">人工智能</SelectItem>
        <SelectItem value="biotech">生物技术</SelectItem>
      </Select>
      
      <Select placeholder="创业阶段">
        <SelectItem value="idea">想法阶段</SelectItem>
        <SelectItem value="prototype">原型阶段</SelectItem>
      </Select>
      
      <MultiSelect placeholder="技能标签">
        {skillOptions.map(skill => (
          <SelectItem key={skill} value={skill}>{skill}</SelectItem>
        ))}
      </MultiSelect>
      
      <Input placeholder="地理位置" />
    </div>
  );
}
```

**预计工时**: 1.5天

---

## 📋 实施计划与时间线

### Week 1: P0紧急修复
- Day 1: 修复活动报名竞态条件
- Day 2: 添加数据库索引优化
- Day 3-4: 实现用户资料管理系统
- Day 5: 完成消息系统前端界面

### Week 2: P1核心功能
- Day 1-3: Co-founder匹配算法实现
- Day 4-5: 活动内容管理系统

### Week 3-4: P2优化功能
- 通知系统集成
- 高级搜索功能
- 性能优化与测试

## 🔍 测试验证计划

### 功能测试
- [ ] 活动报名并发测试 (100并发)
- [ ] 用户资料CRUD完整性测试
- [ ] 消息收发实时性测试
- [ ] 匹配算法准确性测试

### 性能测试  
- [ ] 数据库查询响应时间 (<200ms)
- [ ] 页面加载速度 (<3s)
- [ ] 大数据量下的稳定性测试

### 安全测试
- [ ] SQL注入防护测试
- [ ] 文件上传安全测试
- [ ] API访问控制测试

---

*技术债务清单最后更新: 2025-08-11*
*状态: 待实施*