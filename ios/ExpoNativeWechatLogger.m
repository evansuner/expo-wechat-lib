//
//  ExpoNativeWechatLogger.m
//  ExpoNativeWechat
//
//  Created by Evan on 2/8/25.
//

#import "ExpoNativeWechatLogger.h"

@implementation ExpoNativeWechatLogger

- (instancetype)initWithPrefix:(NSString *)prefix {
  self = [self init];

  if (self) {
    _logPrefix = prefix;
  }

  return self;
}

- (void)onLog:(nonnull NSString *)log logLevel:(WXLogLevel)level {
  NSLog(@"%@ [LOG]: %@", _logPrefix, log);
}

@end
