////////////////////////////////////////////////////////////
// Global Build Defines
////////////////////////////////////////////////////////////

declare global {
  var DEFAULT_GOOGLEDRIVE_CLIENT_ID: string;
  var DEFAULT_GOOGLEDRIVE_CLIENT_SECRET: string;
}

///////////////////////////////////////////////////////////
// Smart Conflict
//////////////////////////////////////////////////////////

export const MERGABLE_SIZE = 1000 * 1000; // 1 MB

///////////////////////////////////////////////////////////
// Google Drive
//////////////////////////////////////////////////////////

export interface GoogleDriveConfig {
  accessToken: string;
  accessTokenExpiresInMs: number;
  accessTokenExpiresAtTimeMs: number;
  refreshToken: string;
  remoteBaseDir?: string;
  credentialsShouldBeDeletedAtTimeMs?: number;
  scope: "https://www.googleapis.com/auth/drive";
  kind: "googledrive";
}

export const GOOGLEDRIVE_CLIENT_ID = global.DEFAULT_GOOGLEDRIVE_CLIENT_ID;
export const GOOGLEDRIVE_CLIENT_SECRET =
  global.DEFAULT_GOOGLEDRIVE_CLIENT_SECRET;
