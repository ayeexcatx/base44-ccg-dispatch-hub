export function normalizeTimeValue(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return raw;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return raw;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatTime24h(value) {
  return normalizeTimeValue(value);
}

export function hasCompleteTimeLog(entry) {
  return Boolean(entry?.start_time && entry?.end_time);
}

function toMinutes(value) {
  const normalized = normalizeTimeValue(value);
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

export function calculateWorkedHours(startTime, endTime) {
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  if (startMin == null || endMin == null) return null;
  let durationMinutes = endMin - startMin;
  if (durationMinutes < 0) durationMinutes += 24 * 60;
  return durationMinutes / 60;
}

export function formatWorkedHours(hours) {
  if (hours == null || Number.isNaN(hours)) return '';
  return Number(hours.toFixed(2)).toString();
}

export function areAllAssignedTrucksTimeComplete(dispatch, dispatchTimeEntries = []) {
  const assigned = dispatch?.trucks_assigned || [];
  if (assigned.length === 0) return false;

  return assigned.every((truck) => {
    const entry = dispatchTimeEntries.find((te) => te.truck_number === truck);
    return hasCompleteTimeLog(entry);
  });
}
