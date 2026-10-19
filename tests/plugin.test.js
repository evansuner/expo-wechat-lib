const { test } = require("node:test");
const assert = require("node:assert/strict");
const { compileModsAsync } = require("expo/config-plugins");
const plugin = require("../app.plugin");
const options = {
  appid: "wx1234",
  universalLink: "https://links.example.com/wechat/",
};

test("iOS plugin preserves existing links and is idempotent without an Android package", async () => {
  let config = {
    name: "Test",
    slug: "test",
    ios: {
      associatedDomains: ["applinks:existing.com"],
      entitlements: {
        "com.apple.developer.associated-domains": [
          "webcredentials:existing.com",
        ],
      },
      infoPlist: {
        LSApplicationQueriesSchemes: ["existing"],
        CFBundleURLTypes: [{ CFBundleURLSchemes: ["existing"] }],
      },
    },
  };
  config = plugin(plugin(config, options), options);
  const result = await compileModsAsync(config, {
    projectRoot: process.cwd(),
    platforms: ["ios"],
    introspect: true,
  });
  const { infoPlist, entitlements } = result._internal.modResults.ios;
  assert.deepEqual(infoPlist.LSApplicationQueriesSchemes, [
    "existing",
    "weixin",
    "weixinULAPI",
    "weixinURLParamsAPI",
  ]);
  assert.deepEqual(
    infoPlist.CFBundleURLTypes.map((t) => t.CFBundleURLSchemes),
    [["existing"], ["wx1234"]]
  );
  assert.deepEqual(
    new Set(entitlements["com.apple.developer.associated-domains"]),
    new Set([
      "webcredentials:existing.com",
      "applinks:existing.com",
      "applinks:links.example.com",
    ])
  );
});
test("plugin rejects missing App ID and malformed Universal Links", () => {
  assert.throws(() => plugin({}, {}), /appid/);
  for (const universalLink of [
    undefined,
    "http://example.com/",
    "https://example.com/wechat",
    "https://example.com/?q=1",
    "https://example.com/#fragment",
    "https://user:pass@example.com/",
    "https://example.com:8080/",
  ]) {
    assert.throws(
      () => plugin({}, { ...options, universalLink }),
      /universalLink/
    );
  }
});
