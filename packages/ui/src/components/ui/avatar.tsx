import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { cn } from '../../lib/class-names';

export function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex size-10 shrink-0 overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}
export function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return <AvatarPrimitive.Image className={cn('size-full object-cover', className)} {...props} />;
}
export function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex size-full items-center justify-center font-medium text-muted-foreground text-sm',
        className,
      )}
      {...props}
    />
  );
}
