// 测试认证 API 的脚本
const API_BASE = "http://localhost:3000";

async function testAuth() {
  const phone = "13800138000";
  let code = null;

  console.log("🧪 开始测试认证流程...\n");

  // 1. 发送验证码
  console.log("1️⃣ 发送验证码...");
  try {
    const response = await fetch(`${API_BASE}/api/auth/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json();
    console.log("✅ 响应:", data);
    
    // 注意：在实际环境中，验证码会通过短信发送
    // 这里我们需要从服务器日志中获取，或者使用一个测试验证码
    console.log("\n⚠️  请查看服务器日志获取验证码，或使用已知的验证码进行测试\n");
  } catch (err) {
    console.error("❌ 错误:", err.message);
    return;
  }

  // 2. 登录（需要手动输入验证码）
  console.log("2️⃣ 登录测试（需要验证码）...");
  console.log("请在服务器日志中找到验证码，然后运行：");
  console.log(`curl -X POST http://localhost:3000/api/auth/login \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"phone":"${phone}","code":"验证码"}'`);
}

testAuth();



