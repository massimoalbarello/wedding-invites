import { Button } from '@repo/ui/button';
import { useEffect, useRef, useState } from 'react';
import { MAX_PHOTO_BYTES, MAX_REFERENCE_PHOTOS } from '#backend/models/invitations/model.ts';

const BYTES_PER_MEBIBYTE = 1_048_576;
const MAX_PHOTO_SIZE_MB = MAX_PHOTO_BYTES / BYTES_PER_MEBIBYTE;

export type ExistingGuestPhoto = { id: string; src: string };
export type PendingGuestPhoto = { id: string; file: File };
export function GuestPhotosField({
  name,
  references,
  photos,
  disabled,
  errors,
  onSelect,
  onRemoveExisting,
  onRemovePending,
}: {
  name: string;
  references: ExistingGuestPhoto[];
  photos: PendingGuestPhoto[];
  disabled: boolean;
  errors: string[];
  onSelect: (files: File[]) => void;
  onRemoveExisting: (id: string) => void;
  onRemovePending: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const previews = [
    ...references.map((photo) => ({ ...photo, stored: true as const })),
    ...photos.map((photo) => ({ ...photo, stored: false as const })),
  ];
  return (
    <section className="space-y-4 border-border border-t pt-7" aria-labelledby="draft-photos-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="draft-photos-title" className="font-medium text-sm">
            Reference photos
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Up to {MAX_REFERENCE_PHOTOS} photos, {MAX_PHOTO_SIZE_MB} MB each. The first is their
            avatar.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          Add photos
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        aria-label="Upload reference photos"
        className="sr-only"
        onChange={(event) => {
          onSelect(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      {previews.length === 0 ? (
        <div className="rounded-xl bg-muted/60 px-5 py-7 text-center text-muted-foreground text-sm">
          Add photos to help recognise them and personalise your guest list.
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {Array.from(previews.entries()).map(([index, photo]) => (
            <li key={photo.id} className="space-y-1.5">
              {photo.stored ? (
                <img
                  src={photo.src}
                  alt={`Reference ${index + 1} for ${name || 'this guest'}`}
                  className="aspect-square w-full rounded-lg bg-muted object-cover"
                />
              ) : (
                <PendingPhoto
                  file={photo.file}
                  alt={`Reference ${index + 1} for ${name || 'this guest'}`}
                />
              )}
              <div className="flex min-h-7 flex-wrap items-center justify-between gap-1">
                {index === 0 && <span className="text-muted-foreground text-xs">Avatar</span>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label={`Remove reference photo ${index + 1}`}
                  onClick={() =>
                    photo.stored ? onRemoveExisting(photo.id) : onRemovePending(photo.id)
                  }
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {errors.map((error) => (
        <p key={error} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ))}
    </section>
  );
}
function PendingPhoto({ file, alt }: { file: File; alt: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return (
    <img src={url} alt={alt} className="aspect-square w-full rounded-lg bg-muted object-cover" />
  );
}

export function validateGuestPhotos({
  referenceCount,
  photos,
}: {
  referenceCount: number;
  photos: File[];
}) {
  if (referenceCount + photos.length > MAX_REFERENCE_PHOTOS) {
    return `Choose up to ${MAX_REFERENCE_PHOTOS} reference photos. Remove an extra photo and try again.`;
  }
  if (photos.some((photo) => photo.size > MAX_PHOTO_BYTES)) {
    return `Each photo must be ${MAX_PHOTO_SIZE_MB} MB or smaller. Remove the oversized photo and try again.`;
  }
  return undefined;
}
