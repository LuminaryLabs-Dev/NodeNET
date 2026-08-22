import { NodeNetError } from '../errors.js';
import { SERVICE } from './names.js';

const REQUIRED_METHODS = Object.freeze({
  [SERVICE.HOST]: ['detect'],
  [SERVICE.EXECUTION]: ['exec', 'spawn'],
  [SERVICE.ENVIRONMENT]: ['ensure'],
  [SERVICE.PROJECT]: ['inspect', 'prepare', 'restore', 'build', 'test', 'publish', 'clean', 'run'],
  [SERVICE.INTEROP]: ['openLibrary'],
  [SERVICE.DISPLAY]: ['capabilities', 'createSurface'],
  [SERVICE.CAPABILITIES]: ['snapshot']
});

export function serviceContract(capability) {
  return REQUIRED_METHODS[capability] ? [...REQUIRED_METHODS[capability]] : null;
}

export function validateServiceContract(capability, service) {
  const required = REQUIRED_METHODS[capability];
  if (!required) return true;
  const missing = required.filter(name => typeof service?.[name] !== 'function');
  if (capability === SERVICE.EXECUTION) {
    if (typeof service?.kind !== 'string' || !service.kind) missing.push('kind:string');
    if (typeof service?.sandboxed !== 'boolean') missing.push('sandboxed:boolean');
  }
  if (missing.length) {
    throw new NodeNetError(`Service provider does not satisfy the ${capability} contract.`, {
      code: 'SERVICE_CONTRACT_FAILED',
      details: { capability, missing }
    });
  }
  return true;
}
