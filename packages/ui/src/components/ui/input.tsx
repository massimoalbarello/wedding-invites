import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '../../lib/class-names';

export function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      className={cn(
        'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
