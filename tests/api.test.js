const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadApi(handler, platform = "ios") {
  const listeners = new Map();
  const calls = [];
  const emit = (name, data) => listeners.get(name)?.(data);
  const native = new Proxy(
    {
      addListener(name, listener) {
        listeners.set(name, listener);
      },
      getConstants() {
        return {};
      },
    },
    {
      get(target, key) {
        return (
          target[key] ??
          ((args) => {
            calls.push([key, args]);
            return handler(key, args, emit);
          })
        );
      },
    }
  );
  let sequence = 0;
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync("src/api.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(js, {
    exports,
    URL,
    require(name) {
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name === "./module") return { default: native };
      if (name === "./utils") return { getRandomStr: () => String(++sequence) };
      if (name === "./hooks") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { api: exports, emit, calls };
}
const credentials = {
  appid: "wx1234",
  universalLink: "https://example.com/wechat/",
};
const success = (name, args, emit) =>
  emit("ResponseData", { id: args.id, success: true });

test("synchronous registration resolves boolean, is idempotent and does not lose events", async () => {
  const { api, calls } = loadApi(success);
  assert.equal(await api.registerApp(credentials), true);
  assert.equal(await api.registerApp(credentials), true);
  assert.equal(calls.length, 1);
  assert.equal(await api.isWechatInstalled(), true);
});
test("installation query works before registration and preserves false", async () => {
  const { api } = loadApi((name, args, emit) =>
    emit("ResponseData", { id: args.id, success: false })
  );
  assert.equal(await api.isWechatInstalled(), false);
});
test("failed registration can be retried and does not permit APIs", async () => {
  let attempt = 0;
  const { api } = loadApi((name, args, emit) =>
    emit("ResponseData", { id: args.id, success: ++attempt > 1 })
  );
  await assert.rejects(api.registerApp(credentials), /Native request failed/);
  await assert.rejects(
    api.shareText({ text: "hello", scene: 0 }),
    /await registerApp/
  );
  assert.equal(await api.registerApp(credentials), true);
});
test("missing iOS Universal Link rejects before invoking native code", async () => {
  const { api, calls } = loadApi(success);
  await assert.rejects(api.registerApp({ appid: "wx1234" }), /universalLink/);
  assert.equal(calls.length, 0);
});
test("authorization callback can arrive before send completion", async () => {
  const { api } = loadApi((name, args, emit) => {
    if (name === "sendAuthRequest")
      emit("ResponseFromNotification", {
        type: "SendAuthResp",
        errorCode: 0,
        data: { code: "test-code" },
      });
    success(name, args, emit);
  });
  await api.registerApp(credentials);
  assert.equal((await api.sendAuthRequest()).data.code, "test-code");
});
test("authorization cancellation rejects and allows retry", async () => {
  const { api } = loadApi((name, args, emit) => {
    success(name, args, emit);
    if (name === "sendAuthRequest")
      emit("ResponseFromNotification", {
        type: "SendAuthResp",
        errorCode: -2,
        errorStr: "cancelled",
      });
  });
  await api.registerApp(credentials);
  await assert.rejects(api.sendAuthRequest(), /cancelled/);
  await assert.rejects(api.sendAuthRequest(), /cancelled/);
});
test("concurrent authorization is rejected without overwriting the first callback", async () => {
  const { api, emit } = loadApi(success);
  await api.registerApp(credentials);
  const first = api.sendAuthRequest();
  await assert.rejects(api.sendAuthRequest(), /already pending/);
  emit("ResponseFromNotification", {
    type: "SendAuthResp",
    errorCode: 0,
    data: { code: "first" },
  });
  assert.equal((await first).data.code, "first");
});
test("native send failure rejects callback request and allows retry", async () => {
  const { api } = loadApi((name, args, emit) =>
    emit("ResponseData", {
      id: args.id,
      success: name === "registerApp",
      message: "send failed",
    })
  );
  await api.registerApp(credentials);
  await assert.rejects(api.sendAuthRequest(), /send failed/);
  await assert.rejects(api.sendAuthRequest(), /send failed/);
});
test("legacy mini program spelling is mapped to native record and defaults ticket flag", async () => {
  const { api, calls } = loadApi(success);
  await api.registerApp(credentials);
  assert.equal(
    await api.shareMiniProgram({
      userName: "gh_test",
      path: "",
      webpageUrl: "https://example.com",
      miniprogramType: 2,
    }),
    true
  );
  const request = calls.at(-1)[1];
  assert.equal(request.miniProgramType, 2);
  assert.equal(request.withShareTicket, false);
});
test("Universal Link diagnostic failure rejects with SDK details", async () => {
  const { api } = loadApi((name, args, emit) =>
    emit("ResponseData", {
      id: args.id,
      success: name === "registerApp",
      errorInfo: "AASA missing",
      suggestion: "Upload AASA",
    })
  );
  await api.registerApp(credentials);
  await assert.rejects(
    api.checkUniversalLinkReady(),
    /AASA missing: Upload AASA/
  );
});
test("payment waits for PayResp, not SendAuthResp", async () => {
  const { api, emit } = loadApi(success);
  await api.registerApp(credentials);
  const payment = api.requestPayment({});
  emit("ResponseFromNotification", { type: "PayResp", errorCode: 0, data: {} });
  assert.equal((await payment).type, "PayResp");
});

test("concurrent registration shares one native call", async () => {
  const { api, calls, emit } = loadApi(() => {});
  const first = api.registerApp(credentials);
  const second = api.registerApp(credentials);
  assert.equal(first, second);
  assert.equal(calls.length, 1);
  emit("ResponseData", { id: calls[0][1].id, success: true });
  assert.equal(await first, true);
});
test("Expo AsyncFunction rejection propagates and permits registration retry", async () => {
  let attempts = 0;
  const { api } = loadApi((name, args, emit) => {
    if (++attempts === 1)
      return Promise.reject(new Error("Invalid native record"));
    success(name, args, emit);
    return Promise.resolve();
  });
  await assert.rejects(api.registerApp(credentials), /Invalid native record/);
  assert.equal(await api.registerApp(credentials), true);
});

test('mini program callback is not serialized to native and fires on return', async () => {
  const { api, emit, calls } = loadApi(success);
  await api.registerApp(credentials);
  let result;
  const pending = api.launchMiniProgram({ userName: 'gh_test', path: '', miniProgramType: 0, onNavBack: response => { result = response; } });
  assert.equal('onNavBack' in calls.at(-1)[1], false);
  emit('ResponseFromNotification', { type: 'WXLaunchMiniProgramResp', errorCode: 0, data: { extMsg: 'returned' } });
  assert.equal(await pending, true);
  assert.equal(result.data.extMsg, 'returned');
});
