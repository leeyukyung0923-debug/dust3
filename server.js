import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. .env.local 파일 자동 로드
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
  console.log('[서버] .env.local 환경변수를 성공적으로 로드했습니다.');
}

const PORT = 3000;

// MIME 타입 매핑 테이블
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

// Vercel 서버리스 핸들러 동적 import
let dustHandler = null;
try {
  const dustModule = await import('./api/dust.js');
  dustHandler = dustModule.default;
} catch (err) {
  console.error('[서버] api/dust.js 로드 실패:', err);
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 2. /api/dust 서버리스 함수 라우팅
  if (pathname === '/api/dust') {
    if (!dustHandler) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'api/dust.js 핸들러를 찾을 수 없습니다.' }));
      return;
    }

    // Vercel Serverless Function 호환 래퍼 제공
    req.query = Object.fromEntries(reqUrl.searchParams.entries());

    res.status = function (statusCode) {
      this.statusCode = statusCode;
      return this;
    };

    res.json = function (data) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
      return this;
    };

    try {
      await dustHandler(req, res);
    } catch (handlerErr) {
      console.error('[API 에러]', handlerErr);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '서버 내부 처리 중 오류가 발생했습니다.', message: handlerErr.message }));
      }
    }
    return;
  }

  // 3. 정적 파일 서빙 (index.html, style.css, script.js 등)
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(__dirname, filePath));

  // 보안: 디렉토리 트래버설 방지
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('접근이 거부되었습니다.');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('요청하신 파일을 찾을 수 없습니다.');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`대기오염 대시보드 로컬 서버가 시작되었습니다!`);
  console.log(`브라우저에서 접속: http://localhost:${PORT}`);
  console.log(`API 테스트: http://localhost:${PORT}/api/dust?sido=서울`);
  console.log(`=========================================`);
});

