// Disposable MCP probe, not an ASP executor or production MCP implementation.

import { appendFileSync } from 'node:fs';
import { calculate, tool } from './calculator.mjs';

appendFileSync(
  new URL('./mcp-events.jsonl', import.meta.url),
  `${JSON.stringify({ method: 'started' })}\n`,
);

let pending = '';
let calls = 0;
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  pending += chunk;
  if (Buffer.byteLength(pending) > 16384) process.exit(1);
  while (pending.includes('\n')) {
    const end = pending.indexOf('\n');
    const line = pending.slice(0, end);
    pending = pending.slice(end + 1);
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      process.exit(1);
    }
    if (request.id === undefined) continue;
    appendFileSync(
      new URL('./mcp-events.jsonl', import.meta.url),
      `${JSON.stringify({ method: request.method })}\n`,
    );
    let result;
    try {
      switch (request.method) {
        case 'initialize':
          result = {
            protocolVersion: request.params.protocolVersion,
            capabilities: { tools: {} },
            serverInfo: { name: 'calcu-preflight', version: '0.1.0' },
          };
          break;
        case 'ping':
          result = {};
          break;
        case 'tools/list':
          result = { tools: [tool] };
          break;
        case 'tools/call': {
          if (++calls > 3 || request.params.name !== tool.name)
            throw new Error('denied');
          const output = calculate(request.params.arguments);
          result = {
            content: [{ type: 'text', text: JSON.stringify(output) }],
          };
          break;
        }
        default:
          throw new Error('unsupported_method');
      }
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`,
      );
    } catch {
      process.stdout.write(
        `${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32602, message: 'Request rejected' } })}\n`,
      );
    }
  }
});
