import type { Vault } from "obsidian";

import type { SyncPlanType } from "../sync/sync";
import {
  DEFAULT_DEBUG_FOLDER,
  DEFAULT_DEBUG_LOG_FILE,
  DEFAULT_PROFILER_RESULT_FILE_PREFIX,
  DEFAULT_SYNC_PLANS_HISTORY_FILE_PREFIX,
} from "../baseTypes";
import {
  readAllProfilerResultsByVault,
  readAllSyncPlanRecordTextsByVault,
} from "./localdb";
import type { InternalDBs } from "./localdb";
import { mkdirpInVault, unixTimeToStr } from "./misc";

export interface DebugLogEntry {
  level?: "ERROR" | "WARN" | "INFO";
  context: string;
  version?: string;
  serviceType?: string;
  triggerSource?: string;
  syncDirection?: string;
  error?: unknown;
  message?: string;
}

const DEBUG_LOG_HEADER = `# VicSync Debug Log

> Auto-generated local debug log (\`${DEFAULT_DEBUG_LOG_FILE}\`). Automatically ignored by cloud sync. Newest entries appear first.

`;

const ENTRY_SEPARATOR = "\n<!-- VICSYNC_LOG_ENTRY -->\n";
const MAX_DEBUG_ENTRIES = 50;

export const formatDebugLogEntry = (
  entry: DebugLogEntry,
  nowMs: number = Date.now()
): string => {
  const level = entry.level ?? "ERROR";
  const tsStr = unixTimeToStr(nowMs);
  const metaLines: string[] = [];
  if (entry.version) {
    metaLines.push(`- **Version**: \`${entry.version}\``);
  }
  if (entry.serviceType) {
    metaLines.push(`- **Service**: \`${entry.serviceType}\``);
  }
  if (entry.triggerSource) {
    const dir = entry.syncDirection ? ` (\`${entry.syncDirection}\`)` : "";
    metaLines.push(`- **Trigger**: \`${entry.triggerSource}\`${dir}`);
  }

  const messages: string[] = [];
  const stacks: string[] = [];

  if (entry.message) {
    messages.push(entry.message);
  }

  const extractErr = (err: unknown) => {
    if (!err) return;
    if (typeof AggregateError !== "undefined" && err instanceof AggregateError) {
      for (const sub of err.errors) {
        extractErr(sub);
      }
      return;
    }
    if (err instanceof Error) {
      messages.push(err.message);
      if (err.stack) {
        stacks.push(err.stack);
      }
    } else if (typeof err === "string") {
      messages.push(err);
    } else {
      try {
        messages.push(JSON.stringify(err, null, 2));
      } catch {
        messages.push(String(err));
      }
    }
  };

  extractErr(entry.error);

  const messageText =
    messages.length > 0 ? messages.join("\n\n") : "Unknown error";

  let block = `## [${tsStr}] ${level} — ${entry.context}\n`;
  if (metaLines.length > 0) {
    block += `${metaLines.join("\n")}\n`;
  }
  block += `- **Message**:\n\`\`\`text\n${messageText}\n\`\`\`\n`;
  if (stacks.length > 0) {
    block += `- **Stack**:\n\`\`\`text\n${stacks.join("\n\n")}\n\`\`\`\n`;
  }
  block += `---`;
  return block;
};

export const appendDebugLogToVault = async (
  vault: Vault,
  entry: DebugLogEntry
): Promise<void> => {
  try {
    const nowMs = Date.now();
    const newEntryBlock = formatDebugLogEntry(entry, nowMs);

    let existingEntries: string[] = [];
    const exists = await vault.adapter.exists(DEFAULT_DEBUG_LOG_FILE);
    if (exists) {
      const currentContent = await vault.adapter.read(DEFAULT_DEBUG_LOG_FILE);
      const parts = currentContent.split(ENTRY_SEPARATOR);
      if (parts.length > 1) {
        existingEntries = parts.slice(1).map((p) => p.trim()).filter(Boolean);
      }
    }

    const combinedEntries = [newEntryBlock, ...existingEntries].slice(
      0,
      MAX_DEBUG_ENTRIES
    );
    const updatedContent =
      DEBUG_LOG_HEADER +
      ENTRY_SEPARATOR +
      combinedEntries.join(ENTRY_SEPARATOR) +
      "\n";

    await vault.adapter.write(DEFAULT_DEBUG_LOG_FILE, updatedContent);
  } catch (writeErr) {
    console.error("Failed to write to local debug log file:", writeErr);
  }
};

const getSubsetOfSyncPlan = (x: string, onlyChange: boolean) => {
  if (!onlyChange) {
    return x;
  }
  const y: SyncPlanType = JSON.parse(x);
  const z: SyncPlanType = Object.fromEntries(
    Object.entries(y).filter(([key, val]) => {
      if (key === "/$@meta") {
        return true;
      }
      return val.change === undefined || val.change === true;
    })
  );
  return JSON.stringify(z, null, 2);
};

export const exportVaultSyncPlansToFiles = async (
  db: InternalDBs,
  vault: Vault,
  vaultRandomID: string,
  howMany: number,
  onlyChange: boolean
) => {
  console.info("exporting sync plans");
  await mkdirpInVault(DEFAULT_DEBUG_FOLDER, vault);
  const records = await readAllSyncPlanRecordTextsByVault(db, vaultRandomID);
  let md = "";
  if (records.length === 0) {
    md = "No sync plans history found";
  } else {
    if (howMany <= 0) {
      md =
        "Sync plans found:\n\n" +
        records
          .map(
            (x) => "```json\n" + getSubsetOfSyncPlan(x, onlyChange) + "\n```\n"
          )
          .join("\n");
    } else {
      md =
        "Sync plans found:\n\n" +
        records
          .map(
            (x) => "```json\n" + getSubsetOfSyncPlan(x, onlyChange) + "\n```\n"
          )
          .slice(0, howMany)
          .join("\n");
    }
  }
  const ts = Date.now();
  const filePath = `${DEFAULT_DEBUG_FOLDER}${DEFAULT_SYNC_PLANS_HISTORY_FILE_PREFIX}${ts}.md`;
  await vault.create(filePath, md, {
    mtime: ts,
  });
  console.info("finish exporting sync plans");
};

export const exportVaultProfilerResultsToFiles = async (
  db: InternalDBs,
  vault: Vault,
  vaultRandomID: string
) => {
  console.info("exporting profiler results");
  await mkdirpInVault(DEFAULT_DEBUG_FOLDER, vault);
  const records = await readAllProfilerResultsByVault(db, vaultRandomID);
  let md = "";
  if (records.length === 0) {
    md = "No profiler results found";
  } else {
    md =
      "Profiler results found:\n\n" +
      records.map((x) => "```\n" + x + "\n```\n").join("\n");
  }
  const ts = Date.now();
  const filePath = `${DEFAULT_DEBUG_FOLDER}${DEFAULT_PROFILER_RESULT_FILE_PREFIX}${ts}.md`;
  await vault.create(filePath, md, {
    mtime: ts,
  });
  console.info("finish exporting profiler results");
};
