import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import type { GithubData } from "./types";


const gunzip = promisify(zlib.gunzip);

const GITHUB_DATA_URL = process.env.GITHUB_DATA_URL;

// Simple in-memory cache to avoid re-parsing the large .gz file on every request.
let cachedData: GithubData | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

/**
 * Loads the github_data payload.
 * - Checks in-memory cache first (with 1-hour TTL).
 * - If GITHUB_DATA_URL is set: fetches + decompresses the .gz file.
 * - Otherwise, checks for a local `github_data.json.gz` in the project root.
 */
export async function loadGithubData(): Promise<GithubData> {
  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_TTL)) {
    return cachedData;
  }

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
      // File not found, ignore
    }
  }

  // If no buffer is found after trying remote and local, throw an error
  if (!buffer) {
    throw new Error("Could not load github_data.json.gz from remote URL or local file.");
  }

  let jsonBuffer: Buffer;
  try {
    jsonBuffer = await gunzip(buffer);
  } catch {
    // If not gzipped (e.g. plain JSON), use as-is
    jsonBuffer = buffer;
  }

  const raw: unknown = JSON.parse(jsonBuffer.toString("utf-8"));
  cachedData = raw as GithubData;
  lastFetchTime = now;

  return cachedData;
}
