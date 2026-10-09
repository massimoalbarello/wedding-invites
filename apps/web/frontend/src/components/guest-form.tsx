import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Switch } from '@repo/ui/switch';
import { useForm } from '@tanstack/react-form';
import type { GuestDraft } from '../queries/guests';

export function GuestForm({
  initial,
  onSave,
  onCancel,
  groups = [],
}: {
  initial: GuestDraft;
  onSave: (value: GuestDraft) => Promise<void>;
  onCancel: () => void;
  groups?: string[];
}) {
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => onSave(value),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-8"
    >
      <div className="flex min-h-10 items-center justify-end gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending: boolean) => (
            <>
              <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save guest'}
              </Button>
            </>
          )}
        </form.Subscribe>
      </div>
      <form.Field
        name="name"
        validators={{
          onSubmit: ({ value }) => (value.trim() ? undefined : 'Enter the guest’s name.'),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <label htmlFor="guest-name" className="font-medium text-sm">
              Full name
            </label>
            <Input
              id="guest-name"
              autoComplete="name"
              value={field.state.value}
              onBlur={field.handleBlur}
              onValueChange={field.handleChange}
              maxLength={120}
              aria-invalid={field.state.meta.errors.length > 0}
              autoFocus
            />
            {field.state.meta.errors.map((error) => (
              <p role="alert" className="text-destructive text-sm" key={error}>
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>
      <form.Field name="groupName">
        {(field) => (
          <div className="space-y-2">
            <label htmlFor="guest-group" className="font-medium text-sm">
              Group <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="guest-group"
              list="guest-groups"
              placeholder="Family, friends, colleagues…"
              value={field.state.value}
              onBlur={field.handleBlur}
              onValueChange={field.handleChange}
              maxLength={80}
            />
            <datalist id="guest-groups">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <p className="text-muted-foreground text-sm">
              Keep people together in your guest list.
            </p>
          </div>
        )}
      </form.Field>
      <div className="space-y-7 border-border border-t pt-7">
        <form.Field name="faceScanRequired">
          {(field) => (
            <div className="flex items-start justify-between gap-6">
              <div>
                <label htmlFor="face-scan" className="font-medium text-sm">
                  Require a face scan
                </label>
                <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                  {field.state.value
                    ? 'A selfie unlocks this person’s invitation.'
                    : 'Anyone with this personal link can open the invitation directly.'}
                </p>
              </div>
              <Switch
                id="face-scan"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
              />
            </div>
          )}
        </form.Field>
        <form.Field name="maxGuests">
          {(field) => (
            <div className="space-y-2">
              <label htmlFor="guest-allowance" className="font-medium text-sm">
                Additional guests allowed
              </label>
              <Input
                id="guest-allowance"
                className="max-w-28"
                type="number"
                min={0}
                max={20}
                inputMode="numeric"
                value={field.state.value}
                onValueChange={(value) => field.handleChange(Number(value))}
                onBlur={field.handleBlur}
              />
              <p className="text-muted-foreground text-sm">
                Set to 0 for an invitation just for them.
              </p>
            </div>
          )}
        </form.Field>
      </div>
    </form>
  );
}
