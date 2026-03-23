import { readFileSync, existsSync } from "fs";
import { PATHS } from "./paths.js";

export interface Config {
  sec_edgar: {
    user_agent: string;
  };
  assessment: {
    model: string;
    max_budget_usd: number;
    max_turns: number;
  };
  charts: {
    output_dir: string;
    auto_open: boolean;
  };
}

export function loadConfig(): Config {
  if (!existsSync(PATHS.config)) {
    throw new Error(
      "config.json not found. Run setup first: npx tsx scripts/setup.ts"
    );
  }
  return JSON.parse(readFileSync(PATHS.config, "utf-8"));
}
