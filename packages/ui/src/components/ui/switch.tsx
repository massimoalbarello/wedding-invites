import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '../../lib/class-names';

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-secondary p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-5 rounded-full bg-background transition-transform data-checked:translate-x-4 motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
