import zlib from "zlib";
import { promisify } from "util";
import type { GithubData } from "./types";
import { getMockData } from "./mock-data";

const gunzip = promisify(zlib.gunzip);

const GITHUB_DATA_URL = process.env.GITHUB_DATA_URL;

/**
 * Loads the github_data payload.
 * - In production (GITHUB_DATA_URL set): fetches + decompresses the .gz file.
 * - In development / testing: returns mock data instantly.
 *
 * The Next.js `revalidate` export on each route handler controls ISR caching.
 */
export async function loadGithubData(): Promise<GithubData> {
  if (!GITHUB_DATA_URL) {
    // Dev / test mode — use mock dataset
    return getMockData();
  }

  const res = await fetch(GITHUB_DATA_URL, {
    // ISR: revalidate once per day (86400 s). Individual routes also export `revalidate`.
    next: { revalidate: 86400 },
  } as RequestInit & { next: { revalidate: number } });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch github data: ${res.status} ${res.statusText}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let jsonBuffer: Buffer;
  try {
    jsonBuffer = await gunzip(buffer);
  } catch {
    // If not gzipped (e.g. plain JSON in dev deployments), use as-is
    jsonBuffer = buffer;
  }

  const raw: unknown = JSON.parse(jsonBuffer.toString("utf-8"));
  // Trust the pipeline output shape (validated by pipeline's own schema)
  return raw as GithubData;
}
