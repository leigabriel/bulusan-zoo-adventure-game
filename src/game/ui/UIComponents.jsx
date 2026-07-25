/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export function cx(...tokens) {
    return tokens.filter(Boolean).join(' ');
}

export function ActionButton({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    ...props
}) {
    const variantClasses = {
        primary: 'bg-linear-to-b from-emerald-500 to-emerald-600 text-white ring-1 ring-emerald-700/30 hover:from-emerald-400 hover:to-emerald-500',
        secondary: 'bg-linear-to-b from-white to-emerald-50 text-emerald-950 ring-1 ring-emerald-200 hover:to-emerald-100',
        danger: 'bg-linear-to-b from-rose-500 to-rose-600 text-white ring-1 ring-rose-700/30 hover:from-rose-400 hover:to-rose-500',
        warning: 'bg-linear-to-b from-lime-300 to-emerald-300 text-emerald-950 ring-1 ring-emerald-400/40 hover:from-lime-200 hover:to-emerald-200',
        ghost: 'bg-emerald-950/70 text-white ring-1 ring-white/20 hover:bg-emerald-950/80',
    };

    const sizeClasses = {
        sm: 'h-11 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
    };

    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold tracking-wide transition-[transform,box-shadow,background-color,border-color] duration-150',
                'active:translate-y-px active:shadow-[0_2px_8px_-6px_rgba(5,46,22,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
                'shadow-[0_10px_24px_-16px_rgba(5,46,22,0.5)]',
                variantClasses[variant] || variantClasses.primary,
                sizeClasses[size] || sizeClasses.md,
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function IconButton({ children, className = '', ...props }) {
    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-b from-white to-emerald-50 text-emerald-950 ring-1 ring-emerald-200 shadow-[0_10px_24px_-16px_rgba(5,46,22,0.5)] transition duration-150 hover:to-emerald-100 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function SurfacePanel({ children, className = '', ...props }) {
    return (
        <div
            className={cx(
                'rounded-[1.35rem] border border-emerald-100 bg-white shadow-[0_18px_32px_-24px_rgba(5,46,22,0.7)]',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function ModalShell({ isOpen, onClose, title, children, size = 'md' }) {
    if (!isOpen) return null;

    const maxWidth = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div
            data-ui-modal="true"
            className="fixed inset-0 z-120 flex items-center justify-center p-2 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)]"
            role="dialog"
            aria-modal="true"
        >
            <button
                type="button"
                aria-label="Close modal"
                onClick={onClose}
                className="absolute inset-0 bg-emerald-950/30 backdrop-blur-[2px]"
            />

            <SurfacePanel
                className={cx(
                    'relative z-121 w-full overflow-hidden',
                    maxWidth[size] || maxWidth.md,
                )}
            >
                <div className="max-h-[80dvh] overflow-y-auto p-3 sm:p-6" data-ui-scrollable="true">
                    <div className="mb-3 sm:mb-4 flex items-center justify-between gap-3">
                        {title ? <h2 className="text-base sm:text-lg font-black text-slate-900">{title}</h2> : <span />}
                        <IconButton onClick={onClose} aria-label="Close">
                            <span className="text-base leading-none">x</span>
                        </IconButton>
                    </div>
                    {children}
                </div>
            </SurfacePanel>
        </div>
    );
}

export function SideSheet({ isOpen, onClose, title, side = 'left', children }) {
    const sidePosition = side === 'right' ? 'right-0' : 'left-0';
    const hiddenPosition = side === 'right' ? 'translate-x-full' : '-translate-x-full';

    return (
        <>
            <button
                type="button"
                aria-label="Close panel"
                onClick={onClose}
                className={cx(
                    'fixed inset-0 z-90 bg-emerald-950/30 backdrop-blur-[2px] transition-opacity',
                    isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
            />

            <aside
                data-ui-panel="true"
                className={cx(
                    'fixed top-0 z-95 h-dvh w-[min(24rem,92vw)] border border-emerald-100 bg-white transition-transform duration-300',
                    'shadow-[0_22px_40px_-20px_rgba(5,46,22,0.65)]',
                    sidePosition,
                    isOpen ? 'translate-x-0' : hiddenPosition,
                )}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-emerald-100/90 px-3 py-2.5 sm:px-4 sm:py-3">
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.12em] text-emerald-900/80">{title}</h3>
                        <IconButton onClick={onClose} aria-label="Close panel">
                            <span className="text-base leading-none">x</span>
                        </IconButton>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" data-ui-scrollable="true">
                        {children}
                    </div>
                </div>
            </aside>
        </>
    );
}