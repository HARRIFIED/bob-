import { describe, expect, it } from 'vitest';
import { paydaySurge } from '../scenarios/payday-surge';
import { defaultSandboxSettings, parseSandboxProject } from '../simulation/sandbox';
import type { SandboxProject } from '../simulation/sandbox';
import { decodeShare, encodeShare } from './share-link';

describe('share links', () => {
  it('round-trip a design through a URL-safe fragment, including non-ASCII names', () => {
    const project: SandboxProject = {
      version: 1, name: 'Ada’s ₦ ledger', settings: { ...defaultSandboxSettings, live: true },
      architecture: structuredClone(paydaySurge.initialArchitecture),
    };
    const encoded = encodeShare(project);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parseSandboxProject(decodeShare(encoded))).toEqual(parseSandboxProject(JSON.stringify(project)));
  });
  it('rejects tampered links through the normal validator', () => {
    expect(() => parseSandboxProject(decodeShare(encodeShare({ version: 1, name: '', settings: defaultSandboxSettings, architecture: { nodes: [], edges: [] } })))).toThrow();
  });
});
