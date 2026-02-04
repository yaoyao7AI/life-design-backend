# 🎯 前端整合手机号登录 + JWT 流程完整指南

## ✅ 后端状态（已完成）

后端 API 已经完成并运行在：`http://localhost:3000`（本地）或你的服务器地址

**后端 API 端点：**
- `POST /api/auth/send-code` - 发送验证码
- `POST /api/auth/login` - 手机号+验证码登录
- `GET /api/auth/me` - 获取用户信息（需要 JWT）

---

## 📋 前端集成步骤

### **STEP 1 — 前端：创建 API 服务文件**

**位置：** `frontend/src/services/authApi.js` 或 `frontend/src/api/auth.js`

👉 **这是前端操作（React + Vite）**

```javascript
// frontend/src/services/authApi.js

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * 发送验证码
 * @param {string} phone - 手机号
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function sendVerificationCode(phone) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '发送验证码失败');
    }

    return data;
  } catch (error) {
    console.error('发送验证码错误:', error);
    throw error;
  }
}

/**
 * 手机号 + 验证码登录
 * @param {string} phone - 手机号
 * @param {string} code - 验证码
 * @returns {Promise<{success: boolean, token: string, userId: number}>}
 */
export async function loginWithCode(phone, code) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, code }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '登录失败');
    }

    return data;
  } catch (error) {
    console.error('登录错误:', error);
    throw error;
  }
}

/**
 * 获取当前用户信息（需要 JWT）
 * @param {string} token - JWT Token
 * @returns {Promise<{data: {id: number, phone: string, nickname: string|null, avatar: string|null}}>}
 */
export async function getCurrentUser(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '获取用户信息失败');
    }

    return data;
  } catch (error) {
    console.error('获取用户信息错误:', error);
    throw error;
  }
}
```

---

### **STEP 2 — 前端：创建 Token 管理工具**

**位置：** `frontend/src/utils/token.js` 或 `frontend/src/utils/auth.js`

👉 **这是前端操作**

```javascript
// frontend/src/utils/token.js

const TOKEN_KEY = 'life_design_token';
const USER_KEY = 'life_design_user';

/**
 * 保存 Token 到 localStorage
 */
export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 获取 Token
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 删除 Token
 */
export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * 保存用户信息
 */
export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * 获取用户信息
 */
export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * 检查是否已登录
 */
export function isAuthenticated() {
  return !!getToken();
}
```

---

### **STEP 3 — 前端：创建 Auth Context（全局状态管理）**

**位置：** `frontend/src/contexts/AuthContext.jsx` 或 `frontend/src/context/AuthContext.jsx`

👉 **这是前端操作**

```javascript
// frontend/src/contexts/AuthContext.jsx

import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, saveToken, removeToken, saveUser, getUser } from '../utils/token';
import { getCurrentUser, loginWithCode, sendVerificationCode } from '../services/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 初始化时检查是否已登录
  useEffect(() => {
    const token = getToken();
    if (token) {
      // 尝试获取用户信息验证 token
      getCurrentUser(token)
        .then((response) => {
          setUser(response.data);
          setIsAuthenticated(true);
          saveUser(response.data);
        })
        .catch(() => {
          // Token 无效，清除
          removeToken();
          setIsAuthenticated(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  /**
   * 发送验证码
   */
  const sendCode = async (phone) => {
    return await sendVerificationCode(phone);
  };

  /**
   * 登录
   */
  const login = async (phone, code) => {
    try {
      const response = await loginWithCode(phone, code);
      
      // 保存 token
      saveToken(response.token);
      
      // 获取用户信息
      const userResponse = await getCurrentUser(response.token);
      setUser(userResponse.data);
      saveUser(userResponse.data);
      setIsAuthenticated(true);
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * 登出
   */
  const logout = () => {
    removeToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    sendCode,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

### **STEP 4 — 前端：在 App.jsx 中包裹 AuthProvider**

**位置：** `frontend/src/App.jsx` 或 `frontend/src/main.jsx`

👉 **这是前端操作**

```javascript
// frontend/src/App.jsx

