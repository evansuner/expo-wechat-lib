import { Platform } from "react-native";

import NativeModule from "./module";
import type {
  NativeWechatModuleConstants,
  NativeWechatResponse,
  SendAuthRequestResponse,
  LaunchMiniProgramResponse,
  UniversalLinkCheckingResponse,
} from "./typing";
import { getRandomStr } from "./utils";

export type * from "./typing";

type NativeResult = {
  id?: string;
  type?: string;
  success?: boolean;
  message?: string;
  errorCode?: number;
  errorStr?: string | null;
};
type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};
const pending = new Map<string, Pending>();
const callbacks = new Map<string, Pending>();
let listenersReady = false;
let registered = false;
let registration: Promise<boolean> | undefined;

const responseError = (response: NativeResult) =>
  new Error(
    `[Native Wechat]: (${response.errorCode ?? -1}) ${
      response.errorStr ?? response.message ?? "Native request failed"
    }`,
  );

function ensureListeners() {
  if (listenersReady) return;
  NativeModule.addListener("ResponseData", (response: NativeResult) => {
    const request = pending.get(response.id!);
    if (!request) return;
    pending.delete(response.id!);
    if (response.errorCode) request.reject(responseError(response));
    else request.resolve(response);
  });
  NativeModule.addListener(
    "ResponseFromNotification",
    (response: NativeResult) => {
      const request = callbacks.get(response.type!);
      if (!request) return;
      callbacks.delete(response.type!);
      if (response.errorCode) request.reject(responseError(response));
      else request.resolve(response);
    },
  );
  listenersReady = true;
}

