// Entry point of the statement-reading worker. Built on its own by
// scripts/build-parse-worker.mjs and run by isolated.ts in a worker thread with
// a memory cap, a time limit and an empty environment (no secrets).
import { parentPort } from "node:worker_threads";

import { readStatementRows, StatementParseError, StatementPasswordError } from "./parse";

export type WorkerRequest = { name: string; buffer: Uint8Array; password?: string };
export type WorkerReply =
  | { ok: true; rows: unknown[][] }
  | { ok: false; kind: "parse" | "password" | "other"; message: string; wrongPassword?: boolean };

parentPort?.once("message", async ({ name, buffer, password }: WorkerRequest) => {
  let reply: WorkerReply;
  try {
    const rows = await readStatementRows({ name, buffer: Buffer.from(buffer), password });
    reply = { ok: true, rows };
  } catch (error) {
    if (error instanceof StatementPasswordError) reply = { ok: false, kind: "password", message: error.message, wrongPassword: error.wrongPassword };
    else if (error instanceof StatementParseError) reply = { ok: false, kind: "parse", message: error.message };
    else reply = { ok: false, kind: "other", message: "unexpected error" };
  }
  parentPort?.postMessage(reply);
});
