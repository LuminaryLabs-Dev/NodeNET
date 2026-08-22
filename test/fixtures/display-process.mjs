import { encodeFrame, FrameDecoder } from '../../src/index.js';

const width = 4;
const height = 2;
const stride = width * 4;
const pixels = Buffer.alloc(stride * height);
for (let offset = 0; offset < pixels.length; offset += 4) {
  pixels[offset] = 24;
  pixels[offset + 1] = 48;
  pixels[offset + 2] = 96;
  pixels[offset + 3] = 255;
}

function event(name, payload, bytes = Buffer.alloc(0)) {
  process.stdout.write(encodeFrame({ version: 1, event: name, surface: 'surface:1', payload }, bytes));
}

function response(request, result, callback) {
  process.stdout.write(encodeFrame({ version: 1, id: request.id, ok: true, result }), callback);
}

const decoder = new FrameDecoder();
process.stdin.on('data', chunk => {
  for (const { message } of decoder.push(chunk)) {
    if (message.op === 'display.connect') {
      response(message, { connected: true });
      event('display.ready', { width, height, stride, format: 'rgba8', controls: { test: { x: 1, y: 1 } } });
      event('display.frame', { width, height, stride, format: 'rgba8', metadata: { display: '0' } }, pixels);
    } else if (message.op === 'display.pointer') {
      pixels[0] = 200;
      event('display.frame', { width, height, stride, format: 'rgba8', metadata: { display: '1' } }, pixels);
      response(message, { state: { display: '1' } });
    } else if (message.op === 'display.dispose') {
      response(message, { disposed: true }, () => process.exit(0));
    } else {
      response(message, { accepted: true });
    }
  }
});
