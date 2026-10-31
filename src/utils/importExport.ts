import cloneDeep from "lodash/cloneDeep";
import QRCode from "qrcode";
import { base64url } from "rfc4648";

import {
  COMMAND_URI,
  type QRExportType,
  type RemotelySavePluginSettings,
  type UriParams,
} from "../baseTypes";

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
    delete settings2.googledrive;
  } else if (exportFields === "s3") {
    settings2 = { s3: cloneDeep(settings.s3), serviceType: "s3" };
  } else if (exportFields === "googledrive") {
    settings2 = {
      googledrive: cloneDeep(settings.googledrive),
      serviceType: "googledrive",
    };
  }

  delete settings2.vaultRandomID;
  const data = encodeURIComponent(JSON.stringify(settings2));
  const vault = encodeURIComponent(currentVaultName);
  const version = encodeURIComponent(pluginVersion);
  const rawUri = `obsidian://${COMMAND_URI}?func=settings&version=${version}&vault=${vault}&data=${data}`;
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
