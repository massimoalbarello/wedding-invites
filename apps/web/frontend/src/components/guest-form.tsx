import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Switch } from '@repo/ui/switch';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import type { GuestDraft, GuestSettings } from '../queries/guests';
import { type GuestGroupDraft, GuestGroupField } from './guest-group-field';
import {
  type ExistingGuestPhoto,
  GuestPhotosField,
  type PendingGuestPhoto,
  validateGuestPhotos,
} from './guest-photos-field';

export function GuestForm({
  initial,
  onSave,
  onCancel,
  groups = [],
  references = [],
}: {
  initial: GuestSettings;
  onSave: (value: GuestDraft) => Promise<void>;
  onCancel: () => void;
  groups?: string[];
  references?: ExistingGuestPhoto[];
}) {
  const { groupName, ...guestSettings } = initial;
  const groupNames = [...new Set([...groups, groupName].filter(Boolean))];
  const form = useForm({
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: ({ value }) =>
        validateGuestPhotos({
          referenceCount: references.filter((photo) => !value.removedPhotoIds.includes(photo.id))
            .length,
          photos: value.pendingPhotos.map((photo) => photo.file),
        }),
    },
    defaultValues: {
      ...guestSettings,
      group: (groupName
        ? { kind: 'existing', name: groupName }
        : { kind: 'ungrouped' }) as GuestGroupDraft,
      pendingPhotos: [] as PendingGuestPhoto[],
      removedPhotoIds: [] as string[],
    },
    onSubmit: async ({ value }) => {
      const { pendingPhotos, group, ...settings } = value;
      await onSave({
        ...settings,
        groupName: group.kind === 'ungrouped' ? '' : group.name,
        photos: pendingPhotos.map((photo) => photo.file),
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
      <form.Field
        name="group"
        validators={{
          onDynamic: ({ value }) =>
            value.kind === 'new' && !value.name.trim()
              ? 'Enter a name for the new group.'
              : undefined,
        }}
      >
        {(field) => (
          <GuestGroupField
            value={field.state.value}
            groups={groupNames}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            errors={field.state.meta.errors.filter((error) => typeof error === 'string')}
          />
        )}
      </form.Field>
      <form.Subscribe
        selector={(state) => ({
          name: state.values.name,
          photos: state.values.pendingPhotos,
          removedPhotoIds: state.values.removedPhotoIds,
          disabled: state.isSubmitting,
          errors: state.errors.filter((error) => typeof error === 'string'),
        })}
      >
        {(draft: {
          name: string;
          photos: PendingGuestPhoto[];
          removedPhotoIds: string[];
          disabled: boolean;
          errors: string[];
        }) => (
          <GuestPhotosField
            name={draft.name}
            references={references.filter((photo) => !draft.removedPhotoIds.includes(photo.id))}
            photos={draft.photos}
            disabled={draft.disabled}
            errors={draft.errors}
            onSelect={(files) =>
              form.setFieldValue('pendingPhotos', (previous) => [
                ...previous,
                ...files.map((file) => ({ id: crypto.randomUUID(), file })),
              ])
            }
            onRemoveExisting={(id) =>
              form.setFieldValue('removedPhotoIds', (previous) => [...previous, id])
            }
            onRemovePending={(id) =>
              form.setFieldValue('pendingPhotos', (previous) =>
                previous.filter((photo) => photo.id !== id),
              )
            }
          />
        )}
      </form.Subscribe>
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
