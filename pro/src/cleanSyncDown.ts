import PQueue from "p-queue";
import type { Entity, RemotelySavePluginSettings } from "../../src/baseTypes";
import { copyFile } from "../../src/copyLogic";
import type { FakeFsEncrypt } from "../../src/fsEncrypt";
import type { FakeFsLocal } from "../../src/fsLocal";
import {
  type InternalDBs,
  clearAllPrevSyncRecordByVault,
  upsertPrevSyncRecordByVaultAndProfile,
} from "../../src/localdb";
import { getParentFolder } from "../../src/misc";
import { isMergable } from "./conflictLogic";
import {
  clearAllFileContentHistoryByVault,
  upsertFileContentHistoryByVaultAndProfile,
} from "./localdb";
import { fullfillMTimeOfRemoteEntityInplace } from "./sync";

export interface CleanSyncDownOptions {
  fsLocal: FakeFsLocal;
  fsEncrypt: FakeFsEncrypt;
  db: InternalDBs;
  vaultRandomID: string;
  profileID: string;
  configDir: string;
  settings: RemotelySavePluginSettings;
  notifyFunc?: (msg: string) => void;
  callbackProgress?: (completed: number, total: number, key: string) => void;
}

export interface CleanSyncDownResult {
  downloadedCount: number;
  totalCount: number;
  deletedLocalCount: number;
}

/**
 * Resets local vault from cloud storage (Clean Sync Down):
 * 1. Checks remote connection and password.
 * 2. Lists remote files and aborts if remote is empty.
 * 3. Safely moves existing local notes and folders into Trash (preserving .obsidian/).
 * 4. Clears local sync history database records.
 * 5. Recreates folder structure and downloads all remote files concurrently.
 * 6. Populates fresh prevSync records so subsequent syncs start clean.
 */
export async function cleanSyncDown(
  options: CleanSyncDownOptions
): Promise<CleanSyncDownResult> {
  const {
    fsLocal,
    fsEncrypt,
    db,
    vaultRandomID,
    profileID,
    configDir,
    settings,
    notifyFunc,
    callbackProgress,
  } = options;

  // 1. Check password / remote credentials
  const passwordCheckResult = await fsEncrypt.isPasswordOk();
  if (!passwordCheckResult.ok) {
    throw new Error(
      passwordCheckResult.reason || "Remote password verification failed."
    );
  }

  // 2. List remote files
  notifyFunc?.("Listing remote files...");
  const remoteEntityList = await fsEncrypt.walk();

  // Filter valid files (excluding directories and internal meta file)
  const remoteFiles = remoteEntityList.filter((e) => {
    const k = e.keyRaw;
    if (k.endsWith("/") || k === "/$@meta") {
      return false;
    }
    if (k.startsWith(`${configDir}/`) && !settings.syncConfigDir) {
      return false;
    }
    return true;
  });

  // Critical safeguard: Never wipe local vault if remote is empty!
  if (remoteFiles.length === 0) {
    throw new Error(
      "Remote storage has 0 files! Aborting Clean Sync Down to prevent accidental data loss."
    );
  }

  // 3. Safely trash existing local files and folders (NEVER delete .obsidian, .trash, or .git)
  notifyFunc?.("Safely moving local files to Trash...");
  const localEntityList = await fsLocal.walk();

  const localItemsToDelete = localEntityList.filter((e) => {
    const k = e.keyRaw;
    if (
      k === configDir ||
      k.startsWith(`${configDir}/`) ||
      k === ".trash" ||
      k.startsWith(".trash/") ||
      k === ".git" ||
      k.startsWith(".git/")
    ) {
      return false;
    }
    return true;
  });

  const localFilesToDelete = localItemsToDelete.filter(
    (e) => !e.keyRaw.endsWith("/")
  );
  // Sort folders from deepest to shallowest for clean removal
  const localFoldersToDelete = localItemsToDelete
    .filter((e) => e.keyRaw.endsWith("/"))
    .sort((a, b) => b.keyRaw.length - a.keyRaw.length);

  let deletedLocalCount = 0;
  for (const file of localFilesToDelete) {
    try {
      await fsLocal.rm(file.keyRaw);
      deletedLocalCount++;
    } catch (err) {
      console.warn(`Could not trash local file "${file.keyRaw}":`, err);
    }
  }

  for (const folder of localFoldersToDelete) {
    try {
      await fsLocal.rm(folder.keyRaw);
    } catch (err) {
      console.warn(`Could not trash local folder "${folder.keyRaw}":`, err);
    }
  }

  // 4. Clear sync history records for this vault
  notifyFunc?.("Resetting local sync database...");
  await clearAllPrevSyncRecordByVault(db, vaultRandomID);
  try {
    await clearAllFileContentHistoryByVault(db, vaultRandomID);
  } catch (err) {
    console.debug("Could not clear fileContentHistory records:", err);
  }

  // 5. Create remote folders locally (shallowest to deepest)
  notifyFunc?.("Creating local folder structure...");
  const remoteFolders = remoteEntityList
    .filter((e) => e.keyRaw.endsWith("/"))
    .sort((a, b) => a.keyRaw.length - b.keyRaw.length);

  for (const folder of remoteFolders) {
    const k = folder.keyRaw;
    if (k.startsWith(`${configDir}/`) && !settings.syncConfigDir) {
      continue;
    }
    try {
      await fsLocal.mkdir(k);
    } catch (err) {
      // folder may already exist
    }
  }

  // 6. Download remote files concurrently and register prevSync records
  notifyFunc?.(`Downloading ${remoteFiles.length} files from cloud...`);
  const concurrency = settings.concurrency ?? 5;
  const queue = new PQueue({ concurrency, autoStart: true });
  let downloadedCount = 0;
  const totalCount = remoteFiles.length;
  const errors: { key: string; error: any }[] = [];

  for (const remEntity of remoteFiles) {
    queue.add(async () => {
      const key = remEntity.keyRaw;
      const parent = getParentFolder(key);
      if (parent !== "" && parent !== "/") {
        try {
          await fsLocal.mkdir(parent);
        } catch (err) {
          // ignore
        }
      }

      try {
        const { entity, content } = await copyFile(key, fsEncrypt, fsLocal);
        const mtimeCli = entity.mtimeCli;
        fullfillMTimeOfRemoteEntityInplace(remEntity, mtimeCli);
        remEntity.key = remEntity.key ?? remEntity.keyRaw;

        await upsertPrevSyncRecordByVaultAndProfile(
          db,
          vaultRandomID,
          profileID,
          remEntity
        );

        if (
          settings.conflictAction === "smart_conflict" &&
          isMergable(remEntity) &&
          content !== undefined
        ) {
          await upsertFileContentHistoryByVaultAndProfile(
            db,
            vaultRandomID,
            profileID,
            remEntity,
            content
          );
        }

        downloadedCount++;
        callbackProgress?.(downloadedCount, totalCount, key);
      } catch (err: any) {
        console.error(`Error downloading "${key}":`, err);
        errors.push({ key, error: err });
      }
    });
  }

  await queue.onIdle();

  if (errors.length > 0) {
    throw new Error(
      `Clean sync down finished with ${errors.length} error(s) out of ${totalCount} files.`
    );
  }

  return {
    downloadedCount,
    totalCount,
    deletedLocalCount,
  };
}
