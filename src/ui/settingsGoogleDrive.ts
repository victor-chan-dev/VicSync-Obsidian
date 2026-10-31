import cloneDeep from "lodash/cloneDeep";
import { type App, Modal, Notice, Setting } from "obsidian";
import type RemotelySavePlugin from "../main";
import {
  DEFAULT_GOOGLEDRIVE_CONFIG,
  sendRefreshTokenReq,
} from "../storage/fsGoogleDrive";
import { getClient } from "../storage/fsGetter";
import type { TransItemType } from "../utils/i18n";
import { stringToFragment } from "../utils/misc";
import { ChangeRemoteBaseDirModal } from "./settings";

class GoogleDriveAuthModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly authDiv: HTMLDivElement;
  readonly revokeAuthDiv: HTMLDivElement;
  readonly revokeAuthSetting: Setting;
  readonly t: (x: TransItemType, vars?: any) => string;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    authDiv: HTMLDivElement,
    revokeAuthDiv: HTMLDivElement,
    revokeAuthSetting: Setting,
    t: (x: TransItemType, vars?: any) => string
  ) {
    super(app);
    this.plugin = plugin;
    this.authDiv = authDiv;
    this.revokeAuthDiv = revokeAuthDiv;
    this.revokeAuthSetting = revokeAuthSetting;
    this.t = t;
  }

  async onOpen() {
    const { contentEl } = this;
    const t = this.t;

    const playgroundUrl = "https://developers.google.com/oauthplayground";
    const div2 = contentEl.createDiv();
    div2.createDiv({
      text: stringToFragment(
        "<p>To authenticate, generate a <b>refresh token</b> from Google using your OAuth Client ID & Secret (e.g. via <a href='https://developers.google.com/oauthplayground'>Google OAuth Playground</a> with scope <code>https://www.googleapis.com/auth/drive</code>) and paste it below.</p>"
      ),
    });
    div2.createEl(
      "button",
      {
        text: "Copy OAuth Playground URL",
      },
      (el) => {
        el.onclick = async () => {
          await navigator.clipboard.writeText(playgroundUrl);
          new Notice("OAuth Playground URL copied to clipboard!");
        };
      }
    );

    contentEl.createEl("p").createEl("a", {
      href: playgroundUrl,
      text: playgroundUrl,
    });

    let refreshToken = "";
    new Setting(contentEl)
      .setName(t("modal_googledrivce_maualinput"))
      .setDesc(t("modal_googledrivce_maualinput_desc"))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue("")
          .onChange((val) => {
            refreshToken = val.trim();
          })
      )
      .addButton(async (button) => {
        button.setButtonText(t("submit"));
        button.onClick(async () => {
          new Notice(t("modal_googledrive_maualinput_notice"));

          try {
            if (this.plugin.settings.googledrive === undefined) {
              this.plugin.settings.googledrive = cloneDeep(
                DEFAULT_GOOGLEDRIVE_CONFIG
              );
            }
            this.plugin.settings.googledrive.refreshToken = refreshToken;
            this.plugin.settings.googledrive.accessToken = "access";
            this.plugin.settings.googledrive.accessTokenExpiresAtTimeMs = 1;
            this.plugin.settings.googledrive.accessTokenExpiresInMs = 1;

            const k = await sendRefreshTokenReq(refreshToken);
            const ts = Date.now();
            this.plugin.settings.googledrive.accessToken = k.access_token;
            this.plugin.settings.googledrive.accessTokenExpiresInMs =
              k.expires_in * 1000;
            this.plugin.settings.googledrive.accessTokenExpiresAtTimeMs =
              ts + k.expires_in * 1000 - 60 * 2 * 1000;

            this.plugin.settings.googledrive.credentialsShouldBeDeletedAtTimeMs =
              Number.MAX_SAFE_INTEGER;
            await this.plugin.saveSettings();

            await navigator.clipboard.writeText("");

            try {
              const client = getClient(
                this.plugin.settings,
                this.app.vault.getName(),
                () => this.plugin.saveSettings()
              );
              const name = await client.getUserDisplayName();
              if (name) {
                this.revokeAuthSetting.setDesc(
                  `Signed in as: ${name}. ${t("settings_googledrive_revoke_desc")}`
                );
              }
            } catch (err) {
              console.debug("Could not fetch user name on auth:", err);
            }

            new Notice(t("modal_googledrive_maualinput_succ_notice"));
          } catch (e) {
            console.error(e);
            await this.plugin.logDebugError("GoogleDriveAuthModal", e);
            new Notice(t("modal_googledrive_maualinput_fail_notice"));
          } finally {
            const hasToken = this.plugin.settings.googledrive.refreshToken !== "";
            this.authDiv.toggleClass("googledrive-auth-button-hide", hasToken);
            this.revokeAuthDiv.toggleClass(
              "googledrive-revoke-auth-button-hide",
              !hasToken
            );
            this.authDiv.style.display = hasToken ? "none" : "";
            this.revokeAuthDiv.style.display = hasToken ? "" : "none";
            this.close();
          }
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class GoogleDriveRevokeAuthModal extends Modal {
  readonly plugin: RemotelySavePlugin;
  readonly authDiv: HTMLDivElement;
  readonly revokeAuthDiv: HTMLDivElement;
  readonly revokeAuthSetting: Setting;
  readonly t: (x: TransItemType, vars?: any) => string;
  constructor(
    app: App,
    plugin: RemotelySavePlugin,
    authDiv: HTMLDivElement,
    revokeAuthDiv: HTMLDivElement,
    revokeAuthSetting: Setting,
    t: (x: TransItemType, vars?: any) => string
  ) {
    super(app);
    this.plugin = plugin;
    this.authDiv = authDiv;
    this.revokeAuthDiv = revokeAuthDiv;
    this.revokeAuthSetting = revokeAuthSetting;
    this.t = t;
  }

  async onOpen() {
    const t = this.t;
    const { contentEl } = this;

    contentEl.createEl("p", {
      text: t("modal_googledriverevokeauth_step1"),
    });
    const consentUrl = "https://myaccount.google.com/permissions";
    contentEl.createEl("p").createEl("a", {
      href: consentUrl,
      text: consentUrl,
    });

    contentEl.createEl("p", {
      text: t("modal_googledriverevokeauth_step2"),
    });

    new Setting(contentEl)
      .setName(t("modal_googledriverevokeauth_clean"))
      .setDesc(t("modal_googledriverevokeauth_clean_desc"))
      .addButton(async (button) => {
        button.setButtonText(t("modal_googledriverevokeauth_clean_button"));
        button.onClick(async () => {
          try {
            this.plugin.settings.googledrive = cloneDeep(
              DEFAULT_GOOGLEDRIVE_CONFIG
            );

            await this.plugin.saveSettings();
            this.authDiv.toggleClass("googledrive-auth-button-hide", false);
            this.revokeAuthDiv.toggleClass(
              "googledrive-revoke-auth-button-hide",
              true
            );
            this.authDiv.style.display = "";
            this.revokeAuthDiv.style.display = "none";
            this.revokeAuthSetting.setDesc(
              t("settings_googledrive_revoke_desc")
            );
            new Notice(t("modal_googledriverevokeauth_clean_notice"));
            this.close();
          } catch (err) {
            console.error(err);
            new Notice(t("modal_googledriverevokeauth_clean_fail"));
          }
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export const generateGoogleDriveSettingsPart = (
  containerEl: HTMLElement,
  t: (x: TransItemType, vars?: any) => string,
  app: App,
  plugin: RemotelySavePlugin
) => {
  const googleDriveDiv = containerEl.createEl("div", {
    cls: "googledrive-hide",
  });
  googleDriveDiv.toggleClass(
    "googledrive-hide",
    plugin.settings.serviceType !== "googledrive"
  );
  googleDriveDiv.style.display =
    plugin.settings.serviceType === "googledrive" ? "" : "none";
  googleDriveDiv.createEl("h2", { text: t("settings_googledrive") });

  const googleDriveLongDescDiv = googleDriveDiv.createEl("div", {
    cls: "settings-long-desc",
  });
  for (const c of [
    t("settings_googledrive_disclaimer1"),
    t("settings_googledrive_disclaimer2"),
  ]) {
    googleDriveLongDescDiv.createEl("p", {
      text: c,
      cls: "googledrive-disclaimer",
    });
  }

  googleDriveLongDescDiv.createEl("p", {
    text: t("settings_googledrive_folder", {
      remoteBaseDir: plugin.settings.googledrive.remoteBaseDir || "Obsidian",
    }),
  });

  const googleDriveSelectAuthDiv = googleDriveDiv.createDiv();
  const googleDriveAuthDiv = googleDriveSelectAuthDiv.createDiv({
    cls: "googledrive-auth-button-hide settings-auth-related",
  });
  const googleDriveRevokeAuthDiv = googleDriveSelectAuthDiv.createDiv({
    cls: "googledrive-revoke-auth-button-hide settings-auth-related",
  });

  const googleDriveRevokeAuthSetting = new Setting(googleDriveRevokeAuthDiv)
    .setName(t("settings_googledrive_revoke"))
    .setDesc(t("settings_googledrive_revoke_desc"))
    .addButton(async (button) => {
      button.setButtonText(t("settings_googledrive_revoke_button"));
      button.onClick(async () => {
        new GoogleDriveRevokeAuthModal(
          app,
          plugin,
          googleDriveAuthDiv,
          googleDriveRevokeAuthDiv,
          googleDriveRevokeAuthSetting,
          t
        ).open();
      });
    });

  if (plugin.settings.googledrive?.refreshToken) {
    try {
      const client = getClient(plugin.settings, app.vault.getName(), () =>
        plugin.saveSettings()
      );
      client
        .getUserDisplayName()
        .then((name) => {
          if (name) {
            googleDriveRevokeAuthSetting.setDesc(
              `Signed in as: ${name}. ${t("settings_googledrive_revoke_desc")}`
            );
          }
        })
        .catch(() => {});
    } catch (e) {
      // ignore
    }
  }

  new Setting(googleDriveAuthDiv)
    .setName(t("settings_googledrive_auth"))
    .setDesc(t("settings_googledrive_auth_desc"))
    .addButton(async (button) => {
      button.setButtonText(t("settings_googledrive_auth_button"));
      button.onClick(async () => {
        new GoogleDriveAuthModal(
          app,
          plugin,
          googleDriveAuthDiv,
          googleDriveRevokeAuthDiv,
          googleDriveRevokeAuthSetting,
          t
        ).open();
      });
    });

  const hasRefreshToken = plugin.settings.googledrive.refreshToken !== "";
  googleDriveAuthDiv.toggleClass("googledrive-auth-button-hide", hasRefreshToken);
  googleDriveRevokeAuthDiv.toggleClass(
    "googledrive-revoke-auth-button-hide",
    !hasRefreshToken
  );
  googleDriveAuthDiv.style.display = hasRefreshToken ? "none" : "";
  googleDriveRevokeAuthDiv.style.display = hasRefreshToken ? "" : "none";

  let newgoogleDriveRemoteBaseDir =
    plugin.settings.googledrive.remoteBaseDir || "Obsidian";
  new Setting(googleDriveDiv)
    .setName(t("settings_remotebasedir"))
    .setDesc(t("settings_remotebasedir_desc"))
    .addText((text) =>
      text
        .setPlaceholder("Obsidian")
        .setValue(newgoogleDriveRemoteBaseDir)
        .onChange((value) => {
          newgoogleDriveRemoteBaseDir = value.trim() || "Obsidian";
        })
    )
    .addButton((button) => {
      button.setButtonText(t("confirm"));
      button.onClick(() => {
        new ChangeRemoteBaseDirModal(
          app,
          plugin,
          newgoogleDriveRemoteBaseDir,
          "googledrive"
        ).open();
      });
    });

  new Setting(googleDriveDiv)
    .setName(t("settings_checkonnectivity"))
    .setDesc(t("settings_checkonnectivity_desc"))
    .addButton(async (button) => {
      button.setButtonText(t("settings_checkonnectivity_button"));
      button.onClick(async () => {
        new Notice(t("settings_checkonnectivity_checking"));
        const client = getClient(plugin.settings, app.vault.getName(), () =>
          plugin.saveSettings()
        );
        const errors: { msg: string; raw?: unknown } = { msg: "" };
        const res = await client.checkConnect((err: any) => {
          errors.msg = `${err}`;
          errors.raw = err;
        });
        if (res) {
          new Notice(t("settings_googledrive_connect_succ"));
        } else {
          await plugin.logDebugError(
            "GoogleDriveCheckConnectivity",
            errors.raw ?? errors.msg
          );
          new Notice(t("settings_googledrive_connect_fail"));
          new Notice(errors.msg);
        }
      });
    });

  return {
    googleDriveDiv,
  };
};
