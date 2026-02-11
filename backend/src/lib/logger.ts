import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: process.env.NODE_ENV || "development",
    service: "dhimmobilier-api",
  },
});

// Helpers pour les logs structurés
export const logRequest = (req: any, res: any, duration: number) => {
  logger.info(
    {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
    "HTTP request"
  );
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(
    {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    },
    "Error occurred"
  );
};

export const logRPC = (fn: string, params: any, duration: number, success: boolean) => {
  logger.info(
    {
      rpc: fn,
      params: sanitizeParams(params),
      duration: `${duration}ms`,
      success,
    },
    "RPC call"
  );
};

// Sanitize les paramètres pour éviter de logger des mots de passe
function sanitizeParams(params: any) {
  if (!params || typeof params !== "object") return params;
  const sanitized = { ...params };
  const sensitiveKeys = ["password", "password_hash", "token", "secret"];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = "***REDACTED***";
    }
  }
  return sanitized;
}
