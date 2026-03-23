import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = resolve(__dirname, "../..");

export const PATHS = {
  config: resolve(PLUGIN_ROOT, "config.json"),
  configExample: resolve(PLUGIN_ROOT, "config.example.json"),
  portfolios: resolve(PLUGIN_ROOT, "data/portfolios.json"),
  financials: resolve(PLUGIN_ROOT, "data/financials"),
  assessments: resolve(PLUGIN_ROOT, "data/assessments"),
  charts: resolve(PLUGIN_ROOT, "output/charts"),
  methodology: resolve(PLUGIN_ROOT, "methodology.md"),
};
