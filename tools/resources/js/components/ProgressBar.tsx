interface ProgressBarProps {
    progress: number;
    message?: string;
    showPercentage?: boolean;
}

export default function ProgressBar({ progress, message, showPercentage = true }: ProgressBarProps) {
    return (
        <div className="space-y-2">
            {(message || showPercentage) && (
                <div className="flex justify-between text-sm">
                    {message && <span className="text-slate-700 dark:text-slate-300">{message}</span>}
                    {showPercentage && <span className="text-slate-500 dark:text-slate-400">{progress}%</span>}
                </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className="bg-institutional h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
}