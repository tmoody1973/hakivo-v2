# Federal Register - Bell Notification System Integration

**Document Date:** December 31, 2025
**Purpose:** Detailed integration plan for Federal Register notifications with existing Hakivo bell icon system

---

## 📔 Current Hakivo Notification System

### Existing Components
- **Location:** `/components/notifications/notification-bell.tsx`
- **Bell Icon:** Top navigation bar (header)
- **Current Types:** Bill updates, daily briefs, chat messages
- **Database:** `notifications` table in Supabase

---

## 🔔 Federal Register Integration Architecture

### System Overview
```
Federal Register API → Daily Sync → Match User Interests → Create Notifications → Bell Icon
                                                                ↓
                                                    Store in notifications table
                                                                ↓
                                                    Update bell badge count
                                                                ↓
                                                    User clicks bell → Dropdown shows
```

---

## 📊 Notification Types & Display

### In Bell Dropdown

```tsx
// Example notification cards in bell dropdown

┌─────────────────────────────────────────────┐
│ 🔨 Executive Order 14122                    │ [URGENT]
│ Climate Emergency Declaration                │
│ President Biden signed 10 minutes ago        │
│                                             │
│ [Read Order →]                              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📋 New EPA Rule Published                   │ [NORMAL]
│ Methane Emissions Standards                  │
│ Affects energy sector - effective Feb 1      │
│                                             │
│ [View Details →]                            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ⏰ Comment Deadline Approaching             │ [TIME-SENSITIVE]
│ FTC Junk Fees Ban                           │
│ Only 5 days left to submit comment          │
│                                             │
│ [Submit Comment →]                          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📈 Implementation Update                    │ [LOW]
│ Healthcare order 40% implemented            │
│ 3 states adopted, 2 pending                 │
│                                             │
│ [Track Progress →]                         │
└─────────────────────────────────────────────┘
```

---

## 💾 Database Schema Extension

### Notifications Table Update
```sql
-- Add federal_register fields to existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS
  notification_category ENUM(
    'bill_update',      -- Existing
    'daily_brief',      -- Existing
    'chat_message',     -- Existing
    'executive_order',  -- NEW
    'federal_rule',     -- NEW
    'comment_deadline', -- NEW
    'implementation'    -- NEW
  );

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS
  federal_data JSONB; -- Stores document_number, agency, deadline, etc.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS
  auto_dismiss_at TIMESTAMP; -- For time-sensitive notifications

-- Index for performance
CREATE INDEX idx_notifications_category ON notifications(notification_category);
CREATE INDEX idx_notifications_federal ON notifications((federal_data->>'document_number'));
```

---

## 🎨 UI Components

