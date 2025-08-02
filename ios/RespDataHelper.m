#import "RespDataHelper.h"

@implementation RespDataHelper

+ (NSDictionary *)downcastResp:(BaseResp *)baseResp {
  NSMutableDictionary *argument = [[NSMutableDictionary alloc] init];

  if (!baseResp.errCode) {
    if ([baseResp isKindOfClass:[SendAuthResp class]]) {
      SendAuthResp *resp = (SendAuthResp *)baseResp;

      [argument setObject:resp.code forKey:@"code"];
      [argument setObject:resp.state forKey:@"state"];

      if (resp.lang)
        [argument setObject:resp.lang forKey:@"lang"];

      if (resp.country)
        [argument setObject:resp.country forKey:@"country"];
    }

    if ([baseResp isKindOfClass:[WXLaunchMiniProgramResp class]]) {
      WXLaunchMiniProgramResp *resp = (WXLaunchMiniProgramResp *)baseResp;

      [argument setObject:resp.extMsg forKey:@"extMsg"];
    }
  }

  NSDictionary *response = [self wrapperResponse:baseResp data:argument];

  return response;
}

+ (NSDictionary *)wrapperResponse:(BaseResp *)baseResp
                             data:(NSMutableDictionary *)data {
  NSDictionary *argument = @{
    @"type" : NSStringFromClass([baseResp class]),
    @"errorCode" : @(baseResp.errCode),
    @"errorStr" : baseResp.errStr ?: @"",
    @"data" : data ?: @{}
  };

  return argument;
}

@end
