import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json");

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const APP_VERSION = process.env.APP_VERSION?.trim() || readPackageVersion();
