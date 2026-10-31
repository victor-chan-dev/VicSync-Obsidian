import { type App, Modal, Setting } from "obsidian";
import type { MixedEntity } from "../baseTypes";

export interface SyncPlanSummary {
  pushed: MixedEntity[];
  pulled: MixedEntity[];
  movedLocalToRemote: MixedEntity[];
  movedRemoteToLocal: MixedEntity[];
  deletedRemote: MixedEntity[];
  deletedLocal: MixedEntity[];
  conflicts: MixedEntity[];
  unchangedCount: number;
  totalActionCount: number;
  shortSummary: string;
  meta?: Record<string, any>;
}

export const summarizeSyncPlan = (
  mixedEntityMappings: Record<string, MixedEntity> | undefined
): SyncPlanSummary => {
  const pushed: MixedEntity[] = [];
  const pulled: MixedEntity[] = [];
  const movedLocalToRemote: MixedEntity[] = [];
  const movedRemoteToLocal: MixedEntity[] = [];
  const deletedRemote: MixedEntity[] = [];
  const deletedLocal: MixedEntity[] = [];
  const conflicts: MixedEntity[] = [];
  let unchangedCount = 0;

  if (!mixedEntityMappings) {
    return {
      pushed,
      pulled,
      movedLocalToRemote,
      movedRemoteToLocal,
      deletedRemote,
      deletedLocal,
      conflicts,
      unchangedCount: 0,
      totalActionCount: 0,
      shortSummary: "No sync plan data",
    };
  }

  const meta = mixedEntityMappings["/$@meta"]?.sideNotes;

  for (const key of Object.keys(mixedEntityMappings).sort()) {
    if (key === "/$@meta" || key.endsWith("/")) {
      continue;
    }
    const entry = mixedEntityMappings[key];
    const d = entry.decision;
    if (!d) continue;

    switch (d) {
      case "local_is_created_then_push":
      case "local_is_modified_then_push":
        pushed.push(entry);
        break;
      case "remote_is_created_then_pull":
      case "remote_is_modified_then_pull":
        pulled.push(entry);
        break;
      case "local_is_moved_then_rename_remote":
        movedLocalToRemote.push(entry);
        break;
      case "remote_is_moved_then_rename_local":
        movedRemoteToLocal.push(entry);
        break;
      case "local_is_deleted_thus_also_delete_remote":
        deletedRemote.push(entry);
        break;
      case "remote_is_deleted_thus_also_delete_local":
        deletedLocal.push(entry);
        break;
      case "conflict_created_then_keep_local":
      case "conflict_created_then_keep_remote":
      case "conflict_created_then_smart_conflict":
      case "conflict_modified_then_keep_local":
      case "conflict_modified_then_keep_remote":
      case "conflict_modified_then_smart_conflict":
        conflicts.push(entry);
        break;
      case "equal":
        unchangedCount += 1;
        break;
      default:
        break;
    }
  }

  const moveCount = movedLocalToRemote.length + movedRemoteToLocal.length;
  const delCount = deletedRemote.length + deletedLocal.length;
  const totalActionCount =
    pushed.length +
    pulled.length +
    moveCount +
    delCount +
    conflicts.length;

  const parts: string[] = [];
  if (pushed.length > 0) parts.push(`↑${pushed.length} pushed`);
  if (pulled.length > 0) parts.push(`↓${pulled.length} pulled`);
  if (moveCount > 0) parts.push(`↔${moveCount} moved`);
  if (delCount > 0) parts.push(`✕${delCount} deleted`);
  if (conflicts.length > 0) parts.push(`⚡${conflicts.length} merged`);

  const shortSummary =
    parts.length > 0
      ? parts.join(", ")
      : `All ${unchangedCount} files up to date`;

  return {
    pushed,
    pulled,
    movedLocalToRemote,
    movedRemoteToLocal,
    deletedRemote,
    deletedLocal,
    conflicts,
    unchangedCount,
    totalActionCount,
    shortSummary,
    meta,
  };
};

