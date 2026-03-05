import { format, isValid, parseISO } from 'date-fns';

export function formatNotificationDetailsMessage(message) {
  if (typeof message !== 'string') return message;

  const [dispatchDate, ...rest] = message.split(' · ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dispatchDate)) return message;

  const parsedDate = parseISO(dispatchDate);
  if (!isValid(parsedDate)) return message;

  return [format(parsedDate, 'EEEE MM-dd-yyyy'), ...rest].join(' · ');
}
