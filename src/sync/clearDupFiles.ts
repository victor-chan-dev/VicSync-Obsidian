import type { FakeFsLocal } from "../storage/fsLocal";
import { getFileRenameForDup } from "./conflictLogic";

/**
 * Matches Google Drive duplicate suffixes such as "Note (1).md" or "Photo (2).png",
 * returning the base path ("Note.md", "Photo.png") if matched.
 */
export const getGoogleDriveDupBaseKey = (keyRaw: string): string | undefined => {
  const match = keyRaw.match(/^(.*?) \(\d+\)(\.[^./]+)?$/);
  if (!match) {
    return undefined;
  }
  const prefix = match[1];
  const ext = match[2] ?? "";
  return `${prefix}${ext}`;
};

export const getDupFiles = async (fsLocal: FakeFsLocal) => {
  const allFilesAndFolders = await fsLocal.walk();

  allFilesAndFolders.sort((a, b) => -(a.keyRaw.length - b.keyRaw.length)); // descending

  const allFilesSet: Set<string> = new Set();
  const filenameSet: Set<string> = new Set();
  const filesToBeRemoved: Set<string> = new Set();

  for (const { keyRaw } of allFilesAndFolders) {
    if (keyRaw.endsWith("/")) {
      continue;
    }
    allFilesSet.add(keyRaw);
    if (keyRaw.includes("dup")) {
      filenameSet.add(keyRaw);
    }

    const dup = getFileRenameForDup(keyRaw);
    if (filenameSet.has(dup)) {
      filesToBeRemoved.add(dup);
    }
  }

  for (const keyRaw of allFilesSet) {
    const baseKey = getGoogleDriveDupBaseKey(keyRaw);
    if (baseKey !== undefined && allFilesSet.has(baseKey)) {
      filesToBeRemoved.add(keyRaw);
    }
  }

  return [...filesToBeRemoved].sort();
};

export const clearDupFiles = async (
  filesToBeRemoved: string[],
  fsLocal: FakeFsLocal
) => {
  await Promise.all(filesToBeRemoved.map(async (f) => await fsLocal.rm(f)));
};
