// Permission keys of Mobilix. Source of truth: permissions.json (also sent to the License Hub / Generator as project.permission_schema).
import schema from './permissions.json';

export type FeatureKey =
  | 'sales.installments' | 'sales.exchange' | 'sales.documents'
  | 'inventory.accessories' | 'inventory.qr'
  | 'accounts.ledger' | 'accounts.expenses' | 'accounts.reports'
  | 'branches.multi'
  | 'print.receipts' | 'print.thermal'
  | 'backup.export';

/** Default for every feature, taken from permissions.json. */
export const FEATURE_DEFAULTS: Record<string, boolean> = Object.fromEntries(
  schema.permission_schema.flatMap((m) => m.features.map((f) => [f.key, f.default])),
);

/** License says yes/no -> use it. License does not mention the key -> use the schema default. */
export function featureOn(features: Record<string, unknown> | undefined, key: FeatureKey): boolean {
  const v = features?.[key];
  return typeof v === 'boolean' ? v : !!FEATURE_DEFAULTS[key];
}
