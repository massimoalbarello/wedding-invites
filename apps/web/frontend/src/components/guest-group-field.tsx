import { Input } from '@repo/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';

export type GuestGroupDraft = { kind: 'ungrouped' } | { kind: 'existing' | 'new'; name: string };

const EXISTING_GROUP_PREFIX = 'existing:';

export function GuestGroupField({
  value,
  groups,
  errors,
  onChange,
  onBlur,
}: {
  value: GuestGroupDraft;
  groups: string[];
  errors: string[];
  onChange: (value: GuestGroupDraft) => void;
  onBlur: () => void;
}) {
  const items = [
    { value: 'ungrouped', label: 'Ungrouped' },
    ...groups.map((name) => ({ value: `${EXISTING_GROUP_PREFIX}${name}`, label: name })),
    { value: 'new', label: 'Create a new group…' },
  ];
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="guest-group" className="font-medium text-sm">
          Group
        </label>
        <Select
          items={items}
          value={value.kind === 'existing' ? `${EXISTING_GROUP_PREFIX}${value.name}` : value.kind}
          onValueChange={(selection) => {
            if (selection === 'new') {
              onChange({ kind: 'new', name: '' });
            } else if (selection?.startsWith(EXISTING_GROUP_PREFIX)) {
              onChange({ kind: 'existing', name: selection.slice(EXISTING_GROUP_PREFIX.length) });
            } else {
              onChange({ kind: 'ungrouped' });
            }
          }}
        >
          <SelectTrigger id="guest-group" onBlur={onBlur} className="w-full">
            <SelectValue className="truncate" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.kind === 'new' && (
        <div className="space-y-2">
          <label htmlFor="guest-new-group" className="font-medium text-sm">
            New group name
          </label>
          <Input
            id="guest-new-group"
            placeholder="Family, friends, colleagues…"
            value={value.name}
            onValueChange={(name) => onChange({ kind: 'new', name })}
            onBlur={onBlur}
            maxLength={80}
            aria-invalid={errors.length > 0}
            aria-describedby={errors.length ? 'guest-group-error' : undefined}
          />
        </div>
      )}
      {errors.length > 0 && (
        <p id="guest-group-error" role="alert" className="text-destructive text-sm">
          {errors.join(' ')}
        </p>
      )}
      <p className="text-muted-foreground text-sm">Keep people together in your guest list.</p>
    </div>
  );
}
