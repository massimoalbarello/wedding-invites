import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { useForm } from '@tanstack/react-form';
import type { WeddingSettings } from '../../queries/wedding';

export function WeddingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: WeddingSettings;
  onSave: (settings: WeddingSettings) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value }) => {
      await onSave(value);
    },
  });
  return (
    <form
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="flex min-h-10 items-center justify-end gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending: boolean) => (
            <>
              <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save wedding'}
              </Button>
            </>
          )}
        </form.Subscribe>
      </div>
      <form.Field
        name="coupleNames"
        validators={{
          onSubmit: ({ value }) => (value.trim() ? undefined : 'Enter the couple’s names.'),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <label htmlFor="couple-names" className="font-medium text-sm">
              Couple names
            </label>
            <Input
              id="couple-names"
              value={field.state.value}
              onValueChange={field.handleChange}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.errors.length > 0}
              maxLength={120}
              placeholder="The names you’d like on your invitation"
              autoFocus
            />
            {field.state.meta.errors.map((error) => (
              <p key={error} role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>
      <form.Field
        name="date"
        validators={{ onSubmit: ({ value }) => (value ? undefined : 'Choose your ceremony date.') }}
      >
        {(field) => (
          <div className="space-y-2">
            <label htmlFor="ceremony-date" className="font-medium text-sm">
              Ceremony date
            </label>
            <Input
              id="ceremony-date"
              type="date"
              className="max-w-64"
              value={field.state.value}
              onValueChange={field.handleChange}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error} role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ))}
          </div>
        )}
      </form.Field>
    </form>
  );
}
