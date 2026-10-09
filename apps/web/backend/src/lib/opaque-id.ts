import { randomBytes } from 'node:crypto';

const OPAQUE_ID_BYTES = 24;
export function opaqueId() {
  return randomBytes(OPAQUE_ID_BYTES).toString('hex');
}
