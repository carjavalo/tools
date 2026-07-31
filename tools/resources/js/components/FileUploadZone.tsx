import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface FileUploadZoneProps {
    onFileSelect: (files: FileList) => void;
    acceptedTypes: string;
    multiple?: boolean;
    dragOver?: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    title?: string;
    subtitle?: string;
    buttonText?: string;
    hasFiles?: boolean;
    fileInfo?: React.ReactNode;
}

export default function FileUploadZone({
    onFileSelect,
    acceptedTypes,
    multiple = false,
    dragOver = false,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    title = "Arrastra tu archivo aquí",
    subtitle = "o haz clic para seleccionar",
    buttonText = "Seleccionar Archivo",
    hasFiles = false,
    fileInfo
}: FileUploadZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files);
        }
    };

    return (
        <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                hasFiles 
                    ? 'border-institutional bg-institutional/5' 
                    : dragOver
                        ? 'border-institutional bg-institutional/10'
                        : 'border-slate-300 hover:border-institutional dark:border-slate-600'
            }`}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {hasFiles && fileInfo ? (
                fileInfo
            ) : (
                <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-slate-400" />
                    <div>
                        <p className="text-lg font-medium text-slate-900 dark:text-white">
                            {title}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {subtitle}
                        </p>
                    </div>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                multiple={multiple}
                onChange={handleFileInputChange}
                className="hidden"
            />

            <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full mt-4"
            >
                {buttonText}
            </Button>
        </div>
    );
}