import pino, { Level } from "pino";
import pretty from "pino-pretty";

type Modules = "Utility.Api";

const modulesLevel: Record<string, Level> = {};

const stream = pretty({
  colorize: true,
  levelFirst: true,
  translateTime: "SYS:yyyymmdd HH:MM:ss.l",
  // messageFormat: (log, messageKey, levelLabel) => {
  //   console.log(log, messageKey, levelLabel);
  //   return `hello ${log}`;
  // },
});
const logger = pino(
  {
    level: "trace",
    base: null,
  },
  stream,
);

export function createLogger(name: string) {
  return logger.child({ name }, {});
}

export function setLoggerLevel(level: Record<string, Level>) {}