export class SyncPlanPreviewModal extends Modal {
  readonly summary: SyncPlanSummary;
  readonly isDryRun: boolean;
  readonly onExecuteSync?: () => Promise<void>;

  constructor(
    app: App,
    mixedEntityMappings: Record<string, MixedEntity> | undefined,
    isDryRun: boolean,
    onExecuteSync?: () => Promise<void>
  ) {
    super(app);
    this.summary = summarizeSyncPlan(mixedEntityMappings);
    this.isDryRun = isDryRun;
    this.onExecuteSync = onExecuteSync;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", {
      text: this.isDryRun
        ? "VicSync — Dry-Run Preview"
        : "VicSync — Last Sync Summary",
    });

    if (this.summary.meta) {
      const metaEl = contentEl.createEl("p", {
        cls: "setting-item-description",
      });
      const timeStr = this.summary.meta.generateTimeFmt ?? "";
      const serviceStr = this.summary.meta.service ?? "googledrive";
      const dirStr = this.summary.meta.syncDirection ?? "bidirectional";
      metaEl.setText(
        `Service: ${serviceStr} | Direction: ${dirStr}${timeStr ? ` | Time: ${timeStr}` : ""}`
      );
    }

    const bannerEl = contentEl.createDiv();
    bannerEl.style.padding = "10px 12px";
    bannerEl.style.marginBottom = "12px";
    bannerEl.style.borderRadius = "6px";
    bannerEl.style.backgroundColor = "var(--background-secondary)";
    bannerEl.createEl("strong", {
      text: `${this.summary.shortSummary} (${this.summary.unchangedCount} unchanged)`,
    });

    const renderSection = (
      title: string,
      items: MixedEntity[],
      formatter: (item: MixedEntity) => string
    ) => {
      if (items.length === 0) return;
      const section = contentEl.createDiv();
      section.style.marginBottom = "12px";
      section.createEl("h4", {
        text: `${title} (${items.length})`,
      });
      const ul = section.createEl("ul");
      ul.style.maxHeight = "180px";
      ul.style.overflowY = "auto";
      ul.style.paddingLeft = "20px";
      for (const item of items) {
        const li = ul.createEl("li");
        li.createEl("code", { text: formatter(item) });
      }
    };

    renderSection(
      "↑ Push to Cloud",
      this.summary.pushed,
      (item) =>
        `${item.key} (${item.decision === "local_is_created_then_push" ? "new" : "modified"})`
    );

    renderSection(
      "↓ Pull from Cloud",
      this.summary.pulled,
      (item) =>
        `${item.key} (${item.decision === "remote_is_created_then_pull" ? "new" : "modified"})`
    );

    renderSection(
      "↔ Moved Locally (Rename on Cloud)",
      this.summary.movedLocalToRemote,
      (item) => `${item.moveSourceKey} → ${item.key}`
    );

    renderSection(
      "↔ Moved on Cloud (Rename Locally)",
      this.summary.movedRemoteToLocal,
      (item) => `${item.moveSourceKey} → ${item.key}`
    );

    renderSection(
      "⚡ Conflicts / Smart Merges",
      this.summary.conflicts,
      (item) => `${item.key} (${item.decision})`
    );

    renderSection(
      "✕ Delete on Cloud (Deleted Locally)",
      this.summary.deletedRemote,
      (item) => item.key
    );

    renderSection(
      "✕ Trash Locally (Deleted on Cloud)",
      this.summary.deletedLocal,
      (item) => item.key
    );

    const footerSetting = new Setting(contentEl);
    if (
      this.isDryRun &&
      this.onExecuteSync &&
      this.summary.totalActionCount > 0
    ) {
      footerSetting.addButton((btn) => {
        btn
          .setButtonText("Execute Sync Now")
          .setCta()
          .onClick(async () => {
            this.close();
            await this.onExecuteSync!();
          });
      });
    }
    footerSetting.addButton((btn) => {
      btn.setButtonText("Close").onClick(() => {
        this.close();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
