//
//  ExpoWechatDelegate.swift
//  ExpoNativeWechat
//
//  Created by Evan on 2/8/25.
//

import ExpoModulesCore

public class ExpoWechatDelegate: ExpoAppDelegateSubscriber, WXApiDelegate {
    public func application(
        _ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return WXApi.handleOpen(url, delegate: self)
    }

    public func application(
        _ application: UIApplication, continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        return WXApi.handleOpenUniversalLink(userActivity, delegate: self)
    }

    public func application(
        _ application: UIApplication, open url: URL, sourceApplication: String?, annotation: Any
    ) -> Bool {
        return WXApi.handleOpen(url, delegate: self)
    }

    public func onResp(_ resp: BaseResp) {
        guard let convertedData = RespDataHelper.downcastResp(resp) else {
            print("Failed to convert response data")
            return
        }

        let data = ExpoWechatUtils.convertToSwiftDictionary(data: convertedData as NSDictionary)
        let notificationName = Notification.Name("ResponseData")

        NotificationCenter.default.post(
            Notification(name: notificationName, object: nil, userInfo: data))
    }
}
