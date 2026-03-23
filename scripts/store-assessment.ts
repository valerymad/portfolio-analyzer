import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PATHS } from "./lib/paths.js";

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

export function getLatestAssessment(ticker: string): any | null {
  const dir = resolve(PATHS.assessments, ticker.toUpperCase());
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;
  return JSON.parse(readFileSync(resolve(dir, files[0]), "utf-8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ticker = (args.ticker as string)?.toUpperCase();
  const dataStr = args.data as string;

  if (!ticker) {
    console.log(JSON.stringify({ status: "error", message: "Missing --ticker" }));
    process.exit(1);
  }

  if (!dataStr) {
    // If no data, return latest assessment
    const latest = getLatestAssessment(ticker);
    if (latest) {
      console.log(JSON.stringify({ status: "success", data: latest }));
    } else {
      console.log(
        JSON.stringify({
          status: "error",
          message: `No assessments found for ${ticker}`,
        })
      );
    }
    return;
  }

  let assessment: any;
  try {
    assessment = JSON.parse(dataStr);
  } catch {
    console.log(
      JSON.stringify({ status: "error", message: "Invalid JSON in --data" })
    );
    process.exit(1);
  }

  // Ensure required fields
  if (!assessment.ticker) assessment.ticker = ticker;
  if (!assessment.assessment_date) {
    assessment.assessment_date = new Date().toISOString().slice(0, 10);
  }

  // Add previous assessment reference
  const previous = getLatestAssessment(ticker);
  if (previous && previous.assessment_date !== assessment.assessment_date) {
    assessment.previous_assessment = {
      date: previous.assessment_date,
      base_fair_value: previous.scenarios?.base?.fair_value || null,
      verdict: previous.verdict || null,
      delta: previous.scenarios?.base?.fair_value
        ? `${(
            (assessment.scenarios?.base?.fair_value || 0) -
            previous.scenarios.base.fair_value
          ).toFixed(2)} (${(
            (((assessment.scenarios?.base?.fair_value || 0) -
              previous.scenarios.base.fair_value) /
              previous.scenarios.base.fair_value) *
            100
          ).toFixed(1)}%)`
        : null,
    };
  }

  assessment.plugin_version = "1.0.0";

  // Save
  const dir = resolve(PATHS.assessments, ticker);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filename = `${assessment.assessment_date}.json`;
  const filepath = resolve(dir, filename);
  writeFileSync(filepath, JSON.stringify(assessment, null, 2));

  console.log(
    JSON.stringify({
      status: "success",
      message: `Assessment saved: ${filepath}`,
      data: { file: filepath, ticker, date: assessment.assessment_date },
    })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
