//
//  ResponseHandler.m
//  ExpoNativeWechat
//
//  Created by Evan on 2/8/25.
//

#import "ResponseHandler.h"
#import "RespDataHelper.h"

@implementation ResponseHandler

- (void)onResp:(BaseResp *)resp {
    
    NSDictionary* convertedData = [RespDataHelper downcastResp:resp];
    
    NSNotificationCenter* center = [NSNotificationCenter defaultCenter];
    
    [center postNotificationName:@"ResponseData" object:nil userInfo:convertedData];
}

@end
