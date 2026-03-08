import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import type { GithubData } from "./types";
import { getMockData } from "./mock-data";

const gunzip = promisify(zlib.gunzip);

const GITHUB_DATA_URL = process.env.GITHUB_DATA_URL;

/**
 * Loads the github_data payload.
 * - If GITHUB_DATA_URL is set: fetches + decompresses the .gz file.
 * - Otherwise, checks for a local `github_data.json.gz` in the project root.
 * - Falls back to mock data if neither is available.
 *
 * The Next.js `revalidate` export on each route handler controls ISR caching.
 */
export async function loadGithubData(): Promise<GithubData> {
  let buffer: Buffer | null = null;

  // 1. Try Remote URL
  if (GITHUB_DATA_URL) {
    try {
      const res = await fetch(GITHUB_DATA_URL, {
        // ISR: revalidate once per day (86400 s).
        next: { revalidate: 86400 },
      } as RequestInit & { next: { revalidate: number } });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        console.log(`Backend: Loaded data from remote URL: ${GITHUB_DATA_URL}`);
      }
    } catch (err) {
      console.error(`Backend: Failed to fetch from remote URL: ${err}`);
    }
  }

  // 2. Try Local File (relative to backend root: ../github_data.json.gz)
  if (!buffer) {
    const localPath = path.join(process.cwd(), "..", "github_data.json.gz");
    try {
      buffer = await fs.readFile(localPath);
      console.log(`Backend: Loading data from local file at ${localPath}`);
    } catch (err) {
      // File not found, ignore and continue to mock
    }
  }

  // 3. Fallback to Mock Data
  if (!buffer) {
    console.log("Backend: No remote URL or local file found. Using mock data.");
    return getMockData();
  }

  let jsonBuffer: Buffer;
  try {
    jsonBuffer = await gunzip(buffer);
  } catch {
    // If not gzipped (e.g. plain JSON), use as-is
    jsonBuffer = buffer;
  }

  const raw: unknown = JSON.parse(jsonBuffer.toString("utf-8"));
  // Trust the pipeline output shape (validated by pipeline's own schema)
  return raw as GithubData;
}
