const SESSION_LOST_CODES = [401, 403, 404];

export function getLoginAwareErrors(err, message = '') {
  const errors = Array.isArray(err) ? err : (err ? [err] : []);

  if (!errors.length) {
    return [];
  }

  const generic = message;

  if (errors.some((e) => SESSION_LOST_CODES.includes(e?._status || e?.response?.status))) {
    return [generic];
  }

  const msgs = errors
    .map((e) => (typeof e === 'string' ? e : (e?.message || e?._statusText || '')))
    .filter(Boolean);

  return msgs.length ? msgs : [generic];
}
