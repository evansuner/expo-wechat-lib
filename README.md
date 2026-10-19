# expo-wechat-lib

通过 Expo Modules 在 iOS / Android 中使用微信登录、分享、支付、小程序和客服功能。

> 本仓库的 npm 包名、导入路径和配置插件名都是 **`expo-wechat-lib`**。原生模块名仍为 `ExpoNativeWechat`。旧文档中的 `expo-native-wechat` 是上游项目名，请勿混用。

## 兼容环境

本次升级以 2026-10-19 的稳定版本为基线：

| 组件 | 版本 / 要求 |
| --- | --- |
| Expo | SDK 58，开发依赖 `~58.0.14` |
| Expo Modules Core | `~58.0.22`，由宿主 Expo 提供 |
| Expo module 开发工具 | `expo-module-scripts ^56.0.3`（当前 latest） |
| React / React Native | `19.3.0` / `0.88.0` |
| iOS | 最低 16.4；最新适配目标 iOS 27 / Xcode 27 |
| 微信 iOS SDK | 官方 `WechatOpenSDK-XCFramework 2.0.9`，包含真机 arm64 和模拟器 arm64 / x86_64 |
| 微信 Android SDK | `com.tencent.mm.opensdk:wechat-sdk-android:6.8.40`，固定版本 |
| Node.js | `^22.13.0`、`^24.3.0`、`^26.0.0` 或 `>=27.0.0` |

SDK 58 的 Expo 模块 API 支持本库现有实现；无需启用 Expo Modules 2.0 beta。当前 peer 范围限定 SDK 58 / RN 0.88，不承诺旧 SDK 的兼容性。

这是原生库，**Expo Go 无法加载**。必须重新生成并构建原生应用。微信授权、支付和分享结果需要在安装了微信的真机测试；模拟器用于验证模块加载与构建。

## 1. 准备微信开放平台信息

