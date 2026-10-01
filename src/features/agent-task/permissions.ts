export type TaskPermissionOffer = {
  offer_id: string;
  expires_at: number;
  action_id: 'calculation.propose';
  data_classes: {
    id: string;
    label: string;
    classification: 'private' | 'sensitive';
  }[];
  retention: 'user_managed';
};

export function readPermissionOffer(value: unknown): TaskPermissionOffer {
  const fail = () => {
    throw new Error('permission_invalid');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  const record = value as Record<string, unknown>;
  const expected = [
    'offer_id',
    'expires_at',
    'action_id',
    'data_classes',
    'retention',
  ];
  if (
    Object.keys(record).sort().join() !== expected.sort().join() ||
    typeof record.offer_id !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.offer_id) ||
    typeof record.expires_at !== 'number' ||
    !Number.isSafeInteger(record.expires_at) ||
    record.expires_at <= Date.now() ||
    record.action_id !== 'calculation.propose' ||
    record.retention !== 'user_managed' ||
    !Array.isArray(record.data_classes) ||
    record.data_classes.length !== 3
  )
    return fail();
  const ids = new Set<string>();
  for (const item of record.data_classes) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).sort().join() !== 'classification,id,label' ||
      typeof item.id !== 'string' ||
      !/^calculation\.(content|runtime_context|status)$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.label !== 'string' ||
      !item.label ||
      item.label.length > 100 ||
      !['private', 'sensitive'].includes(item.classification)
    )
      return fail();
    ids.add(item.id);
  }
  return value as TaskPermissionOffer;
}
