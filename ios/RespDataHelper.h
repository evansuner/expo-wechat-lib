#import <Foundation/Foundation.h>
#import <WechatOpenSDK/WXApi.h>

@interface RespDataHelper: NSObject

+ (NSDictionary *)downcastResp: (BaseResp *)baseResp;

@end
