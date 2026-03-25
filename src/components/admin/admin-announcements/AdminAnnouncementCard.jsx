import React from 'react';
import { Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import AnnouncementMetaBadges from './AnnouncementMetaBadges';
import AnnouncementActivityLog from './AnnouncementActivityLog';

export default function AdminAnnouncementCard({
  announcement,
  onToggleActive,
  onEdit,
  targetLabel,
  priorityColors,
  formatActivityTimestamp,
}) {
  return (
    <Card className={`${!announcement.active_flag ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <AnnouncementMetaBadges
              announcement={announcement}
              targetLabel={targetLabel}
              priorityColors={priorityColors}
            />
            <p className="text-sm text-slate-900">{announcement.title}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{announcement.message}</p>
            <AnnouncementActivityLog
              entries={announcement.admin_activity_log}
              formatActivityTimestamp={formatActivityTimestamp}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={announcement.active_flag !== false}
              onCheckedChange={(v) => onToggleActive(announcement, v)}
            />
            <Button variant="ghost" size="icon" onClick={() => onEdit(announcement)} className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
