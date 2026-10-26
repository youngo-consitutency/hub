import type { CollectionConfig } from 'payload'
import { isStaff, staffWrites } from '../lib/collectionAccess'

// Personal agent keys for the YOUNGO MCP gateway. Only the sha256 of the
// secret is stored; the secret is shown once at creation. Keys die with the
// password epoch they were minted under, and on expiry or revocation.
export const AgentKeys: CollectionConfig = {
  slug: 'agent-keys',
  access: { read: isStaff, ...staffWrites },
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'accounts', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true },
    { name: 'prefix', type: 'text', required: true },
    { name: 'credentialEpoch', type: 'number', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'lastUsedAt', type: 'date' },
    { name: 'revokedAt', type: 'date', index: true },
    { name: 'revokedReason', type: 'text' },
  ],
}

// Replay store for agent writes: same key + tool + idempotency key returns
// the stored result; different arguments under the same key are a conflict.
export const AgentIdempotency: CollectionConfig = {
  slug: 'agent-idempotency',
  access: { read: isStaff, ...staffWrites },
  fields: [
    { name: 'agentKey', type: 'relationship', relationTo: 'agent-keys', required: true },
    { name: 'tool', type: 'text', required: true },
    { name: 'idempotencyKey', type: 'text', required: true },
    { name: 'argumentsHash', type: 'text', required: true },
    { name: 'response', type: 'json' },
  ],
}