### Enhanced Bell Icon Component
```tsx
// /components/notifications/notification-bell.tsx

import { Bell, Gavel, FileText, Clock, TrendingUp } from 'lucide-react';

export function NotificationBell() {
  const { notifications, unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Group notifications by category
  const groupedNotifications = useMemo(() => {
    return {
      urgent: notifications.filter(n => n.priority === 'urgent'),
      federal: notifications.filter(n =>
        ['executive_order', 'federal_rule', 'comment_deadline']
          .includes(n.notification_category)
      ),
      bills: notifications.filter(n => n.notification_category === 'bill_update'),
      other: notifications.filter(n =>
        !['executive_order', 'federal_rule', 'comment_deadline', 'bill_update']
          .includes(n.notification_category)
      )
    };
  }, [notifications]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 max-h-[600px] overflow-y-auto">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
          >
            Mark all read
          </Button>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Urgent Section */}
        {groupedNotifications.urgent.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-semibold text-red-600">
              🚨 Urgent
            </div>
            {groupedNotifications.urgent.map(n => (
              <FederalNotificationItem key={n.id} notification={n} />
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Federal Actions Section */}
        {groupedNotifications.federal.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-semibold text-blue-600">
              🏛️ Federal Actions
            </div>
            {groupedNotifications.federal.map(n => (
              <FederalNotificationItem key={n.id} notification={n} />
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Bills Section */}
        {groupedNotifications.bills.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-semibold text-gray-600">
              📜 Bill Updates
            </div>
            {groupedNotifications.bills.map(n => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/notifications/settings" className="text-center w-full">
            Notification Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Federal Notification Item Component
```tsx
function FederalNotificationItem({ notification }) {
  const getIcon = () => {
    switch (notification.notification_category) {
      case 'executive_order':
        return <Gavel className="h-4 w-4 text-blue-500" />;
      case 'federal_rule':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'comment_deadline':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'implementation':
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <DropdownMenuItem className="p-3 cursor-pointer" asChild>
      <Link href={notification.action_url}>
        <div className="flex gap-3 w-full">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium",
              !notification.read && "font-semibold"
            )}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {notification.message}
            </p>

            {/* Federal-specific data */}
            {notification.federal_data && (
              <div className="flex items-center gap-2 mt-1">
                {notification.federal_data.agency && (
                  <Badge variant="outline" className="text-xs">
                    {notification.federal_data.agency}
                  </Badge>
                )}
                {notification.federal_data.days_until_deadline && (
                  <span className="text-xs text-orange-500 font-medium">
                    {notification.federal_data.days_until_deadline} days left
                  </span>
                )}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(notification.created_at)}
            </p>
          </div>

          {/* Unread indicator */}
          {!notification.read && (
            <div className="flex-shrink-0">
              <div className="h-2 w-2 bg-blue-500 rounded-full" />
            </div>
          )}
        </div>
      </Link>
    </DropdownMenuItem>
  );
}
```

---

## 🔄 Notification Creation Flow

### 1. Daily Sync Creates Notifications
```typescript
// /hakivo-api/src/federal-register-sync/index.ts

async function createFederalNotifications(
  documents: FederalDocument[],
  matchedUsers: UserMatch[]
) {
  const notifications = [];

  for (const match of matchedUsers) {
    const { user, document, matchReason } = match;

    // Determine priority
    const priority = getPriority(document);

    // Create notification
    const notification = {
      user_id: user.id,
      title: getNotificationTitle(document),
      message: getNotificationMessage(document, matchReason),
      notification_category: getCategory(document.type),
      priority,
      action_url: `/federal-register/${document.document_number}`,
      federal_data: {
        document_number: document.document_number,
        document_type: document.type,
        agency: document.agencies[0],
        publication_date: document.publication_date,
        comment_deadline: document.comment_end_date,
        days_until_deadline: calculateDaysLeft(document.comment_end_date),
        match_reason: matchReason,
        significance: document.significance
      },
      auto_dismiss_at: getAutoDismissDate(document),
      read: false,
      created_at: new Date()
    };

    notifications.push(notification);
  }

  // Batch insert
  await supabase
    .from('notifications')
    .insert(notifications);

  // Send push notifications for urgent items
  const urgentNotifications = notifications.filter(n => n.priority === 'urgent');
  await sendPushNotifications(urgentNotifications);
}
```

### 2. Real-Time Updates
```typescript
// Subscribe to new federal notifications
const subscription = supabase
  .channel('federal-notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId} AND notification_category=in.(executive_order,federal_rule,comment_deadline)`
    },
    (payload) => {
      // Update bell icon badge count
      incrementUnreadCount();

      // Show toast for urgent items
      if (payload.new.priority === 'urgent') {
        toast({
          title: payload.new.title,
          description: payload.new.message,
          action: (
            <ToastAction onClick={() => navigate(payload.new.action_url)}>
              View
            </ToastAction>
          )
        });
      }
    }
  )
  .subscribe();
```

---

## ⚙️ Notification Settings

### User Preferences UI
```tsx
// /app/notifications/settings/page.tsx

