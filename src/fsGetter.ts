import { FakeFsGoogleDrive } from "../pro/src/fsGoogleDrive";
import type { RemotelySavePluginSettings } from "./baseTypes";
import type { FakeFs } from "./fsAll";
import { FakeFsS3 } from "./fsS3";

/**
 * Factory for supported remote storage providers (Google Drive and S3).
 */
export function getClient(
  settings: RemotelySavePluginSettings,
  vaultName: string,
  saveUpdatedConfigFunc: () => Promise<any>
): FakeFs {
  switch (settings.serviceType) {
    case "googledrive":
      return new FakeFsGoogleDrive(
        settings.googledrive,
        vaultName,
        saveUpdatedConfigFunc
      );
    case "s3":
      return new FakeFsS3(settings.s3);
    default:
      throw Error(`cannot init client for serviceType=${settings.serviceType}`);
  }
}
