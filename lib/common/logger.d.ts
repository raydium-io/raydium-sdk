import { Logger, LevelWithSilent } from 'pino';

declare type ModuleName = "Common.Api";
interface LoggerInstance extends Logger {
    logWithError: (...args: any) => void;
}
declare function createLogger(moduleName: string): LoggerInstance;
declare function setLoggerLevel(moduleName: ModuleName, level: LevelWithSilent): void;

export { LoggerInstance, ModuleName, createLogger, setLoggerLevel };
