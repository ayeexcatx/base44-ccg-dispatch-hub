import { format, isValid, parseISO } from 'date-fns';
import { formatDispatchTime } from '@/lib/dispatchFormatters';

const SCHEDULE_STATUS_TEXTS = ['Schedule', 'Scheduled'];

export function formatNotificationDetailsMessage(message, dispatch = null) {
  if (typeof message !== 'string') return message;

  const [dispatchDate, ...rest] = message.split(' · ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dispatchDate)) return message;

  const parsedDate = parseISO(dispatchDate);
  if (!isValid(parsedDate)) return message;

  const dateText = format(parsedDate, 'EEE MM-dd-yyyy').toUpperCase();
  const statusText = typeof dispatch?.status === 'string'
    ? dispatch.status
    : rest[1]?.split(' | ')[0] || '';
  const isScheduleStatus = SCHEDULE_STATUS_TEXTS.includes(statusText);
  const timeText = formatDispatchTime(dispatch?.start_time);
  const dateTimeText = !isScheduleStatus && timeText ? `${dateText} at ${timeText}` : dateText;

  return [dateTimeText, ...rest].join(' · ');
}
