import fs from "fs";

export function mkdirIfNotExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

export function getTimestamp() {
  return new Date().toISOString().replace(/\.\d+Z/i, "+0000");
}

export function writeJsonFile(fileName: string, context: object) {
  fs.writeFileSync(fileName, `${JSON.stringify(context, null, 2)}\n`);
}
