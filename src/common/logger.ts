import { get, set } from "lodash";
import pino, { LevelWithSilent, Logger } from "pino";
import pretty from "pino-pretty";

export type ModuleName = "Common.Api";

const moduleLoggers: { [key in ModuleName]?: Logger } = {};

const moduleLevels: { [key in ModuleName]?: LevelWithSilent } = {};

const stream = pretty({
  colorize: true,
  levelFirst: true,
  translateTime: "SYS:yyyymmdd HH:MM:ss.l",
});
const globalLogger = pino({ base: null, level: "silent" }, stream);

export interface LoggerInstance extends Logger {
  logWithError: (...args: any) => void;
}

export function createLogger(moduleName: string): LoggerInstance {
  let logger = get(moduleLoggers, moduleName);

  if (!logger) {
    // default level is silent
    const level = get(moduleLevels, moduleName);

    logger = globalLogger.child({ name: moduleName }, { level });
    set(moduleLoggers, moduleName, logger);
  }

  logger.logWithError = (...args): void => {
    const msg = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(", ");
    // logger.error(msg);
    throw new Error(msg);
  };

  return logger;
}

export function setLoggerLevel(moduleName: ModuleName, level: LevelWithSilent): void {
  set(moduleLevels, moduleName, level);

  const logger = get(moduleLoggers, moduleName);
  if (logger) logger.level = level;
}
