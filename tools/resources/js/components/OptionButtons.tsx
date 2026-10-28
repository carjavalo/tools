import type { LucideIcon } from 'lucide-react';

export interface OptionButton<T extends string> {
    value: T;
    label: string;
    icon?: LucideIcon;
    hint?: string;
}

interface OptionButtonsProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: OptionButton<T>[];
    labelledBy: string;
    className?: string;
    disabled?: boolean;
}

/** Grupo de botones que se comporta como un selector de una sola opción. */
export default function OptionButtons<T extends string>({ value, onChange, options, labelledBy, className = '', disabled }: OptionButtonsProps<T>) {
    return (
        <div role="radiogroup" aria-labelledby={labelledBy} className={`grid gap-2 ${className}`}>
            {options.map(({ value: optionValue, label, icon: Icon, hint }) => {
                const selected = optionValue === value;
                return (
                    <button
                        key={optionValue}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        title={hint}
                        disabled={disabled}
                        onClick={() => onChange(optionValue)}
                        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-institutional disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                                ? 'border-institutional bg-institutional/10 text-institutional ring-1 ring-institutional dark:border-[#8b9bd6] dark:bg-[#8b9bd6]/15 dark:text-white dark:ring-[#8b9bd6]'
                                : 'border-slate-200 text-slate-700 hover:border-institutional/60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#8b9bd6]/60'
                        }`}
                    >
                        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                        <span className="truncate">{label}</span>
                    </button>
                );
            })}
        </div>
    );
}
