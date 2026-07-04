import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import feedbackHandler from './api/feedback';
import feedbackIdHandler from './api/feedback/[id]';
import notifyActivationHandler from './api/notify-activation';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files and populate process.env
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: 'api-middleware',
        configureServer(server) {
          const apiMiddleware = async (req: any, res: any, next: any) => {
            const url = req.url || '';
            
            // Match /api/feedback and /api/notify-activation paths
            if (url.startsWith('/api/feedback') || url.startsWith('/api/notify-activation')) {
              try {
                const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
                const pathname = parsedUrl.pathname;
                
                // Build query params
                const query: Record<string, string> = {};
                parsedUrl.searchParams.forEach((val, key) => {
                  query[key] = val;
                });
                (req as any).query = query;

                // Set up a mock response object mirroring Vercel's Serverless API surface
                const mockRes = {
                  statusCode: 200,
                  headers: {} as Record<string, string>,
                  setHeader(name: string, value: string) {
                    this.headers[name] = value;
                    res.setHeader(name, value);
                  },
                  status(code: number) {
                    this.statusCode = code;
                    res.statusCode = code;
                    return this;
                  },
                  json(data: any) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                  end(data?: any) {
                    res.end(data);
                  }
                };

                const handlerFn = typeof feedbackHandler === 'function' 
                  ? feedbackHandler 
                  : (feedbackHandler as any).default;
                const idHandlerFn = typeof feedbackIdHandler === 'function' 
                  ? feedbackIdHandler 
                  : (feedbackIdHandler as any).default;

                const executeRoute = async () => {
                  if (pathname === '/api/feedback' || pathname === '/api/feedback/') {
                    await handlerFn(req, mockRes);
                  } else if (pathname.startsWith('/api/feedback/')) {
                    const parts = pathname.split('/');
                    const id = parts[parts.length - 1] || parts[parts.length - 2];
                    (req as any).query.id = id;
                    await idHandlerFn(req, mockRes);
                  } else if (pathname === '/api/notify-activation' || pathname === '/api/notify-activation/') {
                    const notifyFn = typeof notifyActivationHandler === 'function'
                      ? notifyActivationHandler
                      : (notifyActivationHandler as any).default;
                    await notifyFn(req, mockRes);
                  } else {
                    next();
                  }
                };

                // GET & OPTIONS requests have no bodies - execute routing immediately
                if (req.method === 'GET' || req.method === 'OPTIONS') {
                  await executeRoute();
                } else {
                  // Parse req body stream for POST/PATCH
                  let bodyData = '';
                  req.on('data', (chunk: any) => {
                    bodyData += chunk;
                  });

                  req.on('end', async () => {
                    try {
                      if (bodyData && (req.headers['content-type'] || '').includes('application/json')) {
                        (req as any).body = JSON.parse(bodyData);
                      } else {
                        (req as any).body = bodyData;
                      }
                    } catch (e) {
                      (req as any).body = bodyData;
                    }
                    await executeRoute();
                  });
                }

              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: `Middleware error: ${err.message}` }));
              }
            } else {
              next();
            }
          };

          // Prepend to connect middleware pipeline to execute before Vite's default route compilation
          server.middlewares.stack.unshift({
            route: '',
            handle: apiMiddleware as any
          });
        }
      }
    ],
    server: {
      port: 3000,
      host: true,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
  };
});
