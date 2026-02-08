import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-white';

        const variants = {
            primary: 'bg-black text-white hover:bg-gray-800 focus:ring-gray-900',
            secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-300',
            outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 focus:ring-gray-300',
            ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300',
            danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        };

        const sizes = {
            sm: 'h-8 px-3 text-sm',
            md: 'h-10 px-4 py-2',
            lg: 'h-12 px-6 text-lg',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';
