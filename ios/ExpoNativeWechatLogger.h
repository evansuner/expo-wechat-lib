//
//  ExpoNativeWechatLogger.h
//  Pods
//
//  Created by Evan on 2/8/25.
//

#import <Foundation/Foundation.h>
#import "WXApi.h"

@interface ExpoNativeWechatLogger : NSObject<WXApiLogDelegate>

@property (nonatomic, nonnull) NSString* logPrefix;

- (nonnull instancetype)initWithPrefix:(nonnull NSString *) prefix;

@end
