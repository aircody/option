/**
 * LongPort API 代理服务器
 * 用于解决浏览器 CORS 和网络连接问题
 */

import http from 'http';
import https from 'https';
import url from 'url';

const PORT = 3001;
const TARGET_HOST = 'openapi.longbridge.com';

// 创建 HTTPS agent 配置
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  rejectUnauthorized: true,
  // 支持 TLS 1.2 和 1.3
  secureProtocol: 'TLSv1_2_method',
  // 设置超时
  timeout: 30000,
});

const server = http.createServer((req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key, X-Api-Timestamp, X-Api-Signature');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 解析请求路径
  const parsedUrl = url.parse(req.url, true);
  const targetPath = parsedUrl.pathname + (parsedUrl.search || '');

  console.log(`[Proxy] ${req.method} ${targetPath}`);
  console.log('[Proxy] Target Host:', TARGET_HOST);

  // 准备转发到 LongPort API 的选项
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST,
      // 移除可能导致问题的头
      'sec-fetch-site': undefined,
      'sec-fetch-mode': undefined,
      'sec-fetch-dest': undefined,
      'origin': undefined,
    },
    agent: httpsAgent,
    timeout: 30000, // 30秒超时
  };

  // 清理 undefined 值
  Object.keys(options.headers).forEach(key => {
    if (options.headers[key] === undefined) {
      delete options.headers[key];
    }
  });

  console.log('[Proxy] Request Headers:', JSON.stringify(options.headers, null, 2));

  // 创建到目标服务器的请求
  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[Proxy] Response: ${proxyRes.statusCode}`);
    console.log('[Proxy] Response Headers:', JSON.stringify(proxyRes.headers, null, 2));

    // 设置响应状态码和头
    res.writeHead(proxyRes.statusCode, proxyRes.headers);

    // 转发响应体
    proxyRes.pipe(res);
  });

  // 处理错误
  proxyReq.on('error', (err) => {
    console.error('[Proxy] Error:', err.message);
    console.error('[Proxy] Error Code:', err.code);
    console.error('[Proxy] Error Stack:', err.stack);
    
    let statusCode = 502;
    let errorMessage = 'Proxy Error';
    
    if (err.code === 'ECONNRESET') {
      statusCode = 502;
      errorMessage = 'Connection reset by server. This may be due to TLS/SSL issues or the server rejecting the connection.';
    } else if (err.code === 'ETIMEDOUT') {
      statusCode = 504;
      errorMessage = 'Connection timed out. The server is not reachable.';
    } else if (err.code === 'ENOTFOUND') {
      statusCode = 502;
      errorMessage = 'DNS lookup failed. The server address could not be resolved.';
    }
    
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Proxy Error',
      message: errorMessage,
      code: err.code,
      details: err.message,
    }));
  });

  // 处理超时
  proxyReq.on('timeout', () => {
    console.error('[Proxy] Request timeout');
    proxyReq.destroy();
    
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Gateway Timeout',
      message: 'Request to LongPort API timed out',
    }));
  });

  // 处理请求被中止
  proxyReq.on('abort', () => {
    console.error('[Proxy] Request aborted');
  });

  // 转发请求体
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`LongPort API Proxy Server running on http://localhost:${PORT}`);
  console.log(`Forwarding requests to https://${TARGET_HOST}`);
  console.log('Press Ctrl+C to stop');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\nShutting down proxy server...');
  server.close(() => {
    console.log('Proxy server closed');
    process.exit(0);
  });
});