在[微信开放平台](https://open.weixin.qq.com/)创建并审核移动应用，获取 `wx...` App ID。完成对应能力的开通，并配置：

- iOS Bundle ID、Universal Link 与 Apple Team ID。
- Android 包名和签名（按微信平台要求填写签名证书摘要）；开发包和发布包可能使用不同签名。
- 登录 code 换 token、支付下单 / 签名在业务服务端完成。不要将 AppSecret 或商户私钥放进 App。

## 2. 安装

先将宿主升级到 SDK 58，按 [Expo 升级指南](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)修复依赖：

```bash
npx expo install expo@~58.0.14 --fix
npx expo-doctor
npm install expo-wechat-lib
```

如果使用当前仓库尚未发布的修改，先在库根目录执行 `bun install && bun run build && npm pack`，再在宿主安装生成的 `.tgz` 文件。直接安装注册表里的旧版 `0.3.3` 不会包含本地修改。

不要额外安装另一份 `expo-modules-core` 作为宿主运行时依赖；使用 Expo 对应版本，避免重复原生模块。

## 3. 配置插件

在宿主 `app.json` 的 `expo` 节点配置。以下值均须替换为自己的实际值：

```json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "ios": {
      "bundleIdentifier": "com.yourcompany.myapp"
    },
    "android": {
      "package": "com.yourcompany.myapp"
    },
    "plugins": [
      ["expo-wechat-lib", {
        "appid": "wx1234567890abcdef",
        "universalLink": "https://links.yourdomain.com/wechat/"
      }]
    ]
  }
}
```

`appid` 和 `universalLink` 是本插件必填参数。Universal Link 必须为 HTTPS URL、以 `/` 结尾，不含端口、凭据、查询串或 fragment；运行时 `registerApp` 必须使用同一组值。

插件会保留现有配置并去重添加：

| iOS | Android |
| --- | --- |
| App ID 的 `CFBundleURLTypes` 回调 Scheme | 微信包可见性查询 `com.tencent.mm` |
| `LSApplicationQueriesSchemes`：`weixin`、`weixinULAPI`、`weixinURLParamsAPI` | `.wxapi.WXEntryActivity`、`.wxapi.WXPayEntryActivity` |
| Associated Domains：`applinks:links.yourdomain.com` | 对应包名下的两个 Java 回调入口 |

不需要把 App ID 同时加到 Expo 的全局 `scheme`，也不要把整个 Universal Link URL 填进 `associatedDomains`。

### 配置 Universal Link 服务端

插件只能设置 App 权限，**不会替你部署 AASA 文件**。在该域名提供：

```text
https://links.yourdomain.com/.well-known/apple-app-site-association
```

文件无扩展名，使用有效 HTTPS 和 `application/json`，直接返回 200，避免重定向。示例：

```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "YOUR_TEAM_ID.com.yourcompany.myapp",
      "paths": ["/wechat/*"]
    }]
  }
}
```

`appID` 的前缀须与签名中的 application-identifier 前缀一致（通常为 Team ID）。路径必须覆盖微信实际回调路径。将同一个 `https://links.yourdomain.com/wechat/` 填入微信开放平台。Apple 会缓存 AASA，修改后可能需要等待刷新并重新安装 App。

参考：[Apple Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)、[微信 iOS 接入指南](https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Access_Guide/iOS.html)。

## 4. 生成并构建

```bash
npx expo prebuild --platform ios
npx expo run:ios --device
# Android
npx expo prebuild --platform android
npx expo run:android --device
```

也可在配置 EAS 后使用 `eas build --platform ios --profile development`。修改插件、微信 SDK 或原生代码后要重新构建原生包，OTA / Metro 热更新不足以应用这些变更。若手动安装 Pods，在宿主的 `ios` 目录执行 `pod install --repo-update`；若旧锁文件仍固定旧微信包，更新对应 Pod。

### 已有原生 iOS 工程 / Bare React Native

先按 [Expo Modules 安装指南](https://docs.expo.dev/bare/installing-expo-modules/)集成 Expo，并保持 SDK 58 要求的 Scene 生命周期。iOS 27 下使用 `ExpoAppSceneDelegate`；它将 URL 和 Universal Link 事件转发到 `ExpoAppDelegate`，再交给本库的 `ExpoWechatDelegate`。

本库通过 `expo-module.config.json` 自动注册回调代理，不要再手动调用一份 `WXApi.handleOpen`。安装 Pods 后，可在生成的 `ExpoModulesProvider.swift` 中检查 `ExpoNativeWechatModule` 和 `ExpoWechatDelegate` 是否存在。

如果不运行 Expo prebuild，需自己按上表配置 Info.plist、Associated Domains 和 Android 回调入口。自定义 AppDelegate / SceneDelegate 时必须保留 Expo 的事件转发；仅安装 JS 包不会自动修改已有原生工程。

## 5. 初始化与登录

`registerApp` 返回 **`Promise<boolean>`**，不是移除监听器的函数。应在应用级初始化时调用并 `await` 成功，再调用业务 API。重复或并发注册会复用成功状态 / 进行中的请求；失败后可以重试。若需更换 App ID，请重新启动应用。

```typescript
import {
  registerApp,
  isWechatInstalled,
  sendAuthRequest,
} from 'expo-wechat-lib';

export async function loginWithWechat(stateFromServer: string) {
  await registerApp({
    appid: 'wx1234567890abcdef',
    universalLink: 'https://links.yourdomain.com/wechat/',
    log: __DEV__,
  });

  if (!(await isWechatInstalled())) {
    throw new Error('请先安装微信');
  }

  const response = await sendAuthRequest({
    scope: 'snsapi_userinfo',
    state: stateFromServer,
  });

  // 将 code 和 state 交给自己的服务端校验，并换取业务登录态。
  return { code: response.data.code, state: response.data.state };
}
```

调用方需 `try/catch` 处理未安装微信、用户取消、拒绝授权和发送失败。登录与支付分别只允许一个尚未完成的同类请求；并发请求会被拒绝，避免回调互相覆盖。授权 / 支付需要用户回到 App 后收到微信回调才能完成；App 进程被终止时原 JS Promise 不会恢复。

## API 与返回值

| API | 返回 / 注意事项 |
| --- | --- |
| `registerApp({ appid, universalLink, log?, logPrefix? })` | `Promise<boolean>`，成功为 `true`，失败 reject；iOS 必须传 Universal Link |
| `isWechatInstalled()` / `useWechatInstalled()` | 安装状态 boolean；可以在注册前检查 |
| `checkUniversalLinkReady()` | 仅 iOS，注册后使用；成功返回 `{ suggestion, errorInfo }`，失败 reject 并包含诊断信息；诊断可能跳转微信 |
| `sendAuthRequest({ scope, state? })` | 微信最终授权回调 `SendAuthRequestResponse` |
| `requestPayment({ partnerId, prepayId, nonceStr, timeStamp, sign })` | 微信最终支付回调 `NativeWechatResponse`；最终交易状态以商户服务端通知 / 查单为准 |
| `shareText({ text, scene })` | SDK 接受发送请求后返回 `true` |
| `shareImage({ src, scene })` | `src` 为图片 URL；SDK 接受请求后返回 `true` |
| `shareVideo({ videoUrl, scene, title?, description?, videoLowBandUrl?, coverUrl? })` | SDK 接受请求后返回 `true` |
| `shareWebpage({ webpageUrl, scene, title?, description?, coverUrl? })` | SDK 接受请求后返回 `true` |
| `shareMiniProgram({ userName, path, miniProgramType, webpageUrl, ... })` | `userName` 为小程序原始 ID（`gh_...`）；可选 `withShareTicket`、`title`、`description`、`coverUrl`；始终分享给会话；兼容旧拼写 `miniprogramType` |
| `launchMiniProgram({ userName, path, miniProgramType, onNavBack? })` | 默认接受请求后返回 `true`；传 `onNavBack` 时等待 `WXLaunchMiniProgramResp` 后调用它并完成 Promise |
| `requestSubscribeMessage({ scene, templateId, reserved? })` | SDK 接受请求后返回 `true`；是否可用取决于微信开放能力 |
| `openCustomerService({ corpid, url })` | SDK 接受请求后返回 `true` |
| `appPureSignContract({ preEntrustwebId })` | 纯签约入口；SDK 接受请求后返回 `true`，不代表签约完成 |

除安装状态查询外，发送返回 `success: false` 会 reject。分享 / 打开小程序等 API 的 `true` 只表示 SDK 接受请求，不代表用户已分享或完成业务操作。微信最终回调格式：

```typescript
type NativeWechatResponse<T = Record<string, unknown>> = {
  id?: string;
  type?: string;
  errorCode: number;
  errorStr: string | null;
  data: T;
};
```

分享场景使用 `NativeWechatShareScene.WXSceneSession / WXSceneTimeline / WXSceneFavorite`；小程序环境使用 `NativeWechatMiniprogramType.WXMiniProgramTypeRelease / WXMiniProgramTypeTest / WXMiniProgramTypePreview`。

## 常见问题

- **Cannot find native module `ExpoNativeWechat`**：确认使用自定义原生构建而非 Expo Go；检查安装包包含 `ios/ExpoNativeWechat.podspec`，重新安装 Pods 并构建。
- **注册成功但登录 Promise 不结束**：检查 URL Scheme、AASA、微信平台 Universal Link、签名 entitlement；确认宿主使用 Expo Scene / AppDelegate 转发，并包含生成的 `ExpoWechatDelegate`。不要只看发送请求成功。
- **`isWechatInstalled()` 为 false**：真机确认微信已安装；iOS 检查查询 Scheme 是否经过插件生成。
- **Pod 冲突或 Apple Silicon 模拟器错误**：移除宿主手动添加的旧 `WechatOpenSDK` / 其他微信 SDK 封装，使用本库的 `WechatOpenSDK-XCFramework`；不要通过排除 arm64 规避重复 SDK。
- **升级后现有代码行为变化**：现在注册 / 安装状态返回实际 boolean；发送失败会 reject；`registerApp` 重复调用返回已完成 Promise；支付类型修正为支付回调，示例应先 `await registerApp`。

## 本地开发与验证

```bash
bun install --frozen-lockfile
bun run build
bun run test
bun run lint
npm pack --dry-run

cd example
npm install
npx expo prebuild --platform ios
npx expo run:ios
```

`example` 提供最小宿主。真机测试前替换 `example/app.json` 和 `example/App.js` 的 App ID、域名、Bundle ID / 包名以及登录 state 来源。示例凭据仅用于编译与加载检查。

JS 回归测试使用模拟原生事件，覆盖同步响应、注册失败重试、安装状态、授权取消 / 并发保护、支付回调、小程序参数及 Universal Link 诊断。原生编译、模拟器启动、微信真机往返是不同验证层级；真实登录、分享、支付必须使用有效平台配置另行验收。

### 本次验证结果（2026-10-19）

- TypeScript 构建、ESLint 和 16 项回归测试通过。
- iOS / Android 的 Expo prebuild 通过，CocoaPods 解析到微信 XCFramework 2.0.9，生成的 provider 包含模块及回调代理。
- Xcode 27：iOS 27 SDK 模拟器构建（arm64 / x86_64）及未签名真机 arm64 构建通过。
- iOS 27 / iPhone 18 Pro 模拟器：冷启动加载模块、注册 SDK、返回未安装微信的 `false` 状态、未安装时授权失败返回 JS，均已检查。
- Android：`./gradlew :expo-wechat-lib:compileDebugKotlin` 通过；未执行 Android 真机微信往返测试。
- `npm pack --dry-run` 已检查 JS、类型、插件、原生源码均包含，测试、示例与原生生成文件均排除。

首次运行暴露的 JS 双份 React Native 初始化问题已通过示例的 Metro 配置修复；旧 `sendEvent` 在新版 Expo Modules 下不返回事件的问题已通过迁移到 `emit` 修复。仍可见上游 Expo / React Native / 微信 SDK 的弃用、头文件及文档警告，以及当前 Node 环境的文件描述符警告；最终检查没有本库的编译或 lint 错误。

以上不包含签名归档、App Store 上传、有效微信账号登录、分享完成或真实扣款验收。

## 参考

- [Expo SDK 58 发布说明（iOS 27 / Scene 生命周期）](https://expo.dev/changelog/sdk-58)
- [Expo AppDelegate Subscribers](https://docs.expo.dev/modules/appdelegate-subscribers/)
- [官方微信 XCFramework CocoaPods 版本记录](https://trunk.cocoapods.org/api/v1/pods/WechatOpenSDK-XCFramework)

本项目基于 [Hector-Chong/expo-native-wechat](https://github.com/Hector-Chong/expo-native-wechat)。
