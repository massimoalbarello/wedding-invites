import { MAX_NAME_LENGTH, type RsvpReply, type RsvpState } from '@repo/invitation-runtime/contract';
import { useForm } from '@tanstack/react-form';

export function RsvpForm({
  status,
  companions,
  maxGuests,
  onSave,
}: {
  status: RsvpState['status'];
  companions: { name: string }[];
  maxGuests: number;
  onSave: (reply: RsvpReply) => Promise<void>;
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
          <fieldset>
            <legend className="sr-only">Your reply</legend>
            {[
              { value: 'accepted', label: 'Yes, I’ll be there' },
              { value: 'declined', label: 'Sorry, I can’t make it' },
            ].map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="reply"
                  value={option.value}
                  checked={field.state.value === option.value}
                  onChange={() => field.handleChange(option.value as 'accepted' | 'declined')}
                />
                {option.label}
              </label>
            ))}
            {field.state.meta.errors.map((error) => (
              <p role="alert" key={error}>
                {error}
              </p>
            ))}
          </fieldset>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.status}>
        {(reply: RsvpState['status']) =>
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
                <section className="guest-details">
                  <div>
                    <h3>Who’s coming with you?</h3>
                    <p>
                      We’re keeping our celebration close to the people who have shared our lives
                      over the years. Please keep this in mind when choosing who to bring with you.
                    </p>
                  </div>
                  {Array.from(field.state.value.entries()).map(([index, person]) => (
                    <form.Field key={person.id} name={`companions[${index}].name`}>
                      {(nameField) => (
                        <div>
                          <div>
                            <label htmlFor={`companion-${index}`}>
                              {maxGuests === 1 ? 'Guest name' : `Guest ${index + 1} name`}
                            </label>
                            <input
                              id={`companion-${index}`}
                              value={nameField.state.value}
                              onChange={(event) => nameField.handleChange(event.target.value)}
                              onBlur={nameField.handleBlur}
                              maxLength={MAX_NAME_LENGTH}
                            />
                          </div>
                          <button
                            className="remove-guest"
                            type="button"
                            aria-label={
                              maxGuests === 1 ? 'Remove guest' : `Remove guest ${index + 1}`
                            }
                            onClick={() => field.removeValue(index)}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </form.Field>
                  ))}
                  {field.state.meta.errors.map((error) => (
                    <p role="alert" key={error}>
                      {error}
                    </p>
                  ))}
                  {field.state.value.length < maxGuests && (
                    <button
                      type="button"
                      onClick={() => field.pushValue({ id: crypto.randomUUID(), name: '' })}
                    >
                      + Add a guest
                    </button>
                  )}
                </section>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending: boolean) => (
          <button type="submit" disabled={pending}>
            {pending ? 'Saving your reply…' : status === 'pending' ? 'Send reply' : 'Update reply'}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
