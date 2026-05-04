const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "database_url",
  "statement",
  "extract",
];

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function shouldRedactKey(key) {
  const normalizedKey = String(key ?? "").toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment));
}

function truncateString(value, maxLength = 500) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function sanitizeValue(value, key = "") {
  if (shouldRedactKey(key)) {
    return "[redacted]";
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message, 300),
      ...(typeof value.stack === "string" && value.stack
        ? {
            stack: process.env.NODE_ENV === "production" ? truncateString(value.stack, 2_000) : value.stack,
          }
        : {}),
      ...(value.cause ? { cause: sanitizeValue(value.cause, "cause") } : {}),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeValue(entry));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)]),
    );
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  return value;
}

function writeLog(level, message, context = {}) {
  const payload = sanitizeValue(context);
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...payload,
  };
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  info(message, context) {
    writeLog("info", message, context);
  },
  warn(message, context) {
    writeLog("warn", message, context);
  },
  error(message, context) {
    writeLog("error", message, context);
  },
};
