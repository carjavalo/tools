import { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileDropZoneProps {
  onFileSelect: (files: File[]) => void;
  maxFileSize?: number;
  className?: string;
}

export function FileDropZone({ onFileSelect, maxFileSize = 100 * 1024 * 1024, className }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => file.size <= maxFileSize);
    
    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.size <= maxFileSize);
    
    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-lg transition-all ${
        isDragOver 
          ? 'border-institutional bg-institutional/5' 
          : 'border-gray-300 dark:border-gray-700'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className={`p-4 rounded-full transition-colors ${
            isDragOver 
              ? 'bg-institutional/10' 
              : 'bg-muted'
          }`}>
            {isDragOver ? (
              <FileText className="w-8 h-8 text-institutional" />
            ) : (
              <Upload className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium text-lg text-slate-900 dark:text-white">
              {isDragOver ? 'Suelta los archivos aquí' : 'Arrastra archivos aquí para compartir'}
            </h3>
            <p className="text-sm text-muted-foreground">
              O haz clic para explorar archivos
            </p>
            <p className="text-xs text-muted-foreground">
              Límite de tamaño: {Math.round(maxFileSize / (1024 * 1024))}MB
            </p>
          </div>
          
          <Button 
            onClick={handleBrowseClick} 
            className="bg-institutional hover:bg-institutional/90"
          >
            Explorar Archivos
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>
    </div>
  );
}