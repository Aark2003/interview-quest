import { createServer } from 'node:http';
import { GET as quizStatus, POST as quizPost } from '../app/api/quiz/route';
import { GET as questionsGet } from '../app/api/questions/route';
import { POST as transcribePost } from '../app/api/transcribe/route';

const port = Number(process.env.PORT || 10000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || '*';

function headers() {
  return {
    'Access-Control-Allow-Origin': frontendOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    Vary: 'Origin',
  };
}

async function dispatch(req: import('node:http').IncomingMessage, body: string) {
  const host = req.headers.host || `localhost:${port}`;
  const url = new URL(req.url || '/', `http://${host}`);
  const init: RequestInit = {
    method: req.method,
    headers: { 'content-type': req.headers['content-type'] || '' },
    body: req.method === 'POST' ? body : undefined,
  };
  const request = new Request(url, init);
  if (url.pathname === '/api/quiz')
    return req.method === 'GET' ? quizStatus() : quizPost(request);
  if (url.pathname === '/api/questions' && req.method === 'GET')
    return questionsGet(request);
  if (url.pathname === '/api/transcribe' && req.method === 'POST')
    return transcribePost(request);
  return Response.json({ error: 'Not found' }, { status: 404 });
}

createServer(async (req, res) => {
  Object.entries(headers()).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    const response = await dispatch(req, body);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'The backend could not complete this request.' }));
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Interview Quest backend listening on ${port}`);
});
