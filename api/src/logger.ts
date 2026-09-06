const isProduction = process.env.NODE_ENV === "production";

export const loggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "message",
      "body.message",
      "entry.message",
      "req.body.message",
    ],
    censor: "[redacted]",
  },

  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          colorize: true,
        },
      },

  serializers: {
    req: (req: { method: string; url: string }) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
};
