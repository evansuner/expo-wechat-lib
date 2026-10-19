import ExpoModulesCore
import WechatOpenSDK

public class ExpoNativeWechatModule: Module {
    private var appid: String = ""

    private var logger = ExpoNativeWechatLogger(prefix: "[Native Wechat]")

    private var responseObserver: NSObjectProtocol?

    private func registerResponder() {
        responseObserver = NotificationCenter.default.addObserver(
            forName: Notification.Name("ResponseData"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let data = notification.userInfo as? [String: Any] else { return }
            self?.emit(event: "ResponseFromNotification", payload: data)
        }
    }

    public func definition() -> ModuleDefinition {
        Name("ExpoNativeWechat")

        OnCreate {
            registerResponder()
        }

        OnDestroy {
            if let observer = self.responseObserver {
                NotificationCenter.default.removeObserver(observer)
                self.responseObserver = nil
            }
        }

        Events("ResponseData", "ResponseFromNotification")

        Function("getConstants") {
            return [
                "WXSceneSession": WXSceneSession.rawValue,
                "WXSceneTimeline": WXSceneTimeline.rawValue,
                "WXSceneFavorite": WXSceneFavorite.rawValue,
                "WXMiniProgramTypeRelease": WXMiniProgramType.release.rawValue,
                "WXMiniProgramTypeTest": WXMiniProgramType.test.rawValue,
                "WXMiniProgramTypePreview": WXMiniProgramType.preview.rawValue,
            ]
        }

        AsyncFunction("registerApp") { (params: RegisterAppParams) -> Void in
            if params.log {
                if let logPrefix = params.logPrefix {
                    logger.logPrefix = logPrefix
                }

                WXApi.startLog(by: WXLogLevel.detail, logDelegate: logger)
            }

            appid = params.appid

            let success = WXApi.registerApp(appid, universalLink: params.universalLink)

            emit(event: "ResponseData", payload: ["success": success, "id": params.id])
        }.runOnQueue(.main)

        AsyncFunction("checkUniversalLinkReady") { (params: BasicRequestParams) -> Void in
            WXApi.checkUniversalLinkReady { step, result in
                if result.success {
                    if step == WXULCheckStep.final {
                        self.emit(
                            event: "ResponseData",
                            payload: [
                                "id": params.id,
                                "success": true,
                                "suggestion": "",
                                "errorInfo": "",
                            ])
                    }
                } else {
                    self.emit(
                        event: "ResponseData",
                        payload: [
                            "id": params.id,
                            "success": false,
                            "suggestion": result.suggestion,
                            "errorInfo": result.errorInfo,
                        ])
                }
            }
        }.runOnQueue(.main)

        AsyncFunction("isWechatInstalled") { (params: BasicRequestParams) -> Void in
            let installed = WXApi.isWXAppInstalled()

            emit(event: "ResponseData", payload: ["success": installed, "id": params.id])
        }.runOnQueue(.main)

        AsyncFunction("sendAuthRequest") { (params: SendAuthRequestParams) -> Void in
            let req = SendAuthReq()

            if let scope = params.scope {
                req.scope = scope
            }

            req.state = params.state

            WXApi.send(req) { success in
                self.emit(event: "ResponseData", payload: ["success": success, "id": params.id])
            }
        }.runOnQueue(.main)

        AsyncFunction("shareText") { (params: ShareTextParams) -> Void in
            let req = SendMessageToWXReq()

            req.bText = true
            req.text = params.text
            req.scene = Int32(params.scene)

            WXApi.send(req) { success in
                self.emit(event: "ResponseData", payload: ["success": success, "id": params.id])
            }
        }.runOnQueue(.main)

        AsyncFunction("shareImage") { (params: ShareImageParams) -> Void in
            guard let url = URL(string: params.src) else {
                self.emit(
                    event: "ResponseData",
                    payload: ["success": false, "id": params.id, "message": "Invalid image URL"])
                return
            }

            ExpoWechatUtils.downloadFile(url: url) { data in
                guard let imageData = data, !imageData.isEmpty else {
                    self.emit(
                        event: "ResponseData",
                        payload: ["success": false, "id": params.id, "message": "Image data is empty"])
                    return
                }

                let imageObject = WXImageObject()
                imageObject.imageData = imageData

                let message = WXMediaMessage()
                message.thumbData = ExpoWechatUtils.compressImage(data: imageData, limit: 32000)
                message.mediaObject = imageObject

                let req = SendMessageToWXReq()
                req.bText = false
                req.scene = Int32(params.scene)
                req.message = message

                WXApi.send(req) { success in
                    self.emit(event: "ResponseData", payload: ["success": success, "id": params.id])
                }
            } onError: { error in
                self.emit(
                    event: "ResponseData",
                    payload: [
                        "success": false, "id": params.id,
                        "message": error?.localizedDescription ?? "Unknown error",
                    ])
            }
        }.runOnQueue(.main)

        AsyncFunction("shareVideo") { (params: ShareVideoParams) -> Void in
            let videoObj = WXVideoObject()

            videoObj.videoUrl = params.videoUrl
            videoObj.videoLowBandUrl = params.videoLowBandUrl ?? ""

            let message = WXMediaMessage()

            message.title = params.title ?? ""
            message.description = params.description ?? ""
            message.mediaObject = videoObj

            let onCoverDownloaded: ((Data?) -> Void) = { data in
                if let imgData = data {
                    if let image = UIImage(data: imgData) {
                        message.setThumbImage(image)
                    }
                }

                let req = SendMessageToWXReq()
                req.bText = false
                req.message = message
                req.scene = Int32(params.scene)

                WXApi.send(req) { success in
                    self.emit(event: "ResponseData", payload: ["success": success, "id": params.id])
                }
            }

            if params.coverUrl != nil {
                guard let url = URL(string: params.coverUrl!) else {
                    self.emit(
                        event: "ResponseData",
                        payload: ["id": params.id, "success": false, "message": "Invalid cover URL"])
                    return
                }

                ExpoWechatUtils.downloadFile(url: url) { data in
                    if data != nil {
                        let compressed = ExpoWechatUtils.compressImage(data: data!, limit: 32000)

                        onCoverDownloaded(compressed)
                    } else {
                        onCoverDownloaded(nil)
                    }
                } onError: { error in
                    self.emit(
                        event: "ResponseData",
                        payload: ["id": params.id, "success": false, "message": error?.localizedDescription ?? "Download failed"])
                }

            } else {
                onCoverDownloaded(nil)
            }
        }.runOnQueue(.main)

        AsyncFunction("shareWebpage") { (params: ShareWebpageParams) -> Void in
            let webpackObj = WXWebpageObject()

            webpackObj.webpageUrl = params.webpageUrl

            let message = WXMediaMessage()

            message.title = params.title ?? ""
            message.description = params.description ?? ""
            message.mediaObject = webpackObj

            let onCoverDownloaded: ((Data?) -> Void) = { data in
                if let imgData = data {
                    if let image = UIImage(data: imgData) {
                        message.setThumbImage(image)
                    }
                }

                let req = SendMessageToWXReq()
                req.bText = false
                req.message = message
                req.scene = Int32(params.scene)

                WXApi.send(req) { success in
                    self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
                }
            }

            if params.coverUrl != nil {
                guard let url = URL(string: params.coverUrl!) else {
                    self.emit(
                        event: "ResponseData",
                        payload: ["id": params.id, "success": false, "message": "Invalid cover URL"])
                    return
                }

                ExpoWechatUtils.downloadFile(url: url) { data in
                    if data != nil {
                        let compressed = ExpoWechatUtils.compressImage(data: data!, limit: 32000)

                        onCoverDownloaded(compressed)
                    } else {
                        onCoverDownloaded(nil)
                    }
                } onError: { error in
                    self.emit(
                        event: "ResponseData",
                        payload: ["id": params.id, "success": false, "message": error?.localizedDescription ?? "Download failed"])
                }

            } else {
                onCoverDownloaded(nil)
            }
        }.runOnQueue(.main)

        AsyncFunction("shareMiniProgram") { (params: ShareMiniProgramParams) -> Void in
            let object = WXMiniProgramObject()

            object.userName = params.userName
            object.webpageUrl = params.webpageUrl
            object.path = params.path
            object.withShareTicket = params.withShareTicket ?? false
            guard (0...2).contains(params.miniProgramType),
                let miniProgramType = WXMiniProgramType(rawValue: UInt(params.miniProgramType)) else {
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": false, "message": "Invalid miniProgramType"])
                return
            }
            object.miniProgramType = miniProgramType

            let message = WXMediaMessage()

            message.title = params.title ?? ""
            message.description = params.description ?? ""
            message.mediaObject = object

            let onCoverDownloaded: ((Data?) -> Void) = { data in
                if let imgData = data {
                    if let image = UIImage(data: imgData) {
                        message.setThumbImage(image)
                    }
                }

                let req = SendMessageToWXReq()
                req.bText = false
                req.message = message
                req.scene = 0  // WXSceneSession

                WXApi.send(req) { success in
                    self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
                }
            }

            if params.coverUrl != nil {
                guard let url = URL(string: params.coverUrl!) else {
                    self.emit(
                        event: "ResponseData",
                        payload: ["id": params.id, "success": false, "message": "Invalid cover URL"])
                    return
                }

                ExpoWechatUtils.downloadFile(url: url) { data in
                    if data != nil {
                        let compressed = ExpoWechatUtils.compressImage(data: data!, limit: 32000)

                        onCoverDownloaded(compressed)
                    } else {
                        onCoverDownloaded(nil)
                    }
                } onError: { error in
                    self.emit(
                        event: "ResponseData",
                        payload: ["id": params.id, "success": false, "message": error?.localizedDescription ?? "Download failed"])
                }

            } else {
                onCoverDownloaded(nil)
            }
        }.runOnQueue(.main)

        AsyncFunction("requestPayment") { (params: RequestPaymentParams) -> Void in
            let request = PayReq()

            request.partnerId = params.partnerId
            request.prepayId = params.prepayId
            request.package = "Sign=WXPay"
            request.nonceStr = params.nonceStr

            // 安全的时间戳转换
            if let timeStamp = UInt32(params.timeStamp) {
                request.timeStamp = timeStamp
            } else {
                self.emit(
                    event: "ResponseData",
                    payload: ["id": params.id, "success": false, "message": "Invalid timestamp format"])
                return
            }

            request.sign = params.sign

            WXApi.send(request) { success in
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
            }
        }.runOnQueue(.main)

        AsyncFunction("requestSubscribeMessage") { (params: RequestSubscribeMsgParams) -> Void in
            let req = WXSubscribeMsgReq()

            req.scene = UInt32(params.scene)
            req.templateId = params.templateId
            req.reserved = params.reserved

            WXApi.send(req) { success in
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
            }
        }.runOnQueue(.main)

        AsyncFunction("launchMiniProgram") { (params: LaunchMiniprogramParams) -> Void in
            let req = WXLaunchMiniProgramReq()

            req.userName = params.userName
            req.path = params.path
            guard (0...2).contains(params.miniProgramType),
                let miniProgramType = WXMiniProgramType(rawValue: UInt(params.miniProgramType)) else {
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": false, "message": "Invalid miniProgramType"])
                return
            }
            req.miniProgramType = miniProgramType

            WXApi.send(req) { success in
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
            }
        }.runOnQueue(.main)

        AsyncFunction("openCustomerService") { (params: OpenCustomerServiceParams) -> Void in
            let req = WXOpenCustomerServiceReq()

            req.corpid = params.corpid
            req.url = params.url

            WXApi.send(req) { success in
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
            }
        }.runOnQueue(.main)

        AsyncFunction("appPureSignContract") { (params: AppPureSignContractParams) -> Void in
            let req = WXOpenBusinessWebViewReq()

            req.businessType = 12  // 固定值

            var queryInfoDic = [String: String]()
            queryInfoDic["pre_entrustweb_id"] = params.preEntrustwebId
            req.queryInfoDic = queryInfoDic

            WXApi.send(req) { success in
                self.emit(event: "ResponseData", payload: ["id": params.id, "success": success])
            }
        }.runOnQueue(.main)
    }
}
