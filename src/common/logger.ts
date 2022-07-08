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
const globalLogger = pino({ base: null }, stream);

export function createLogger(moduleName: string): Logger {
  let logger = get(moduleLoggers, moduleName);

  if (!logger) {
    // default level is silent
    const level = get(moduleLevels, moduleName, "silent");

    logger = globalLogger.child({ name: moduleName }, { level });
    set(moduleLoggers, moduleName, logger);
  }

  return logger;
}

export function setLoggerLevel(moduleName: ModuleName, level: LevelWithSilent): void {
  set(moduleLevels, moduleName, level);

  const logger = get(moduleLoggers, moduleName);
  if (logger) logger.level = level;
}
