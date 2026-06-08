import { mkdirSync } from "node:fs";
import path from "node:path";
import pino, { type Logger } from "pino";

const LOG_DIR = path.resolve(process.cwd(), "logs");
mkdirSync(LOG_DIR, { recursive: true });

const isProd = process.env.NODE_ENV === "production";
const isService = process.env.PUSH_SERVICE_MODE === "1";

const transport = isProd
  ? pino.transport({
      target: "pino-roll",
      options: {
        file: path.join(LOG_DIR, "push.log"),
        frequency: "daily",
        size: "20m",
        mkdir: true,
      },
    })
  : pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss" },
    });

// When Push runs as a Windows service, mirror warn+ lines to the Windows
// Event Log so failures surface alongside the rest of the OS in Event
// Viewer. node-windows is only loaded under PUSH_SERVICE_MODE so dev/test
// runs don't pull in the native deps unnecessarily.
type EventSink = {
  warn: (msg: string) => void;
  error: (msg: string) => void;
};
let eventSink: EventSink | null = null;

if (isService) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EventLogger } = require("node-windows") as {
      EventLogger: new (source: string) => {
        warn: (msg: string) => void;
        error: (msg: string) => void;
      };
    };
    const ev = new EventLogger("PushScheduler");
    eventSink = {
      warn: (msg) => {
        try {
          ev.warn(msg);
        } catch {
          // never let logging take down the worker
        }
      },
      error: (msg) => {
        try {
          ev.error(msg);
        } catch {
          // ditto
        }
      },
    };
  } catch {
    // node-windows not loadable here — silently skip, file log still works.
  }
}

function mirrorToEventLog(level: number, args: unknown[]): void {
  if (!eventSink) return;
  // pino numeric levels: warn=40, error=50, fatal=60.
  if (level < 40) return;
  // pino calls method(obj, msg) or method(msg). Stringify defensively.
  let text: string;
  if (typeof args[0] === "string") {
    text = args.slice(0, 2).filter(Boolean).join(" ");
  } else if (args[0] && typeof args[0] === "object") {
    const msg = typeof args[1] === "string" ? args[1] : "";
    try {
      text = `${msg} ${JSON.stringify(args[0])}`.trim();
    } catch {
      text = msg;
    }
  } else {
    text = String(args[0] ?? "");
  }
  if (level >= 50) eventSink.error(text);
  else eventSink.warn(text);
}

export const logger: Logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    hooks: {
      logMethod(inputArgs, method, level) {
        method.apply(this, inputArgs as Parameters<typeof method>);
        if (eventSink) mirrorToEventLog(level, inputArgs as unknown[]);
      },
    },
  },
  transport,
);

export function child(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