import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
// ... 其他导入

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* 你的路由组件 */}
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

---

### **STEP 5 — 前端：创建登录页面组件**

**位置：** `frontend/src/pages/Login.jsx` 或 `frontend/src/components/Login.jsx`

👉 **这是前端操作**

```javascript
// frontend/src/pages/Login.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { sendCode, login } = useAuth();
  const navigate = useNavigate();

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendCode(phone);
      setStep('code');
      setCountdown(60); // 60秒倒计时
    } catch (err) {
      setError(err.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  // 登录
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!code || code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(phone, code);
      navigate('/'); // 登录成功后跳转
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>手机号登录</h2>

      {error && <div className="error-message">{error}</div>}

      {step === 'phone' ? (
        <div>
          <input
            type="tel"
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={11}
          />
          <button onClick={handleSendCode} disabled={loading || countdown > 0}>
            {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          <div>
            <p>验证码已发送至 {phone}</p>
            <input
              type="text"
              placeholder="请输入6位验证码"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          <button type="button" onClick={() => setStep('phone')}>
            返回
          </button>
        </form>
      )}
    </div>
  );
}
```

---

### **STEP 6 — 前端：创建受保护的路由组件**

**位置：** `frontend/src/components/ProtectedRoute.jsx`

👉 **这是前端操作**

```javascript
// frontend/src/components/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>加载中...</div>; // 或你的加载组件
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

---

### **STEP 7 — 前端：创建 HTTP 请求拦截器（自动携带 Token）**

**位置：** `frontend/src/utils/axios.js` 或 `frontend/src/utils/fetch.js`

👉 **这是前端操作**

```javascript
// frontend/src/utils/fetch.js

import { getToken } from './token';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * 封装 fetch，自动携带 Token
 */
export async function apiFetch(url, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  // 如果 token 过期，清除并跳转登录
  if (response.status === 401) {
    localStorage.removeItem('life_design_token');
    window.location.href = '/login';
    throw new Error('登录已过期');
  }

  return response;
}
```

---

### **STEP 8 — 前端：配置环境变量**

**位置：** `frontend/.env` 或 `frontend/.env.local`

👉 **这是前端操作**

```env
# 后端 API 地址
VITE_API_BASE_URL=http://localhost:3000

# 生产环境使用你的服务器地址
# VITE_API_BASE_URL=https://your-server.com
```

---

## 🎯 使用示例

### 在任何组件中使用认证：

```javascript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>请先登录</div>;
  }

  return (
    <div>
      <p>欢迎，{user?.phone}</p>
      <button onClick={logout}>登出</button>
    </div>
  );
}
```

---

## ✅ 完成检查清单

- [ ] 创建 `authApi.js` - API 服务文件
- [ ] 创建 `token.js` - Token 管理工具
- [ ] 创建 `AuthContext.jsx` - 全局认证状态
- [ ] 在 `App.jsx` 中包裹 `AuthProvider`
- [ ] 创建 `Login.jsx` - 登录页面
- [ ] 创建 `ProtectedRoute.jsx` - 受保护路由
- [ ] 创建 `fetch.js` - HTTP 请求工具
- [ ] 配置 `.env` - 环境变量
- [ ] 测试登录流程

---

## 🧪 测试步骤

1. **启动后端服务器**（如果还没启动）
   ```bash
   cd life-design-backend
   npm run dev
   ```

2. **启动前端项目**
   ```bash
   cd frontend
   npm run dev
   ```

3. **测试登录流程**
   - 访问登录页面
   - 输入手机号，点击发送验证码
   - 输入收到的验证码
   - 登录成功后应该跳转并保持登录状态

---

## 📝 注意事项

1. **CORS 配置**：确保后端已配置 CORS，允许前端域名访问
2. **Token 安全**：生产环境考虑使用 httpOnly cookie 存储 token
3. **错误处理**：根据实际需求完善错误提示
4. **路由守卫**：在需要登录的页面使用 `ProtectedRoute`

---

## 🎉 完成！

现在你的前端已经完全整合了手机号登录 + JWT 流程，不再依赖 Supabase！



