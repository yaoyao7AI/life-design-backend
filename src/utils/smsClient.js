import Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

// 创建短信 Client
function createClient() {
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
  console.log("[SMS] 开始发送短信，手机号:", phone, "验证码:", code);
  console.log("[SMS] 签名:", process.env.ALIYUN_SMS_SIGN);
  console.log("[SMS] 模板:", process.env.ALIYUN_SMS_TEMPLATE);
  console.log("[SMS] AccessKeyId:", process.env.ALIYUN_ACCESS_KEY_ID ? "已配置" : "未配置");
  
  const client = createClient();

  const request = new $Dysmsapi20170525.SendSmsRequest({
    phoneNumbers: phone,
    signName: process.env.ALIYUN_SMS_SIGN,
    templateCode: process.env.ALIYUN_SMS_TEMPLATE,
    templateParam: JSON.stringify({ code }),
  });

  try {
    const response = await client.sendSms(request);
    console.log("[SMS] 阿里云短信返回：", JSON.stringify(response.body, null, 2));

    // 兼容大写 Code 和小写 code
    const code = response.body.Code || response.body.code;
    const message = response.body.Message || response.body.message;
    
    if (code === "OK") {
      console.log("[SMS] ✅ 短信发送成功");
      return true;
    } else {
      console.error("[SMS] ❌ 短信发送失败：", code, message);
      return false;
    }
  } catch (err) {
    console.error("[SMS] ❌ 发送短信异常：", err.message);
    console.error("[SMS] 错误详情：", err.data || err);
    return false;
  }
}

