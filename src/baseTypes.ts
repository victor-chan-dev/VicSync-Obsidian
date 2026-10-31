/**
 * Only type defs here.
 * To avoid circular dependency.
 */

import type { GoogleDriveConfig } from "../pro/src/baseTypesPro";
import type { LangTypeAndAuto } from "./i18n";

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export type SUPPORTED_SERVICES_TYPE = "googledrive" | "s3";

export type SUPPORTED_SERVICES_TYPE_WITH_REMOTE_BASE_DIR = Exclude<
  SUPPORTED_SERVICES_TYPE,
  "s3"
>;

export interface S3Config {
  s3Endpoint: string;
  s3Region: string;
  s3AccessKeyID: string;
  s3SecretAccessKey: string;
  s3BucketName: string;

  partsConcurrency?: number;
  forcePathStyle?: boolean;
  remotePrefix?: string;

  useAccurateMTime?: boolean;
  reverseProxyNoSignUrl?: string;

  generateFolderObject?: boolean;

  /**
   * @deprecated
   */
  bypassCorsLocally?: boolean;
}

export type SyncDirectionType =
  | "bidirectional"
  | "incremental_pull_only"
  | "incremental_push_only"
  | "incremental_pull_and_delete_only"
  | "incremental_push_and_delete_only";

export type QRExportType = "basic_and_advanced" | SUPPORTED_SERVICES_TYPE;

export interface ProfilerConfig {
  enable?: boolean;
  enablePrinting?: boolean;
  recordSize?: boolean;
}

export interface RemotelySavePluginSettings {
  s3: S3Config;
  googledrive: GoogleDriveConfig;

  password?: string;
  serviceType: SUPPORTED_SERVICES_TYPE;
  currLogLevel?: string;
  autoRunEveryMilliseconds?: number;
  initRunAfterMilliseconds?: number;
  syncOnSaveAfterMilliseconds?: number;

  concurrency?: number;
  syncConfigDir?: boolean;
  syncBookmarks?: boolean;
  syncUnderscoreItems?: boolean;
  lang?: LangTypeAndAuto;
  agreeToUseSyncV3?: boolean;
  skipSizeLargerThan?: number;
  ignorePaths?: string[];
  onlyAllowPaths?: string[];
  enableStatusBarInfo?: boolean;
  deleteToWhere?: "system" | "obsidian";
  conflictAction?: ConflictActionType;

  protectModifyPercentage?: number;
  syncDirection?: SyncDirectionType;

  enableMobileStatusBar?: boolean;

  profiler?: ProfilerConfig;

  /**
   * @deprecated
   */
  vaultRandomID?: string;

  /**
   * @deprecated
   */
  logToDB?: boolean;

  /**
   * @deprecated
   */
  howToCleanEmptyFolder?: EmptyFolderCleanType;
}

export const COMMAND_URI = "vicsync";
export const COMMAND_CALLBACK = "remotely-save-cb";

export interface UriParams {
  func?: string;
  vault?: string;
  ver?: string;
  data?: string;
}

export type EmptyFolderCleanType = "skip" | "clean_both";

export type ConflictActionType =
  | "keep_newer"
  | "keep_larger"
  | "smart_conflict";

export type DecisionTypeForMixedEntity =
  | "only_history"
  | "equal"
  | "local_is_modified_then_push"
  | "remote_is_modified_then_pull"
  | "local_is_created_then_push"
  | "remote_is_created_then_pull"
  | "local_is_created_too_large_then_do_nothing"
  | "remote_is_created_too_large_then_do_nothing"
  | "local_is_deleted_thus_also_delete_remote"
  | "remote_is_deleted_thus_also_delete_local"
  | "remote_is_moved_source"
  | "remote_is_moved_then_rename_local"
  | "conflict_created_then_keep_local"
  | "conflict_created_then_keep_remote"
  | "conflict_created_then_smart_conflict"
  | "conflict_created_then_do_nothing"
  | "conflict_modified_then_keep_local"
  | "conflict_modified_then_keep_remote"
  | "conflict_modified_then_smart_conflict"
  | "folder_existed_both_then_do_nothing"
  | "folder_existed_local_then_also_create_remote"
  | "folder_existed_remote_then_also_create_local"
  | "folder_to_be_created"
  | "folder_to_skip"
  | "folder_to_be_deleted_on_both"
  | "folder_to_be_deleted_on_remote"
  | "folder_to_be_deleted_on_local";

/**
 * uniform representation
 * everything should be flat and primitive, so that we can copy.
 */
export interface Entity {
  id?: string;
  key?: string;
  keyEnc?: string;
  keyRaw: string;
  mtimeCli?: number;
  mtimeCliFmt?: string;
  ctimeCli?: number;
  ctimeCliFmt?: string;
  mtimeSvr?: number;
  mtimeSvrFmt?: string;
  prevSyncTime?: number;
  prevSyncTimeFmt?: string;
  size?: number; // might be unknown or to be filled
  sizeEnc?: number;
  sizeRaw: number;
  hash?: string;
  etag?: string;
  synthesizedFolder?: boolean;
  synthesizedFile?: boolean;
}

export interface UploadedType {
  entity: Entity;
  mtimeCli?: number;
}

export interface MixedEntity {
  key: string;
  local?: Entity;
  prevSync?: Entity;
  remote?: Entity;

  decisionBranch?: number;
  decision?: DecisionTypeForMixedEntity;
  conflictAction?: ConflictActionType;

  change?: boolean;

  sideNotes?: any;
  moveSourceKey?: string;
  moveTargetKey?: string;
}

export const DEFAULT_DEBUG_FOLDER = "_debug_remotely_save/";
export const DEFAULT_DEBUG_LOG_FILE = "_vicsync_debug.md";
export const DEFAULT_SYNC_PLANS_HISTORY_FILE_PREFIX =
  "sync_plans_hist_exported_on_";
export const DEFAULT_LOG_HISTORY_FILE_PREFIX = "log_hist_exported_on_";
export const DEFAULT_PROFILER_RESULT_FILE_PREFIX =
  "profiler_results_exported_on_";

export type SyncTriggerSourceType =
  | "manual"
  | "dry"
  | "auto"
  | "auto_once_init"
  | "auto_sync_on_save";

export const REMOTELY_SAVE_VERSION_2022 = "0.3.25";
export const REMOTELY_SAVE_VERSION_2024PREPARE = "0.3.32";
