const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPTS = { hour: 'numeric', minute: '2-digit', hour12: true };

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', DATE_OPTS);
}

export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { ...DATE_OPTS, ...TIME_OPTS });
}

export function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-US', TIME_OPTS);
}

export function fmtChartDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}
