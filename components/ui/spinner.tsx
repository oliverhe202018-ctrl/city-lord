import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps extends Omit<React.ComponentProps<typeof Loader2Icon>, 'size'> {
  size?: number | string | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
  xl: 'size-12',
} as const;

function Spinner({ className, size, ...props }: SpinnerProps) {
  let sizeClass = 'size-4';
  let numericSize = undefined;

  if (typeof size === 'string' && size in sizeMap) {
    sizeClass = sizeMap[size as keyof typeof sizeMap];
  } else if (size) {
    sizeClass = '';
    numericSize = size;
  }

  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn('animate-spin', sizeClass, className)}
      size={numericSize}
      {...props}
    />
  )
}

export { Spinner }
