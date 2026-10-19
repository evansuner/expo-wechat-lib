/** @type {import('expo/config-plugins').AndroidConfig} */
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  withEntitlementsPlist,
} = require("expo/config-plugins");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

const withAndroidActivity = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      if (!config.android?.package) {
        throw new Error(
          "expo-wechat-lib: set android.package before building Android."
        );
      }
      const relativePath = [
        "app",
        "src",
        "main",
        "java",
        ...config.android.package.split("."),
      ];
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        ...relativePath
      );
      fs.mkdirSync(path.join(filePath, "wxapi"), { recursive: true });

      const entryActivityFilePath = path.join(
        filePath,
        "wxapi",
        "WXEntryActivity.java"
      );
      const entryActivityContent = `
        package ${config.android?.package}.wxapi;

        import android.app.Activity;
        import android.content.Intent;
        import android.os.Bundle;

        public class WXEntryActivity extends Activity {
          @Override
          public void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            try {
              // 接收微信回调 Intent 
              Intent intent = getIntent();
              Intent intentToBroadcast = new Intent();

              // 转发为广播，供 React Native 模块接收
              intentToBroadcast.setAction("expo.modules.nativewechat.ACTION_REDIRECT_INTENT");
              intentToBroadcast.setPackage(getPackageName());
              intentToBroadcast.putExtra("intent", intent);

              sendBroadcast(intentToBroadcast);

              finish();
            } catch (Exception e) {
              e.printStackTrace();
            }
          }
        }
        `;

      await fsp.writeFile(entryActivityFilePath, entryActivityContent, "utf-8");
      console.log(`Created WXEntryActivity.java at ${entryActivityFilePath}`);

      const payActivityFilePath = path.join(
        filePath,
        "wxapi",
        "WXPayEntryActivity.java"
      );
      const payActivityContent = `
        package ${config.android?.package}.wxapi;

        import android.app.Activity;
        import android.content.Intent;
        import android.os.Bundle;

        public class WXPayEntryActivity extends Activity {
          @Override
          public void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            try {
              Intent intent = getIntent();
              Intent intentToBroadcast = new Intent();

              intentToBroadcast.setAction("expo.modules.nativewechat.ACTION_REDIRECT_INTENT");
              intentToBroadcast.setPackage(getPackageName());
              intentToBroadcast.putExtra("intent", intent);

              sendBroadcast(intentToBroadcast);

              finish();
            } catch (Exception e) {
              e.printStackTrace();
            }
          }
        }
        `;

      await fsp.writeFile(payActivityFilePath, payActivityContent, "utf-8");
      console.log(`Created WXPayEntryActivity.java at ${payActivityFilePath}`);

      return config;
    },
  ]);
};

const withNativeWechatConfig = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const packageName = config.android?.package;

    // 检查是否已经存在 queries 标签
    if (!config.modResults.manifest.queries) {
      config.modResults.manifest.queries = [];
    }

    // 检查是否已经添加了微信包查询，避免重复添加
    const existingWechatQuery = config.modResults.manifest.queries.find(
      (query) =>
        query.package &&
        query.package.some(
          (pkg) => pkg.$ && pkg.$["android:name"] === "com.tencent.mm"
        )
    );

    if (!existingWechatQuery) {
      config.modResults.manifest.queries.push({
        package: [
          {
            $: {
              "android:name": "com.tencent.mm",
            },
          },
        ],
      });
    }

    const mainApplication = getMainApplicationOrThrow(androidManifest);

    // 确保 activity 数组存在
    if (!mainApplication.activity) {
      mainApplication.activity = [];
    }

    // 检查是否已经添加了 WXEntryActivity，避免重复添加
    const existingWXEntryActivity = mainApplication.activity.find(
      (activity) =>
        activity.$ && activity.$["android:name"] === ".wxapi.WXEntryActivity"
    );

    if (!existingWXEntryActivity) {
      mainApplication.activity.push({
        $: {
          "android:name": ".wxapi.WXEntryActivity",
          "android:label": "@string/app_name",
          "android:theme": "@android:style/Theme.Translucent.NoTitleBar",
          "android:exported": "true",
          "android:taskAffinity": packageName,
          "android:launchMode": "singleTask",
        },
      });
    }

    // 检查是否已经添加了 WXPayEntryActivity，避免重复添加
    const existingWXPayEntryActivity = mainApplication.activity.find(
      (activity) =>
        activity.$ && activity.$["android:name"] === ".wxapi.WXPayEntryActivity"
    );

    if (!existingWXPayEntryActivity) {
      mainApplication.activity.push({
        $: {
          "android:name": ".wxapi.WXPayEntryActivity",
          "android:exported": "true",
          "android:label": "@string/app_name",
        },
      });
    }

    return config;
  });
};

const withIOSWechat = (config, { appid, universalLink } = {}) => {
  if (!appid || !/^wx[a-zA-Z0-9]+$/.test(appid)) {
    throw new Error(
      "expo-wechat-lib: set the plugin option appid to your WeChat App ID."
    );
  }
  let link;
  try {
    link = new URL(universalLink);
  } catch {
    throw new Error(
      "expo-wechat-lib: universalLink must be an HTTPS URL ending in /."
    );
  }
  if (
    link.protocol !== "https:" ||
    !link.pathname.endsWith("/") ||
    link.search ||
    link.hash ||
    link.port ||
    link.username ||
    link.password
  ) {
    throw new Error(
      "expo-wechat-lib: universalLink must be an HTTPS URL ending in / without credentials, port, query or fragment."
    );
  }
  config.ios = {
    ...config.ios,
    associatedDomains: [
      ...new Set([
        ...(config.ios?.associatedDomains || []),
        `applinks:${link.hostname}`,
      ]),
    ],
  };
  config = withInfoPlist(config, (config) => {
    const plist = config.modResults;
    plist.LSApplicationQueriesSchemes = [
      ...new Set([
        ...(plist.LSApplicationQueriesSchemes || []),
        "weixin",
        "weixinULAPI",
        "weixinURLParamsAPI",
      ]),
    ];
    const types = plist.CFBundleURLTypes || [];
    if (
      !types.some((type) => (type.CFBundleURLSchemes || []).includes(appid))
    ) {
      types.push({ CFBundleURLName: "wechat", CFBundleURLSchemes: [appid] });
    }
    plist.CFBundleURLTypes = types;
    return config;
  });
  return withEntitlementsPlist(config, (config) => {
    const key = "com.apple.developer.associated-domains";
    config.modResults[key] = [
      ...new Set([
        ...(config.modResults[key] || []),
        ...(config.ios?.associatedDomains || []),
        `applinks:${link.hostname}`,
      ]),
    ];
    return config;
  });
};

const withConfig = (config, options = {}) => {
  config = withIOSWechat(config, options);
  config = withNativeWechatConfig(config);
  config = withAndroidActivity(config);

  return config;
};

module.exports = withConfig;
