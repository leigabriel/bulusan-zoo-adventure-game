/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export function cx(...tokens) {
    return tokens.filter(Boolean).join(' ');
}

/**
 * ActionButton: Standard game-style button with 3D chunky shadow
 */
export function ActionButton({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    ...props
}) {
    const variantClasses = {
        primary: 'bg-emerald-500 text-white shadow-[0_4px_0_0_#065f46]',
        secondary: 'bg-white text-slate-900 shadow-[0_4px_0_0_#cbd5e1]',
        danger: 'bg-rose-500 text-white shadow-[0_4px_0_0_#9f1239]',
        warning: 'bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#92400e]',
        ghost: 'bg-emerald-950/70 text-white shadow-[0_4px_0_0_rgba(0,0,0,0.3)]',
    };

    const sizeClasses = {
        sm: 'h-9 px-3 text-xs rounded-xl',
        md: 'h-11 px-5 text-sm rounded-xl',
        lg: 'h-13 px-8 text-base rounded-2xl',
    };

    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'inline-flex items-center justify-center gap-2 font-black uppercase tracking-wider transition-all active:translate-y-1 active:shadow-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
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

/**
 * IconButton: Circular game-style icon button
 */
export function IconButton({ children, className = '', ...props }) {
    return (
        <button
            type="button"
            data-ui-button="true"
            className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_4px_0_0_#cbd5e1] transition-all active:translate-y-1 active:shadow-none focus-visible:outline-none',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

/**
 * GameButton: Specialized large button for menus
 */
export function GameButton({
    children,
    className = '',
    color = 'slate',
    size = 'md',
    ...props
}) {
    const colorClasses = {
        slate: 'bg-white text-slate-900 shadow-[0_6px_0_0_#cbd5e1]',
        dark: 'bg-slate-900 text-white shadow-[0_6px_0_0_#0f172a]',
        emerald: 'bg-emerald-500 text-white shadow-[0_6px_0_0_#065f46]',
        rose: 'bg-rose-500 text-white shadow-[0_6px_0_0_#9f1239]',
        amber: 'bg-amber-500 text-white shadow-[0_6px_0_0_#92400e]',
        sky: 'bg-sky-500 text-white shadow-[0_6px_0_0_#075985]',
    };

    const sizeClasses = {
        sm: 'py-2 px-4 text-sm rounded-xl',
        md: 'py-2.5 px-8 text-base sm:text-lg rounded-2xl',
        lg: 'py-3 px-12 text-lg sm:text-2xl rounded-3xl',
    };

    const colorStyle = colorClasses[color] || colorClasses.slate;
    const sizeStyle = sizeClasses[size] || sizeClasses.md;

    return (
        <button
            type="button"
            className={cx(
                'font-black uppercase tracking-wider transition-all active:translate-y-1 active:shadow-none focus-visible:outline-none',
                colorStyle,
                sizeStyle,
                className
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
            data-ui-panel="true"
            className={cx(
                'rounded-3xl border-2 border-emerald-100 bg-white shadow-[0_12px_0_0_rgba(5,46,22,0.1)]',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function PaginationControls({
    page,
    pageCount,
    onPageChange,
    previousLabel = 'Previous',
    nextLabel = 'Next',
    className = '',
}) {
    if (pageCount <= 1) return null;

    return (
        <nav className={cx('flex shrink-0 items-center justify-between gap-3', className)} aria-label="Pagination">
            <ActionButton
                size="sm"
                variant="secondary"
                disabled={page <= 0}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
            >
                <span aria-hidden="true">&lsaquo;</span> {previousLabel}
            </ActionButton>
            <span className="min-w-16 rounded-full bg-emerald-950 px-3 py-1.5 text-center text-xs font-black text-white shadow-[0_3px_0_0_#022c22]" aria-live="polite">
                {page + 1} / {pageCount}
            </span>
            <ActionButton
                size="sm"
                variant="primary"
                disabled={page >= pageCount - 1}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
            >
                {nextLabel} <span aria-hidden="true">&rsaquo;</span>
            </ActionButton>
        </nav>
    );
}

export function ModalShell({ isOpen, onClose, title, children, size = 'md', closeOnBackdrop = true, showClose = true }) {
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
            className="fixed inset-0 z-120 flex items-center justify-center p-2 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
            role="dialog"
            aria-modal="true"
        >
            <button
                type="button"
                aria-label="Close modal"
                onClick={closeOnBackdrop ? onClose : undefined}
                className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs"
            />

            <SurfacePanel
                className={cx(
                    'relative z-121 flex max-h-[85dvh] w-full flex-col overflow-hidden',
                    maxWidth[size] || maxWidth.md,
                )}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-emerald-50 p-4 sm:px-8 sm:py-5">
                    {title ? <h2 className="text-xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">{title}</h2> : <span />}
                    {showClose ? <IconButton onClick={onClose} aria-label="Close"><span className="text-xl font-bold leading-none">&times;</span></IconButton> : null}
                </div>
                <div className="min-h-0 overflow-y-auto p-4 sm:p-6" data-ui-scrollable="true">
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
                    'fixed inset-0 z-90 bg-emerald-950/40 backdrop-blur-xs transition-opacity',
                    isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
            />

            <aside
                data-ui-panel="true"
                className={cx(
                    'fixed top-0 z-95 h-dvh w-[min(28rem,92vw)] border-r border-emerald-100 bg-white transition-transform duration-300',
                    'shadow-[12px_0_0_0_rgba(5,46,22,0.05)]',
                    sidePosition,
                    isOpen ? 'translate-x-0' : hiddenPosition,
                )}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b-2 border-emerald-50 px-4 py-3 sm:px-6 sm:py-5">
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-[0.12em] text-emerald-900">{title}</h3>
                        <IconButton onClick={onClose} aria-label="Close panel">
                            <span className="text-xl font-bold leading-none">&times;</span>
                        </IconButton>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" data-ui-scrollable="true">
                        {children}
                    </div>
                </div>
            </aside>
        </>
    );
}
