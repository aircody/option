/**
 * LongPort API 代理服务器
 * 用于解决浏览器 CORS 和网络连接问题
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const TARGET_HOST = 'openapi.longportapp.com';

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
  console.log('[Proxy] Headers:', JSON.stringify(req.headers, null, 2));

  // 准备转发到 LongPort API 的选项
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST,
    },
    timeout: 30000, // 30秒超时
  };

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
    console.error('[Proxy] Error Stack:', err.stack);
    
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Proxy Error',
      message: err.message,
      code: err.code,
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
