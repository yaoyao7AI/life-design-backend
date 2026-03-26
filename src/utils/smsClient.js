import Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";

function maskSecret(value) {
  if (!value) return "未配置";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

// 创建短信 Client
function createClient() {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

  let config = new $OpenApi.Config({
    accessKeyId,
    accessKeySecret,
  });
  config.endpoint = `dysmsapi.aliyuncs.com`;
  // 使用 default 导出（实际是 Client 类）
  const Client = Dysmsapi20170525.default || Dysmsapi20170525;
  return new Client(config);
}

// 发送短信函数
export async function sendSMS(phone, code) {
  const signName = process.env.ALIYUN_SMS_SIGN;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE;
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

  console.log("[SMS] 开始发送短信，手机号:", phone);
  console.log("[SMS] 签名:", signName || "未配置");
  console.log("[SMS] 模板:", templateCode || "未配置");
  console.log("[SMS] AccessKeyId:", maskSecret(accessKeyId));

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    console.error("[SMS] ❌ 短信配置不完整（AK/SK/签名/模板 至少有一项缺失）");
    return {
      ok: false,
      reason: "CONFIG_MISSING",
      providerCode: "CONFIG_MISSING",
      message: "短信配置不完整",
    };
  }

  const client = createClient();

  const request = new $Dysmsapi20170525.SendSmsRequest({
    phoneNumbers: phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code }),
  });

  try {
    const response = await client.sendSms(request);
    console.log("[SMS] 阿里云短信返回：", JSON.stringify(response?.body || {}, null, 2));

    // 兼容大写 Code 和小写 code
    const responseCode = response?.body?.Code || response?.body?.code;
    const message = response?.body?.Message || response?.body?.message;
    
    if (responseCode === "OK") {
      console.log("[SMS] ✅ 短信发送成功");
      return {
        ok: true,
        providerCode: "OK",
      };
    } else {
      console.error("[SMS] ❌ 短信发送失败：", responseCode || "UNKNOWN", message || "无错误信息");
      return {
        ok: false,
        reason:
          responseCode === "isv.BUSINESS_LIMIT_CONTROL"
            ? "RATE_LIMIT"
            : "PROVIDER_ERROR",
        providerCode: responseCode || "UNKNOWN",
        message: message || "无错误信息",
      };
    }
  } catch (err) {
    console.error("[SMS] ❌ 发送短信异常：", err.message);
    console.error("[SMS] 错误详情：", err.data || err);
    const errorCode = err?.code || err?.data?.Code || err?.data?.code || "UNKNOWN";
    const errorMessage = err?.message || err?.data?.Message || err?.data?.message || "短信服务异常";
    return {
      ok: false,
      reason: errorCode === "isv.BUSINESS_LIMIT_CONTROL" ? "RATE_LIMIT" : "EXCEPTION",
      providerCode: errorCode,
      message: errorMessage,
    };
  }
}

