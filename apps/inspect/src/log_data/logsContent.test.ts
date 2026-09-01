/**
 * Tests for the logsContent IndexedDB + cache seam (fake-indexeddb, like
 * database.test.ts).
 */
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Log } from "../client/api/types";
import { DB_NAME } from "../client/database/schema";
import {
  createDatabaseService,
  DatabaseService,
} from "../client/database/service";
import { queryClient } from "../state/queryClient";

import {
  clearFile,
  logKey,
  mergeFetchStates,
  setRows,
  writeListing,
  writePreviews,
} from "./logsContent";

const invalidateListings = vi.hoisted(() => vi.fn());
vi.mock("./databaseListings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./databaseListings")>()),
  invalidateDatabaseLogsListings: invalidateListings,
}));

describe("writeListing", () => {
  let db: DatabaseService;

  beforeEach(async () => {
    db = createDatabaseService();
    await db.openDatabase();
  });

  afterEach(async () => {
    queryClient.clear();
    await db.closeDatabase();
    await Dexie.delete(DB_NAME);
  });

  test("persists and reads back rows in the dir's namespace", async () => {
    const rows = await writeListing(db, "file:///logs", [
      { name: "file:///logs/a.eval" },
    ]);

    expect(rows.map((row) => row.name)).toEqual(["file:///logs/a.eval"]);
    expect(await db.readLogs({ prefix: "file:///logs" })).toHaveLength(1);
    expect((await db.getSyncScope("file:///logs"))?.last_synced).toBeDefined();
  });

  test("degrades to cache-only when names are outside the dir's namespace", async () => {
    // An older view server: aliased-path log_dir, file:// URI names.
    const rows = await writeListing(db, "~/logs", [
      { name: "file:///home/me/logs/a.eval" },
    ]);

    // The listing still lands (cache) instead of being blanked by an empty
    // scoped read-back...
    expect(rows.map((row) => row.name)).toEqual([
      "file:///home/me/logs/a.eval",
    ]);
    // ...and nothing was persisted where no scoped read could reach it.
    expect(await db.readLogs({ prefix: "~/logs" })).toHaveLength(0);
    expect(await db.getSyncScope("~/logs")).toBeUndefined();
  });
});

describe("db-less write invalidation", () => {
  // Listing queries in db-less sessions read from the react-query cache and
  // only refetch on invalidation — so every cache-updating write must fire
  // it, not just the persisted ones.
  beforeEach(() => {
    invalidateListings.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  test("a db-less preview merge refreshes the listings", async () => {
    await writePreviews(null, "/plain/logs", {});
    expect(invalidateListings).toHaveBeenCalled();
  });

  test("a db-less file clear refreshes the listings", async () => {
    await clearFile(null, "/plain/logs", "/plain/logs/a.eval");
    expect(invalidateListings).toHaveBeenCalled();
  });
});

describe("observed log entries", () => {
  const logDir = "/plain/logs";
  const row: Log = {
    name: "/plain/logs/a.eval",
    depth: "listed",
    preview_attempts: 0,
    details_attempts: 0,
    details_settled_seq: 0,
  };

  afterEach(() => {
    queryClient.clear();
  });

  test("refreshes observed entity entries without materializing unobserved rows", () => {
    setRows(logDir, [row]);
    expect(queryClient.getQueryData(logKey(logDir, row.name))).toBeUndefined();

    queryClient.setQueryData(logKey(logDir, row.name), row);
    setRows(logDir, [{ ...row, task: "updated" }]);

    expect(queryClient.getQueryData<Log>(logKey(logDir, row.name))?.task).toBe(
      "updated"
    );
  });

  test("merges fetch state into an observed entity entry", () => {
    setRows(logDir, [row]);
    queryClient.setQueryData(logKey(logDir, row.name), row);

    mergeFetchStates(logDir, {
      [row.name]: {
        preview_attempts: 1,
        details_attempts: 0,
        details_settled_seq: 0,
      },
    });

    expect(
      queryClient.getQueryData<Log>(logKey(logDir, row.name))?.preview_attempts
    ).toBe(1);
  });
});
