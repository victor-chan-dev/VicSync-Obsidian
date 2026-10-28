import { strict as assert } from "assert";
import type { Entity, RemotelySavePluginSettings } from "../../src/baseTypes";
import { cleanSyncDown } from "../src/cleanSyncDown";

describe("CleanSyncDown", () => {
  const createMockDb = () => {
    const prevSyncMap = new Map<string, any>();
    const fileContentMap = new Map<string, any>();

    return {
      prevSyncRecordsTbl: {
        getItem: async (k: string) => prevSyncMap.get(k),
        setItem: async (k: string, v: any) => prevSyncMap.set(k, v),
        removeItem: async (k: string) => prevSyncMap.delete(k),
        keys: async () => Array.from(prevSyncMap.keys()),
        removeItems: async (keys: string[]) => {
          for (const k of keys) prevSyncMap.delete(k);
        },
      },
      fileContentHistoryTbl: {
        getItem: async (k: string) => fileContentMap.get(k),
        setItem: async (k: string, v: any) => fileContentMap.set(k, v),
        removeItem: async (k: string) => fileContentMap.delete(k),
        keys: async () => Array.from(fileContentMap.keys()),
        removeItems: async (keys: string[]) => {
          for (const k of keys) fileContentMap.delete(k);
        },
      },
      _maps: { prevSyncMap, fileContentMap },
    } as any;
  };

  const createMockFs = (initialEntities: Entity[]) => {
    const files = new Map<string, ArrayBuffer>();
    const removed: string[] = [];
    const createdDirs: string[] = [];

    for (const e of initialEntities) {
      if (!e.keyRaw.endsWith("/")) {
        const buf = new TextEncoder().encode("content of " + e.keyRaw).buffer;
        files.set(e.keyRaw, buf);
        e.size = buf.byteLength;
      }
    }

    return {
      isPasswordOk: async () => ({ ok: true }),
      walk: async () => initialEntities,
      stat: async (key: string) => {
        const found = initialEntities.find((e) => e.keyRaw === key);
        if (found) return found;
        return {
          keyRaw: key,
          size: files.get(key)?.byteLength ?? 0,
          mtimeCli: 1000,
        };
      },
      readFile: async (key: string) => {
        return files.get(key) ?? new ArrayBuffer(0);
      },
      writeFile: async (key: string, content: ArrayBuffer, mtime: number) => {
        files.set(key, content);
        return {
          keyRaw: key,
          size: content.byteLength,
          mtimeCli: mtime,
        };
      },
      mkdir: async (key: string) => {
        createdDirs.push(key);
        return { keyRaw: key };
      },
      rm: async (key: string) => {
        removed.push(key);
        files.delete(key);
      },
      _removed: removed,
      _createdDirs: createdDirs,
      _files: files,
    } as any;
  };

  it("should abort if remote has 0 files (safety guardrail)", async () => {
    const mockDb = createMockDb();
    const mockLocal = createMockFs([
      { keyRaw: "Note.md", size: 100, mtimeCli: 1000 },
    ]);
    const mockRemote = createMockFs([]); // 0 files!

    await assert.rejects(
      async () => {
        await cleanSyncDown({
          fsLocal: mockLocal,
          fsEncrypt: mockRemote,
          db: mockDb,
          vaultRandomID: "vault-1",
          profileID: "profile-1",
          configDir: ".obsidian",
          settings: { concurrency: 2 } as RemotelySavePluginSettings,
        });
      },
      {
        message: /Remote storage has 0 files! Aborting Clean Sync Down/,
      }
    );

    // Verify local was NOT touched
    assert.equal(mockLocal._removed.length, 0);
  });

  it("should preserve .obsidian, .trash, and .git while trashing user notes", async () => {
    const mockDb = createMockDb();
    const localEntities: Entity[] = [
      { keyRaw: ".obsidian/app.json", size: 50, mtimeCli: 1000 },
      { keyRaw: ".obsidian/plugins/vicsync/main.js", size: 500, mtimeCli: 1000 },
      { keyRaw: ".trash/old_deleted_note.md", size: 20, mtimeCli: 1000 },
      { keyRaw: ".git/config", size: 10, mtimeCli: 1000 },
      { keyRaw: "MyFolder/Note1.md", size: 100, mtimeCli: 1000 },
      { keyRaw: "MyFolder/", mtimeCli: 1000 },
      { keyRaw: "RootNote.md", size: 200, mtimeCli: 1000 },
    ];

    const remoteEntities: Entity[] = [
      { keyRaw: "CleanCloud/RemoteDoc.md", size: 300, mtimeCli: 2000 },
      { keyRaw: "CleanCloud/", mtimeCli: 2000 },
    ];

    const mockLocal = createMockFs(localEntities);
    const mockRemote = createMockFs(remoteEntities);

    // Pre-populate old sync records to verify they get wiped
    await mockDb.prevSyncRecordsTbl.setItem("vault-1\tprofile-1\tOldNote.md", { keyRaw: "OldNote.md" });

    const result = await cleanSyncDown({
      fsLocal: mockLocal,
      fsEncrypt: mockRemote,
      db: mockDb,
      vaultRandomID: "vault-1",
      profileID: "profile-1",
      configDir: ".obsidian",
      settings: { concurrency: 2, syncConfigDir: false } as RemotelySavePluginSettings,
    });

    // 1. Check which files were removed from local
    assert.ok(mockLocal._removed.includes("MyFolder/Note1.md"));
    assert.ok(mockLocal._removed.includes("RootNote.md"));
    assert.ok(mockLocal._removed.includes("MyFolder/"));

    // 2. Check protected files were NOT touched
    assert.ok(!mockLocal._removed.includes(".obsidian/app.json"));
    assert.ok(!mockLocal._removed.includes(".obsidian/plugins/vicsync/main.js"));
    assert.ok(!mockLocal._removed.includes(".trash/old_deleted_note.md"));
    assert.ok(!mockLocal._removed.includes(".git/config"));

    // 3. Check remote files were downloaded
    assert.ok(mockLocal._files.has("CleanCloud/RemoteDoc.md"));
    assert.equal(result.downloadedCount, 1);
    assert.equal(result.deletedLocalCount, 2); // 2 files + 1 folder removed

    // 4. Check database sync record is fresh
    assert.equal(await mockDb.prevSyncRecordsTbl.getItem("vault-1\tprofile-1\tOldNote.md"), undefined);
    assert.ok(await mockDb.prevSyncRecordsTbl.getItem("vault-1\tprofile-1\tCleanCloud/RemoteDoc.md") !== undefined);
  });
});
