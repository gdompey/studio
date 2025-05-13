// src/components/inspection/PhotoUpload.tsx
"use client";

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, UploadCloud, AlertTriangle } from 'lucide-react';
import { Label } from '../ui/label';

interface PhotoUploadProps {
  onPhotosUploaded: (photos: { name: string; dataUri: string }[]) => void;
  maxFiles?: number;
  maxFileSizeMb?: number; // Max file size in MB
}

interface UploadedPhoto {
  id: string;
  name: string;
  dataUri: string;
  file: File; // Keep original file for potential direct upload later
}

export function PhotoUpload({ 
  onPhotosUploaded, 
  maxFiles = 5, 
  maxFileSizeMb = 5 
}: PhotoUploadProps) {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files) return;

    if (uploadedPhotos.length + files.length > maxFiles) {
      setError(`You can upload a maximum of ${maxFiles} photos.`);
      return;
    }

    const newPhotos: UploadedPhoto[] = [];
    const photoProcessingPromises = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > maxFileSizeMb * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the ${maxFileSizeMb}MB size limit.`);
        continue; 
      }
      if (!file.type.startsWith('image/')) {
        setError(`File "${file.name}" is not a valid image type.`);
        continue;
      }

      const promise = new Promise<UploadedPhoto | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve({
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              dataUri: reader.result,
              file,
            });
          } else {
            resolve(null); // Should not happen with readAsDataURL
          }
        };
        reader.onerror = () => {
          setError(`Error reading file ${file.name}`);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
      photoProcessingPromises.push(promise);
    }

    const processedPhotos = (await Promise.all(photoProcessingPromises)).filter(p => p !== null) as UploadedPhoto[];
    
    const updatedPhotos = [...uploadedPhotos, ...processedPhotos];
    setUploadedPhotos(updatedPhotos);
    onPhotosUploaded(updatedPhotos.map(p => ({ name: p.name, dataUri: p.dataUri })));
    
    // Clear the input value to allow re-uploading the same file if removed
    event.target.value = '';

  }, [uploadedPhotos, onPhotosUploaded, maxFiles, maxFileSizeMb]);

  const removePhoto = (id: string) => {
    const updatedPhotos = uploadedPhotos.filter(photo => photo.id !== id);
    setUploadedPhotos(updatedPhotos);
    onPhotosUploaded(updatedPhotos.map(p => ({ name: p.name, dataUri: p.dataUri })));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="photo-upload-input" className="block text-sm font-medium text-foreground mb-1">Upload Photos (Max {maxFiles}, {maxFileSizeMb}MB each)</Label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-input hover:border-primary transition-colors">
          <div className="space-y-1 text-center">
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="flex text-sm text-muted-foreground">
              <label
                htmlFor="photo-upload-input"
                className="relative cursor-pointer rounded-md font-medium text-primary hover:text-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              >
                <span>Upload files</span>
                <Input
                  id="photo-upload-input"
                  name="photo-upload-input"
                  type="file"
                  className="sr-only"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploadedPhotos.length >= maxFiles}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to {maxFileSizeMb}MB</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {uploadedPhotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {uploadedPhotos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square border rounded-md overflow-hidden shadow-sm">
              <Image
                src={photo.dataUri}
                alt={photo.name}
                layout="fill"
                objectFit="cover"
                className="group-hover:opacity-75 transition-opacity"
                data-ai-hint="vehicle damage"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(photo.id)}
                aria-label={`Remove ${photo.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-xs text-white truncate">
                {photo.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
