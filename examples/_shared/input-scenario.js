import fs from 'node:fs/promises';
import path from 'node:path';
import { captureSurface } from './validation.js';

const ACTIONS = new Set(['pointer', 'key', 'capture']);

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function loadScenario(file) {
  const document = JSON.parse(await fs.readFile(file, 'utf8'));
  const steps = Array.isArray(document) ? document : document.steps;
  if (!Array.isArray(steps) || !steps.length) throw new TypeError(`${path.basename(file)} must contain a non-empty steps array.`);
  for (const [index, step] of steps.entries()) {
    if (!step || !ACTIONS.has(step.action)) throw new TypeError(`Unsupported scenario action at index ${index}.`);
    if (step.action === 'capture' && (typeof step.name !== 'string' || !step.name)) {
      throw new TypeError(`Capture step ${index} requires a name.`);
    }
    if (step.action !== 'capture' && (!step.event || typeof step.event !== 'object')) {
      throw new TypeError(`Input step ${index} requires an event.`);
    }
  }
  return Object.freeze({ name: document.name ?? path.basename(file, '.json'), steps: Object.freeze(steps) });
}

export async function replayScenario(app, scenario, outputDirectory) {
  const captures = [];
  const frames = new Map();
  const events = [];
  for (const [index, step] of scenario.steps.entries()) {
    if (step.action === 'pointer') await app.pointer(step.event);
    else if (step.action === 'key') await app.key(step.event);
    else {
      const file = path.join(outputDirectory, `${step.name}.png`);
      const { frame, record } = await captureSurface(app.surface, file);
      frames.set(step.name, frame);
      captures.push(Object.freeze({
        name: step.name,
        sequence: app.surface.sequence,
        state: app.snapshot(),
        ...record
      }));
    }
    events.push(Object.freeze({
      index,
      action: step.action,
      sequence: app.surface.sequence,
      event: step.event ? clonePlain(step.event) : undefined,
      capture: step.name
    }));
  }
  return { captures, frames, events };
}

export function captureByName(result, name) {
  const capture = result.captures.find(item => item.name === name);
  if (!capture) throw new Error(`Scenario did not create capture ${name}.`);
  return capture;
}
