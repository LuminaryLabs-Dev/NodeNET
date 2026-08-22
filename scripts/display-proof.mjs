import path from 'node:path';
import { runDisplayProof } from '../examples/display-calculator/calculator.js';

const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'artifacts/display';
if (!output) throw new TypeError('--output requires a directory.');
const verification = await runDisplayProof(path.resolve(output));
process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
