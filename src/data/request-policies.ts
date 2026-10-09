import type { ArchitectureState, RequestHandling } from '../simulation/types';

export const requestHandlingOptions: { value: RequestHandling; label: string; description: string; lookupMs: number }[] = [
  { value: 'always-create', label: 'Create a new transfer', description: 'Process every received request. Request keys are recorded in evidence but are not looked up.', lookupMs: 0 },
  { value: 'worker-memory', label: 'Look up key in worker memory', description: 'Each API worker remembers its own completed responses. Other workers cannot see that memory.', lookupMs: 1 },
  { value: 'postgres', label: 'Look up key in PostgreSQL', description: 'Workers share transfer records. Reserve a unique account/key, debit, and save the response in one transaction; matching retries replay it. Different payloads are rejected.', lookupMs: 3 },
];

export const requestHandling = (architecture: ArchitectureState): RequestHandling => architecture.requestHandling ?? 'always-create';
export const requestHandlingDefinition = (architecture: ArchitectureState) =>
  requestHandlingOptions.find(option => option.value === requestHandling(architecture)) ?? requestHandlingOptions[0];