function invoke(name: string, args: object = {}): Promise<NativeResult> {
  ensureListeners();
  return new Promise((resolve, reject) => {
    const id = getRandomStr();
    // Expo Function callbacks may arrive synchronously, before the native call returns.
    pending.set(id, { resolve, reject });
    try {
      const result = NativeModule[name]({ ...args, id });
      if (result && typeof result.catch === "function") {
        result.catch((error: Error) => {
          pending.delete(id);
          reject(error);
        });
      }
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}

function assertRegistration(name: string) {
  if (!registered)
    throw new Error(`Please await registerApp before invoking ${name}`);
}

async function send(name: string, args: object): Promise<boolean> {
  assertRegistration(name);
  const response = await invoke(name, args);
  if (!response.success) throw responseError(response);
  return true;
}

function sendWithCallback<T extends NativeWechatResponse>(
  name: string,
  type: string,
  args: object,
): Promise<T> {
  assertRegistration(name);
  if (callbacks.has(type)) {
    return Promise.reject(new Error(`A ${type} request is already pending`));
  }
  ensureListeners();
  return new Promise((resolve, reject) => {
    // Subscribe before sending, including when WeChat responds before the send completion.
    const callback = { resolve, reject };
    callbacks.set(type, callback);
    send(name, args).catch((error) => {
      if (callbacks.get(type) === callback) callbacks.delete(type);
      reject(error);
    });
  });
}

export function registerApp(request: {
  appid: string;
  universalLink?: string;
  log?: boolean;
  logPrefix?: string;
}): Promise<boolean> {
  if (registered) return Promise.resolve(true);
  if (registration) return registration;
  if (Platform.OS === "ios") {
    try {
      const link = new URL(request.universalLink ?? "");
      if (
        link.protocol !== "https:" ||
        !link.pathname.endsWith("/") ||
        link.search ||
        link.hash
      ) {
        throw new Error("Invalid Universal Link");
      }
    } catch {
      return Promise.reject(
        new Error(
          "iOS registerApp requires an HTTPS universalLink ending in /",
        ),
      );
    }
  }
  registration = invoke("registerApp", request)
    .then((response) => {
      if (!response.success) throw responseError(response);
      registered = true;
      return true;
    })
    .finally(() => {
      registration = undefined;
    });
  return registration;
}

export async function isWechatInstalled(): Promise<boolean> {
  return (await invoke("isWechatInstalled")).success === true;
}

export async function checkUniversalLinkReady(): Promise<UniversalLinkCheckingResponse> {
  assertRegistration("checkUniversalLinkReady");
  if (Platform.OS !== "ios")
    throw new Error("checkUniversalLinkReady is only supported on iOS");
  const response = (await invoke("checkUniversalLinkReady")) as NativeResult &
    UniversalLinkCheckingResponse;
  if (!response.success)
    throw new Error(`${response.errorInfo}: ${response.suggestion}`);
  return { errorInfo: response.errorInfo, suggestion: response.suggestion };
}

export const sendAuthRequest = (
  request: { scope: string; state?: string } = {
    scope: "snsapi_userinfo",
    state: "",
  },
) =>
  sendWithCallback<SendAuthRequestResponse>("sendAuthRequest", "SendAuthResp", {
    state: "",
    ...request,
  });

export const shareText = (request: { text: string; scene: number }) =>
  send("shareText", request);
export const shareImage = (request: { src: string; scene: number }) =>
  send("shareImage", request);
export const shareVideo = (request: {
  title?: string;
  description?: string;
  scene: number;
  videoUrl: string;
  videoLowBandUrl?: string;
  coverUrl?: string;
}) => send("shareVideo", request);
export const shareWebpage = (request: {
  title?: string;
  description?: string;
  scene: number;
  webpageUrl: string;
  coverUrl?: string;
}) => send("shareWebpage", request);

type ShareMiniProgramRequest = {
  userName: string;
  path: string;
  webpageUrl: string;
  withShareTicket?: boolean;
  title?: string;
  description?: string;
  coverUrl?: string;
} & (
  | { miniProgramType: number; miniprogramType?: number }
  | {
      miniProgramType?: number;
      /** @deprecated Use miniProgramType. */ miniprogramType: number;
    }
);
export const shareMiniProgram = (request: ShareMiniProgramRequest) =>
  send("shareMiniProgram", {
    ...request,
    miniProgramType: request.miniProgramType ?? request.miniprogramType,
    withShareTicket: request.withShareTicket ?? false,
  });

export const requestPayment = (request: {
  partnerId: string;
  prepayId: string;
  nonceStr: string;
  timeStamp: string;
  sign: string;
}) =>
  sendWithCallback<NativeWechatResponse>("requestPayment", "PayResp", request);

export const requestSubscribeMessage = (request: {
  scene: number;
  templateId: string;
  reserved?: string;
}) => send("requestSubscribeMessage", request);
export const openCustomerService = (request: { corpid: string; url: string }) =>
  send("openCustomerService", request);
export const launchMiniProgram = async (request: {
  userName: string;
  path: string;
  miniProgramType: number;
  onNavBack?: (res: LaunchMiniProgramResponse) => void;
}) => {
  const { onNavBack, ...params } = request;
  if (!onNavBack) return send("launchMiniProgram", params);
  const response = await sendWithCallback<LaunchMiniProgramResponse>(
    "launchMiniProgram",
    "WXLaunchMiniProgramResp",
    params,
  );
  onNavBack(response);
  return true;
};
export const appPureSignContract = (request: { preEntrustwebId: string }) =>
  send("appPureSignContract", request);

export const NativeWechatConstants =
  NativeModule.getConstants() as NativeWechatModuleConstants;
export const NativeWechatShareScene = {
  WXSceneSession: NativeWechatConstants.WXSceneSession,
  WXSceneTimeline: NativeWechatConstants.WXSceneTimeline,
  WXSceneFavorite: NativeWechatConstants.WXSceneFavorite,
};
export const NativeWechatMiniprogramType = {
  WXMiniProgramTypeRelease: NativeWechatConstants.WXMiniProgramTypeRelease,
  WXMiniProgramTypeTest: NativeWechatConstants.WXMiniProgramTypeTest,
  WXMiniProgramTypePreview: NativeWechatConstants.WXMiniProgramTypePreview,
};