<Card>
  <CardHeader>
    <CardTitle>Federal Register Notifications</CardTitle>
    <CardDescription>
      Control which federal actions trigger notifications
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <Label>Executive Orders</Label>
        <p className="text-sm text-muted-foreground">
          Presidential actions and executive orders
        </p>
      </div>
      <Switch
        checked={settings.executive_orders}
        onCheckedChange={(v) => updateSetting('executive_orders', v)}
      />
    </div>

    <div className="flex items-center justify-between">
      <div>
        <Label>New Rules & Regulations</Label>
        <p className="text-sm text-muted-foreground">
          Federal agency rules affecting your interests
        </p>
      </div>
      <Switch
        checked={settings.federal_rules}
        onCheckedChange={(v) => updateSetting('federal_rules', v)}
      />
    </div>

    <div className="flex items-center justify-between">
      <div>
        <Label>Comment Deadlines</Label>
        <p className="text-sm text-muted-foreground">
          Reminders for public comment opportunities
        </p>
      </div>
      <Switch
        checked={settings.comment_deadlines}
        onCheckedChange={(v) => updateSetting('comment_deadlines', v)}
      />
    </div>

    <Separator />

    <div>
      <Label>Comment Deadline Reminders</Label>
      <RadioGroup value={settings.deadline_reminder}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="1" id="r1" />
          <Label htmlFor="r1">1 day before</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="3" id="r3" />
          <Label htmlFor="r3">3 days before</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="7" id="r7" />
          <Label htmlFor="r7">1 week before</Label>
        </div>
      </RadioGroup>
    </div>
  </CardContent>
</Card>
```

---

## 📱 Mobile Considerations

### Responsive Bell Dropdown
```tsx
// Mobile-optimized notification view
<Sheet open={isMobile && isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="right" className="w-full sm:w-96">
    <SheetHeader>
      <SheetTitle>Notifications</SheetTitle>
    </SheetHeader>

    <ScrollArea className="h-[calc(100vh-120px)] mt-4">
      {/* Same notification content */}
    </ScrollArea>
  </SheetContent>
</Sheet>
```

---

## 📊 Analytics & Metrics

### Track Notification Engagement
```typescript
// Track notification interactions
async function trackNotificationClick(notification: Notification) {
  await analytics.track('Notification Clicked', {
    notification_id: notification.id,
    category: notification.notification_category,
    federal_document: notification.federal_data?.document_number,
    time_to_click: Date.now() - notification.created_at,
    was_urgent: notification.priority === 'urgent'
  });
}

// Monitor notification effectiveness
const metrics = {
  click_through_rate: {
    executive_orders: 0.65,  // 65% CTR
    federal_rules: 0.45,     // 45% CTR
    comment_deadlines: 0.72  // 72% CTR (highest engagement)
  },
  average_time_to_read: '2.3 minutes',
  dismissal_rate: 0.15  // 15% dismissed without reading
};
```

---

## 🚀 Implementation Checklist

### Phase 1: Basic Integration (Week 1)
- [ ] Extend notifications table schema
- [ ] Create federal notification types
- [ ] Integrate with daily sync job
- [ ] Update bell icon component
- [ ] Add federal notification items

### Phase 2: Enhanced UI (Week 2)
- [ ] Group notifications by category
- [ ] Add icons for different types
- [ ] Implement urgency indicators
- [ ] Create settings page
- [ ] Add mobile optimization

### Phase 3: Advanced Features (Week 3)
- [ ] Smart notification batching
- [ ] Deadline reminders
- [ ] Predictive notifications
- [ ] Analytics tracking
- [ ] A/B testing different formats

---

## 🎯 Success Metrics

- **Badge Accuracy**: Bell count matches unread notifications 100%
- **Load Time**: Dropdown opens in <200ms
- **Engagement**: >60% of federal notifications clicked
- **Retention**: Users with federal notifications enabled have 25% better retention
- **Satisfaction**: >4.5/5 rating for notification relevance

---

*This integration ensures Federal Register notifications seamlessly blend with Hakivo's existing notification system while adding valuable new functionality for users.*