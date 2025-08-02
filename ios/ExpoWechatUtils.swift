//
//  ExpoWechatUtils.swift
//  ExpoNativeWechat
//
//  Created by Evan on 2/8/25.
//

import Foundation
import UIKit

struct ExpoWechatUtils {
    static func downloadFile(
        url: URL, onSuccess: @escaping (Data?) -> Void, onError: @escaping (Error?) -> Void
    ) {
        let request = URLRequest(url: url)

        let configuration = URLSessionConfiguration.default
        let session = URLSession(configuration: configuration)

        let task = session.dataTask(with: request) { data, response, error in
            if let error = error {
                onError(error)
            } else {
                onSuccess(data)
            }
        }

        task.resume()
    }

    static func compressImage(data: Data, limit: Int) -> Data? {
        guard let image = UIImage(data: data) else {
            return data
        }

        var compression: CGFloat = 1.0
        var compressedData = image.jpegData(compressionQuality: compression)

        guard let initialData = compressedData else {
            return data
        }

        while initialData.count > limit && compression > 0 {
            compression -= 0.1
            if let newData = image.jpegData(compressionQuality: compression) {
                compressedData = newData
            } else {
                break
            }
        }

        return compressedData
    }

    static func convertToSwiftDictionary(data: NSDictionary) -> [String: Any?] {
        var dict: [String: Any?] = [:]

        for key in data.allKeys {
            if let keyString = key as? String {
                let value = data[key]
                dict[keyString] = value
            }
        }

        return dict
    }

    // 新增：处理图片下载和压缩的通用方法
    static func downloadAndCompressImage(
        url: String,
        compressionLimit: Int = 32000,
        completion: @escaping (Data?) -> Void,
        onError: @escaping (String) -> Void
    ) {
        guard let imageUrl = URL(string: url) else {
            onError("Invalid image URL")
            return
        }

        downloadFile(url: imageUrl) { data in
            guard let imageData = data else {
                completion(nil)
                return
            }

            let compressedData = compressImage(data: imageData, limit: compressionLimit)
            completion(compressedData)
        } onError: { error in
            onError(error?.localizedDescription ?? "Download failed")
        }
    }
}
