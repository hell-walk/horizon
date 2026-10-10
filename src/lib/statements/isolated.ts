import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

import { logError } from "../server/log";
import { readStatementRows, StatementParseError, StatementPasswordError, type Cell } from "./parse";
import type { WorkerReply, WorkerRequest } from "./parse-worker";

// Uploaded statements are read in a disposable worker thread, not in the web
// server itself. If a crafted file finds a bug in a PDF or Excel library, the
// worst it can do is exhaust its own capped memory or time, and the worker is
// thrown away. The worker gets an empty environment, so there are no secrets
// in it to steal.

export const WORKER_FILE = join(process.cwd(), ".worker", "parse-worker.mjs");

export type Isolation = { memoryMb: number; timeoutMs: number };
export const DEFAULT_ISOLATION: Isolation = { memoryMb: 384, timeoutMs: 30_000 };

export class WorkerLimitError extends StatementParseError {}

/** Runs one job in a fresh worker with a memory cap and a time limit; the worker never outlives the job. */
export function runInWorker<T>(file: string, payload: unknown, { memoryMb, timeoutMs }: Isolation, transfer: ArrayBuffer[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(file, {
      env: { NODE_ENV: process.env.NODE_ENV ?? "production" }, // nothing else: no keys, no secrets
      resourceLimits: { maxOldGenerationSizeMb: memoryMb, maxYoungGenerationSizeMb: Math.min(64, memoryMb / 4) },
      stdout: true,
      stderr: true, // a library's chatter must not reach the server log
    });
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeAllListeners();
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new WorkerLimitError("This file took too long to read. Export a shorter date range and try again."))), timeoutMs);
    worker.once("message", (reply: T) => finish(() => resolve(reply)));
    worker.once("error", (error: Error & { code?: string }) =>
      finish(() =>
        reject(
          error.code === "ERR_WORKER_OUT_OF_MEMORY"
            ? new WorkerLimitError("This file is too large to read. Export a shorter date range and try again.")
            : error
        )
      )
    );
    worker.once("exit", (code) => finish(() => reject(new StatementParseError(`This file could not be read (reader stopped, code ${code}).`))));
    worker.postMessage(payload, transfer);
  });
}

/** readStatementRows, run in the isolated worker when it has been built. */
export async function readStatementRowsIsolated(input: { name: string; buffer: Buffer; password?: string }, isolation = DEFAULT_ISOLATION): Promise<Cell[][]> {
  if (!existsSync(WORKER_FILE)) {
    // `npm run build` / `npm run dev` build the worker first; without it, read in-process rather than fail.
    logError("statement: parse worker not built, reading in-process (run npm run build:worker)");
    return readStatementRows(input);
  }
  const bytes = new Uint8Array(input.buffer); // a copy the worker can own
  const request: WorkerRequest = { name: input.name, buffer: bytes, password: input.password };
  const reply = await runInWorker<WorkerReply>(WORKER_FILE, request, isolation, [bytes.buffer as ArrayBuffer]);
  if (reply.ok) return reply.rows as Cell[][];
  if (reply.kind === "password") throw new StatementPasswordError(reply.message, reply.wrongPassword);
  if (reply.kind === "parse") throw new StatementParseError(reply.message);
  throw new StatementParseError("This file could not be read. It may be damaged or not a bank statement. Download it again from your bank and retry.");
}
