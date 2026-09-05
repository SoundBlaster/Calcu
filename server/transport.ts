import type { ClientRequest } from 'node:http';
import { type RequestOptions, request } from 'node:https';
import { URL } from 'node:url';
import type { Transport } from './executor';

export const MAX_BODY_BYTES = 8192;
export const MAX_RESPONSE_BYTES = 8192;

export type HttpsTransportOptions = {
  endpoint: string | URL;
  /** Pinned CA/certificate for this development transport. */
  ca: string | Buffer;
  timeoutMs?: number;
};

function ensureEndpoint(endpoint: string | URL) {
  const url = endpoint instanceof URL ? new URL(endpoint) : new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/agent-actions' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('transport_endpoint_invalid');
  return url;
}

function errorWithCode(code: string) {
  return new Error(code);
}

export function createAuthenticatedHttpsTransport(
  options: HttpsTransportOptions,
): Transport {
  const endpoint = ensureEndpoint(options.endpoint);
  const timeoutMs = options.timeoutMs ?? 2_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000)
    throw new Error('transport_timeout_invalid');

  return (credential, body, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(errorWithCode('aborted'));
        return;
      }
      if (
        typeof body !== 'string' ||
        Buffer.byteLength(body) > MAX_BODY_BYTES
      ) {
        reject(errorWithCode('schema_invalid'));
        return;
      }

      let req: ClientRequest;
      let settled = false;
      const onAbort = () => {
        req.destroy();
        rejectCode('aborted');
      };
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };
      const settleResolve = (value: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const rejectCode = (code: string) => settleReject(errorWithCode(code));

      const requestOptions: RequestOptions = {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port,
        path: endpoint.pathname,
        method: 'POST',
        ca: options.ca,
        rejectUnauthorized: true,
        headers: {
          authorization: `Bearer ${credential}`,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          accept: 'application/json',
          'cache-control': 'no-store',
        },
      };
      req = request(requestOptions, (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.byteLength;
          if (size > MAX_RESPONSE_BYTES) {
            response.destroy();
            req.destroy();
            rejectCode('response_too_large');
            return;
          }
          chunks.push(buffer);
        });
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode !== 200) {
            try {
              const parsed = JSON.parse(text) as {
                error?: { code?: unknown };
              };
              const code =
                typeof parsed.error?.code === 'string'
                  ? parsed.error.code
                  : 'transport_error';
              rejectCode(code);
            } catch {
              rejectCode('transport_error');
            }
            return;
          }
          if (
            response.headers['content-type']?.split(';')[0].toLowerCase() !==
            'application/json'
          ) {
            rejectCode('invalid_response');
            return;
          }
          settleResolve(text);
        });
        response.on('error', () => rejectCode('transport_error'));
      });
      signal?.addEventListener('abort', onAbort, { once: true });
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        rejectCode('transport_timeout');
      });
      req.on('error', () => rejectCode('transport_error'));
      req.write(body);
      req.end();
    });
}
