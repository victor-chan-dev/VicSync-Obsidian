import cloneDeep from "lodash/cloneDeep";
import QRCode from "qrcode";
import { base64url } from "rfc4648";

import { getShrinkedSettings as getShrinkedSettingsOnedriveFull } from "../pro/src/fsOnedriveFull";
import {
  COMMAND_URI,
  type QRExportType,
  type RemotelySavePluginSettings,
  type UriParams,
} from "./baseTypes";
import { getShrinkedSettings as getShrinkedSettingsOnedrive } from "./fsOnedrive";

export const exportQrCodeUri = async (
  settings: RemotelySavePluginSettings,
  currentVaultName: string,
  pluginVersion: string,
  exportFields: QRExportType
) => {
  let settings2: Partial<RemotelySavePluginSettings> = {};

  if (exportFields === "basic_and_advanced") {
    settings2 = cloneDeep(settings);
    delete settings2.s3;
    delete settings2.dropbox;
    delete settings2.onedrive;
    delete settings2.onedrivefull;
    delete settings2.webdav;
    delete settings2.webdis;
    delete settings2.googledrive;
    delete settings2.box;
    delete settings2.pcloud;
    delete settings2.yandexdisk;
    delete settings2.koofr;
    delete settings2.azureblobstorage;
    delete settings2.pro;
  } else if (exportFields === "s3") {
    settings2 = { s3: cloneDeep(settings.s3), serviceType: "s3" };
  } else if (exportFields === "dropbox") {
    settings2 = { dropbox: cloneDeep(settings.dropbox), serviceType: "dropbox" };
  } else if (exportFields === "onedrive") {
    settings2 = {
      onedrive: getShrinkedSettingsOnedrive(settings.onedrive),
      serviceType: "onedrive",
    };
  } else if (exportFields === "onedrivefull") {
    settings2 = {
      onedrivefull: getShrinkedSettingsOnedriveFull(settings.onedrivefull),
      serviceType: "onedrivefull",
    };
  } else if (exportFields === "webdav") {
    settings2 = { webdav: cloneDeep(settings.webdav), serviceType: "webdav" };
  } else if (exportFields === "webdis") {
    settings2 = { webdis: cloneDeep(settings.webdis), serviceType: "webdis" };
  } else if (exportFields === "googledrive") {
    settings2 = {
      googledrive: cloneDeep(settings.googledrive),
      serviceType: "googledrive",
    };
  } else if (exportFields === "box") {
    settings2 = { box: cloneDeep(settings.box), serviceType: "box" };
  } else if (exportFields === "pcloud") {
    settings2 = { pcloud: cloneDeep(settings.pcloud), serviceType: "pcloud" };
  } else if (exportFields === "yandexdisk") {
    settings2 = {
      yandexdisk: cloneDeep(settings.yandexdisk),
      serviceType: "yandexdisk",
    };
  } else if (exportFields === "koofr") {
    settings2 = { koofr: cloneDeep(settings.koofr), serviceType: "koofr" };
  } else if (exportFields === "azureblobstorage") {
    settings2 = {
      azureblobstorage: cloneDeep(settings.azureblobstorage),
      serviceType: "azureblobstorage",
    };
  }

  delete settings2.vaultRandomID;
  const data = encodeURIComponent(JSON.stringify(settings2));
  const vault = encodeURIComponent(currentVaultName);
  const version = encodeURIComponent(pluginVersion);
  const rawUri = `obsidian://${COMMAND_URI}?func=settings&version=${version}&vault=${vault}&data=${data}`;
  // console.info(uri)
  const imgUri = await QRCode.toDataURL(rawUri);
  return {
    rawUri,
    imgUri,
  };
};

export interface ProcessQrCodeResultType {
  status: "error" | "ok";
  message: string;
  result?: RemotelySavePluginSettings;
}

/**
 * we also support directly parse the uri, or raw JSON, instead of relying on web browser
 * @param input
 */
export const parseUriByHand = (input: string) => {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return {
      func: "settings",
      data: trimmed,
    };
  }

  try {
    const k = new URL(trimmed);
    const output = Object.fromEntries(k.searchParams);
    return output;
  } catch (e) {
    if (trimmed.includes("?")) {
      const qs = trimmed.slice(trimmed.indexOf("?") + 1);
      const params = new URLSearchParams(qs);
      return Object.fromEntries(params);
    }
  }

  throw Error(`Not a valid settings URI or JSON`);
};

export const importQrCodeUri = (
  inputParams: any,
  currentVaultName: string
): ProcessQrCodeResultType => {
  const params = inputParams as UriParams;
  if (
    params.func === undefined ||
    params.func !== "settings" ||
    params.data === undefined
  ) {
    return {
      status: "error",
      message: `the uri is not for exporting/importing settings: ${JSON.stringify(
        inputParams
      )}`,
    };
  }

  let settings = {} as RemotelySavePluginSettings;
  try {
    let rawStr = params.data;
    try {
      rawStr = decodeURIComponent(params.data);
    } catch (e) {}

    try {
      settings = JSON.parse(rawStr);
    } catch (e) {
      // Try base64url decode
      const buf = base64url.parse(params.data, {
        out: Buffer.allocUnsafe as any,
        loose: true,
      }) as Buffer;
      settings = JSON.parse(buf.toString("utf-8"));
    }
  } catch (e: any) {
    return {
      status: "error",
      message: `errors while parsing settings: ${e?.message || e}`,
    };
  }
  return {
    status: "ok",
    message: "ok",
    result: settings,
  };
};
