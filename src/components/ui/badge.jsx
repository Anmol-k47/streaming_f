import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/20 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/20 text-red-400',
        outline: 'text-foreground border-border',
        hls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        dash: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
        drm: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
        native: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
        live: 'border-red-500/30 bg-red-500/10 text-red-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
