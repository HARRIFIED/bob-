import type { SandboxProject } from '../simulation/sandbox';

/** Sandbox designs travel in the URL fragment, which browsers never send to a server. */
export const shareHashPrefix = '#share=';

export function encodeShare(project: SandboxProject): string {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns the JSON text; callers must still validate it with parseSandboxProject. */
export function decodeShare(value: string): string {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}
