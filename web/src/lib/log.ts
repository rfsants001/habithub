const isDev = import.meta.env.DEV;

export const log = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug("[habithub]", ...args);
    }
  },
  error: (message: string, extra?: unknown) => {
    if (isDev) {
      console.error("[habithub]", message, extra ?? "");
    }
  },
};
