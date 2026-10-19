package expo.modules.nativewechat

import android.os.Bundle
import androidx.core.os.bundleOf
import com.tencent.mm.opensdk.constants.ConstantsAPI
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelbiz.WXLaunchMiniProgram
import com.tencent.mm.opensdk.modelmsg.SendAuth


object NativeWechatRespDataHelper {

    fun downcastResp(baseResp: BaseResp?): Bundle {
        if (baseResp == null)
            return bundleOf()

        val type = when (baseResp.type) {
            ConstantsAPI.COMMAND_SENDAUTH -> "SendAuthResp"
            ConstantsAPI.COMMAND_LAUNCH_WX_MINIPROGRAM -> "WXLaunchMiniProgramResp"
            ConstantsAPI.COMMAND_PAY_BY_WX -> "PayResp"
            else -> baseResp.javaClass.name
        }
        val argument = bundleOf()

        if (baseResp.type == ConstantsAPI.COMMAND_SENDAUTH) {
            val resp = baseResp as SendAuth.Resp

            argument.putString("code", resp.code)
            argument.putString("state", resp.state)
            argument.putString("lang", resp.lang)
            argument.putString("country", resp.country)
        }

        if (baseResp.type == ConstantsAPI.COMMAND_LAUNCH_WX_MINIPROGRAM) {
            val resp = baseResp as WXLaunchMiniProgram.Resp

            argument.putString("extMsg", resp.extMsg)
        }

        return wrapResponse(baseResp, argument, type)
    }

    private fun wrapResponse(
        baseResp: BaseResp,
        data: Bundle,
        type: String
    ): Bundle {
        return bundleOf(
            "type" to type,
            "errorCode" to baseResp.errCode,
            "errorStr" to baseResp.errStr,
            "transaction" to baseResp.transaction,
            "data" to data
        )
    }
}
