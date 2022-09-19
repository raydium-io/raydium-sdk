import { get, set } from "lodash";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

export type ModuleName = "Common.Api";

export enum LogLevel {
  Error,
  Warning,
  Info,
  Debug,
}
export class Logger {
  private logLevel: LogLevel;
  private name: string;
  constructor(params: { name: string; logLevel?: LogLevel }) {
    this.logLevel = params.logLevel !== undefined ? params.logLevel : LogLevel.Error;
    this.name = params.name;
  }

  set level(logLevel: LogLevel) {
    this.logLevel = logLevel;
  }
  get time(): string {
    return dayjs().utc().format("YYYY/MM/DD HH:mm:ss UTC");
  }
  get moduleName(): string {
    return this.name;
  }

  private isLogLevel(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  public error(...props): Logger {
    if (!this.isLogLevel(LogLevel.Error)) return this;
    console.error(this.time, this.name, "sdk logger error", ...props);
    return this;
  }

  public logWithError(...props): Logger {
    // this.error(...props)
    const msg = props.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(", ");
    throw new Error(msg);
  }

  public warning(...props): Logger {
    if (!this.isLogLevel(LogLevel.Warning)) return this;
    console.warn(this.time, this.name, "sdk logger warning", ...props);
    return this;
  }

  public info(...props): Logger {
    if (!this.isLogLevel(LogLevel.Info)) return this;
    console.info(this.time, this.name, "sdk logger info", ...props);
    return this;
  }

  public debug(...props): Logger {
    if (!this.isLogLevel(LogLevel.Debug)) return this;
    console.debug(this.time, this.name, "sdk logger debug", ...props);
    return this;
  }
}

const moduleLoggers: { [key in ModuleName]?: Logger } = {};
const moduleLevels: { [key in ModuleName]?: LogLevel } = {};

export function createLogger(moduleName: string): Logger {
  let logger = get(moduleLoggers, moduleName);
  if (!logger) {
    // default level is error
    const logLevel = get(moduleLevels, moduleName);

    logger = new Logger({ name: moduleName, logLevel });
    set(moduleLoggers, moduleName, logger);
  }

  return logger;
}

export function setLoggerLevel(moduleName: string, level: LogLevel): void {
  set(moduleLevels, moduleName, level);

  const logger = get(moduleLoggers, moduleName);
  if (logger) logger.level = level;
}
