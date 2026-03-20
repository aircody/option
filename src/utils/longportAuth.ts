/**
 * LongPort OpenAPI 认证工具
 * 参考文档: https://open.longportapp.cn/zh-CN/docs
 */

/**
 * 生成 HMAC-SHA256 签名 (Base64 编码)
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );
  
  // 转换为 Base64 编码
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64Signature;
}

/**
 * 生成 LongPort API 签名
 * 
 * 签名格式: base64(hmac-sha256(app_secret, timestamp + method + uri + body))
 * 
 * @param appSecret 应用密钥
 * @param timestamp 时间戳（毫秒）
 * @param method HTTP 方法 (GET, POST, etc.)
 * @param uri 请求路径
 * @param body 请求体 (可选)
 */
export async function generateSignature(
  appSecret: string,
  timestamp: string,
  method: string,
  uri: string,
  body?: string
): Promise<string> {
  const message = body 
    ? `${timestamp}${method.toUpperCase()}${uri}${body}`
    : `${timestamp}${method.toUpperCase()}${uri}`;
  
  const signature = await hmacSha256(appSecret, message);
  return signature;
}

/**
 * 生成请求头
 */
export async function generateHeaders(
  appKey: string,
  appSecret: string,
  accessToken: string,
  method: string,
  uri: string,
  body?: string
): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const signature = await generateSignature(appSecret, timestamp, method, uri, body);
  
  return {
    'X-Api-Key': appKey,
    'X-Api-Timestamp': timestamp,
    'X-Api-Signature': signature,
    'Authorization': accessToken,
    'Content-Type': 'application/json',
  };
}

/**
 * 发送 LongPort API 请求
 * 使用 Python 后端服务
 */
export async function longportRequest<T>(
  _baseUrl: string,
  appKey: string,
  appSecret: string,
  accessToken: string,
  method: string,
  uri: string,
  body?: unknown
): Promise<T> {
  const bodyString = body ? JSON.stringify(body) : undefined;
  
  // 使用 Python 后端服务
  const pythonBackendUrl = 'http://localhost:5000';
  const url = `${pythonBackendUrl}${uri}`;
  
  // 准备请求头（Python 后端使用不同的认证方式）
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': appKey,
    'X-Api-Secret': appSecret,
    'Authorization': accessToken,
  };
  
  console.log('[LongPort API] Request via Python Backend:', { method, url, headers });
  
  const response = await fetch(url, {
    method,
    headers,
    body: bodyString,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LongPort API] Error:', response.status, errorText);
    throw new Error(`API请求失败: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  console.log('[LongPort API] Response:', data);
  return data;
}
