import { Button } from '@repo/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';
import { useForm } from '@tanstack/react-form';
import type { DesignCatalog } from '../../queries/designs';
import { DesignPreview } from './design-preview';

export function DesignForm({
  catalog,
  editing,
  pending,
  onEdit,
  onCancel,
  onSave,
}: {
  catalog: DesignCatalog;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (packageId: string) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { packageId: catalog.selectedPackageId },
    onSubmit: ({ value }) => onSave(value.packageId),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="min-w-0 font-semibold text-2xl tracking-tight sm:text-3xl">
          Invitation design
        </h1>
        <div className="flex min-h-10 shrink-0 items-center gap-2">
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving design…' : 'Save design'}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={onEdit}>
              Select design
            </Button>
          )}
        </div>
      </div>
      <form.Field
        name="packageId"
        validators={{
          onSubmit: ({ value }) =>
            catalog.packages.some((entry) => entry.id === value)
              ? undefined
              : 'Choose an available design.',
        }}
      >
        {(field) => {
          const selected = catalog.packages.find((entry) => entry.id === field.state.value);
          return (
            <>
              <div className="mt-5 space-y-2">
                {editing ? (
                  <>
                    <label htmlFor="design-choice" className="font-medium text-sm">
                      Design for every invitation
                    </label>
                    <Select
                      items={catalog.packages.map((entry) => ({
                        value: entry.id,
                        label: entry.name,
                      }))}
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value);
                        }
                      }}
                    >
                      <SelectTrigger id="design-choice" aria-label="Design for every invitation">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog.packages.map((entry) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <h2 className="font-medium text-lg">{selected?.name ?? 'Unavailable design'}</h2>
                )}
                <p className="text-muted-foreground text-sm">
                  {selected?.description ??
                    'Choose another available design to make invitations ready again.'}
                </p>
                {field.state.meta.errors.map((error) => (
                  <p key={error} role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ))}
              </div>
              {selected && <DesignPreview key={selected.id} packageId={selected.id} />}
            </>
          );
        }}
      </form.Field>
    </form>
  );
}
