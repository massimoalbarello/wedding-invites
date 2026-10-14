import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { useForm } from '@tanstack/react-form';

export function RsvpForm({
  status,
  companions,
  maxGuests,
  onSave,
}: {
  status: 'pending' | 'accepted' | 'declined';
  companions: { name: string }[];
  maxGuests: number;
  onSave: (reply: { status: 'accepted' | 'declined'; companions: string[] }) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: {
      status,
      companions: companions.map((person) => ({ id: crypto.randomUUID(), name: person.name })),
    },
    onSubmit: async ({ value }) => {
      if (value.status === 'pending') {
        return;
      }
      await onSave({
        status: value.status,
        companions:
          value.status === 'accepted' ? value.companions.map((person) => person.name) : [],
      });
    },
  });
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="status"
        validators={{
          onSubmit: ({ value }) =>
            value === 'pending' ? 'Choose a reply before sending.' : undefined,
        }}
      >
        {(field) => (
          <fieldset className="space-y-3">
            <legend className="mb-4 font-medium">Will you join us?</legend>
            {[
              { value: 'accepted', label: 'Yes, I’ll be there' },
              { value: 'declined', label: 'Sorry, I can’t make it' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-4 has-checked:border-primary has-checked:bg-muted/50"
              >
                <input
                  type="radio"
                  name="reply"
                  value={option.value}
                  checked={field.state.value === option.value}
                  onChange={() => field.handleChange(option.value as 'accepted' | 'declined')}
                  className="size-4 accent-primary"
                />
                {option.label}
              </label>
            ))}
            {field.state.meta.errors.map((error) => (
              <p role="alert" key={error} className="text-destructive text-sm">
                {error}
              </p>
            ))}
          </fieldset>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.status}>
        {(reply: 'pending' | 'accepted' | 'declined') =>
          reply === 'accepted' && maxGuests > 0 ? (
            <form.Field
              name="companions"
              mode="array"
              validators={{
                onSubmit: ({ value }) =>
                  value.some((person) => !person.name.trim())
                    ? 'Add a name for each additional guest, or remove the empty guest.'
                    : undefined,
              }}
            >
              {(field) => (
                <section className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm">Who’s coming with you?</h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      You can bring up to {maxGuests} additional{' '}
                      {maxGuests === 1 ? 'guest' : 'guests'}.
                    </p>
                  </div>
                  {Array.from(field.state.value.entries()).map(([index, person]) => (
                    <form.Field key={person.id} name={`companions[${index}].name`}>
                      {(nameField) => (
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1.5">
                            <label htmlFor={`companion-${index}`} className="text-sm">
                              Guest {index + 1} name
                            </label>
                            <Input
                              id={`companion-${index}`}
                              value={nameField.state.value}
                              onValueChange={nameField.handleChange}
                              onBlur={nameField.handleBlur}
                              maxLength={120}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            type="button"
                            aria-label={`Remove guest ${index + 1}`}
                            onClick={() => field.removeValue(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </form.Field>
                  ))}
                  {field.state.meta.errors.map((error) => (
                    <p role="alert" key={error} className="text-destructive text-sm">
                      {error}
                    </p>
                  ))}
                  {field.state.value.length < maxGuests && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => field.pushValue({ id: crypto.randomUUID(), name: '' })}
                    >
                      + Add a guest
                    </Button>
                  )}
                </section>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending: boolean) => (
          <Button size="lg" type="submit" disabled={pending}>
            {pending ? 'Saving your reply…' : status === 'pending' ? 'Send reply' : 'Update reply'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
