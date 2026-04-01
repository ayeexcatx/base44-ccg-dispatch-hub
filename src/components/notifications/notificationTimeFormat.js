const ADMIN_NOTIFICATION_TIMEZONE = 'America/New_York';

export function formatAdminNotificationTime(value, { withYear = false } = {}) {
  if (!value) return '—';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: ADMIN_NOTIFICATION_TIMEZONE,
  }).format(parsedDate);
}

