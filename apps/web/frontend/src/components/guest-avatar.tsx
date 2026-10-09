import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/avatar';
import { type Guest, referenceUrl } from '../queries/guests';

export function GuestAvatar({ guest }: { guest: Pick<Guest, 'id' | 'name' | 'references'> }) {
  const first = guest.references[0];
  return (
    <Avatar>
      {first && (
        <AvatarImage
          src={referenceUrl({ id: guest.id, photoId: first.id })}
          alt={`${guest.name}'s avatar`}
        />
      )}
      <AvatarFallback aria-label={guest.name}>
        {guest.name
          .split(' ')
          .map((part) => part[0])
          .slice(0, 2)
          .join('')}
      </AvatarFallback>
    </Avatar>
  );
}
