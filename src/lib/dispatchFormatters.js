import { format, isValid, parse } from 'date-fns';

export function formatDispatchTime(startTime) {
  if (typeof startTime !== 'string') return '';

  const value = startTime.trim();
  if (!value) return '';

  const patterns = ['HH:mm:ss', 'HH:mm', 'h:mm a', 'h:mma'];

  for (const pattern of patterns) {
    const parsed = parse(value.toUpperCase(), pattern, new Date());
    if (isValid(parsed)) {
      return format(parsed, 'h:mm a');
    }
  }

  return '';
}
