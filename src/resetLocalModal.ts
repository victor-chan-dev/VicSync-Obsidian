import { type App, Modal } from "obsidian";

export class ResetLocalModal extends Modal {
  confirmed: boolean = false;
  readonly onConfirm: () => Promise<void>;

  constructor(app: App, onConfirm: () => Promise<void>) {
    super(app);
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", {
      text: "Reset Local Vault from Cloud (Clean Sync Down)",
    });

    contentEl.createEl("p", {
      text: "This operation will wipe all existing notes and folders in this local vault and pull down a fresh, clean copy from your remote storage.",
    });

    const ul = contentEl.createEl("ul");
    ul.createEl("li", {
      text: "Safety Net: Existing local notes will be safely moved to Trash (not permanently deleted).",
    });
    ul.createEl("li", {
      text: "Your .obsidian settings, installed plugins, and themes will NOT be touched.",
    });
    ul.createEl("li", {
      text: "Local sync history will be reset so future syncs start with a 100% clean baseline.",
    });

    contentEl.createDiv("modal-button-container", (btnContainer) => {
      const confirmBtn = btnContainer.createEl("button", {
        cls: "mod-warning",
        text: "Wipe Local & Pull from Cloud",
      });
      confirmBtn.addEventListener("click", async () => {
        this.confirmed = true;
        this.close();
        await this.onConfirm();
      });

      const cancelBtn = btnContainer.createEl("button", {
        text: "Cancel",
      });
      cancelBtn.addEventListener("click", () => {
        this.close();
      });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
