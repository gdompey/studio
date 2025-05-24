
// src/components/inspection/PhotoUpload.tsx
"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, UploadCloud, AlertTriangle, Camera, Video, RefreshCw, SwitchCamera } from 'lucide-react';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '../ui/alert';

interface PhotoUploadProps {
  onPhotosUploaded: (photos: { name: string; dataUri: string }[]) => void;
  maxFiles?: number;
  maxFileSizeMb?: number; // Max file size in MB
}

interface UploadedPhoto {
  id: string;
  name:string;
  dataUri: string;
  file?: File; // Keep original file for potential direct upload later
}

export function PhotoUpload({
  onPhotosUploaded,
  maxFiles = 5,
  maxFileSizeMb = 5
}: PhotoUploadProps) {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Camera Modal State
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentFacingMode, setCurrentFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files) return;

    if (uploadedPhotos.length + files.length > maxFiles) {
      setError(`You can upload a maximum of ${maxFiles} photos.`);
      toast({ title: "Limit Reached", description: `Cannot upload more than ${maxFiles} photos.`, variant: "destructive" });
      return;
    }

    const newPhotosPromises = Array.from(files).map(file => {
      return new Promise<UploadedPhoto | null>((resolve) => {
        if (file.size > maxFileSizeMb * 1024 * 1024) {
          setError(`File "${file.name}" exceeds the ${maxFileSizeMb}MB size limit.`);
          toast({ title: "File Too Large", description: `"${file.name}" is too large. Max ${maxFileSizeMb}MB.`, variant: "destructive" });
          resolve(null);
          return;
        }
        if (!file.type.startsWith('image/')) {
          setError(`File "${file.name}" is not a valid image type.`);
          toast({ title: "Invalid File Type", description: `"${file.name}" is not an image.`, variant: "destructive" });
          resolve(null);
          return;
        }

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
            resolve(null);
          }
        };
        reader.onerror = () => {
          setError(`Error reading file ${file.name}`);
          toast({ title: "File Read Error", description: `Could not read "${file.name}".`, variant: "destructive" });
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    });

    const newPhotos = (await Promise.all(newPhotosPromises)).filter(p => p !== null) as UploadedPhoto[];
    
    if (newPhotos.length > 0) {
      const updatedPhotos = [...uploadedPhotos, ...newPhotos].slice(0, maxFiles);
      setUploadedPhotos(updatedPhotos);
      onPhotosUploaded(updatedPhotos.map(p => ({ name: p.name, dataUri: p.dataUri })));
    }
    
    event.target.value = ''; // Clear the input
  }, [uploadedPhotos, onPhotosUploaded, maxFiles, maxFileSizeMb, toast]);

  const removePhoto = (id: string) => {
    const updatedPhotos = uploadedPhotos.filter(photo => photo.id !== id);
    setUploadedPhotos(updatedPhotos);
    onPhotosUploaded(updatedPhotos.map(p => ({ name: p.name, dataUri: p.dataUri })));
  };

  // Camera Logic Effects and Handlers
  useEffect(() => {
    if (!showCameraModal) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    let activeStream: MediaStream | null = null;

    const startSelectedCamera = async () => {
      setCameraError(null);
      setHasCameraPermission(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
        activeStream = stream;
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error(`Error accessing camera with ${currentFacingMode}:`, error);
        setCameraError(`Failed to access ${currentFacingMode} camera. Trying fallback.`);
        const fallbackMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fallbackMode } });
          activeStream = stream;
          if (currentFacingMode !== fallbackMode) {
              setCurrentFacingMode(fallbackMode); 
          }
          setHasCameraPermission(true);
          setCameraError(null); // Clear previous error
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (fallbackError) {
          console.error('Error accessing fallback camera:', fallbackError);
          setHasCameraPermission(false);
          activeStream = null;
          if (videoRef.current) videoRef.current.srcObject = null;
          setCameraError('Could not access any camera. Please check permissions.');
          toast({ variant: 'destructive', title: 'Camera Access Failed', description: 'Could not access any camera.' });
        }
      }
    };

    startSelectedCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
       if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
    };
  }, [showCameraModal, currentFacingMode, toast]);

  const handleTakePhotoFromModal = () => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission) {
      toast({ variant: 'destructive', title: 'Camera not ready' });
      return;
    }
    if (uploadedPhotos.length >= maxFiles) {
        toast({ variant: 'destructive', title: 'Maximum Photos Reached', description: `You can only add up to ${maxFiles} photos.` });
        setShowCameraModal(false);
        return;
    }

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUri = canvas.toDataURL('image/jpeg', 0.8);
    const newPhoto: UploadedPhoto = {
        id: `camera-${Date.now()}`,
        name: `capture_${Date.now()}.jpg`,
        dataUri: dataUri,
    };
    
    const updatedPhotos = [...uploadedPhotos, newPhoto].slice(0, maxFiles);
    setUploadedPhotos(updatedPhotos);
    onPhotosUploaded(updatedPhotos.map(p => ({ name: p.name, dataUri: p.dataUri })));
    
    toast({ title: 'Photo Captured!', description: `Photo ${updatedPhotos.length} added.` });
    setIsCapturing(false);
    setShowCameraModal(false); // Close modal after capture
  };

  const handleSwitchCamera = () => {
    setCurrentFacingMode(prevMode => (prevMode === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-grow">
            <Label htmlFor="photo-upload-input" className="block text-sm font-medium text-foreground mb-1">Upload Photos (Max {maxFiles}, {maxFileSizeMb}MB each)</Label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-input hover:border-primary transition-colors">
            <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
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
        <div className="flex-shrink-0 sm:self-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowCameraModal(true)}
              disabled={uploadedPhotos.length >= maxFiles}
              className="w-full sm:w-auto"
            >
              <Camera className="mr-2 h-4 w-4" /> Use Camera
            </Button>
        </div>
      </div>


      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
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

      <Dialog open={showCameraModal} onOpenChange={setShowCameraModal}>
        <DialogContent className="sm:max-w-[600px] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2"><Video className="h-6 w-6 text-primary" /> Live Camera Feed</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden border">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white p-4">
                  <AlertTriangle className="h-10 w-10 mb-2 text-red-400" />
                  <p className="text-center font-semibold">Camera Access Denied</p>
                  <p className="text-center text-sm">Please enable camera permissions.</p>
                </div>
              )}
              {hasCameraPermission === null && !cameraError && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <RefreshCw className="h-12 w-12 animate-spin text-white" />
                 </div>
              )}
            </div>
            {cameraError && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4"/>
                    <AlertDescription>{cameraError}</AlertDescription>
                </Alert>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                    onClick={handleTakePhotoFromModal} 
                    disabled={hasCameraPermission !== true || isCapturing || uploadedPhotos.length >= maxFiles}
                    className="flex-grow bg-accent hover:bg-accent/90"
                >
                    {isCapturing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Take Photo
                </Button>
                <Button 
                    onClick={handleSwitchCamera} 
                    disabled={hasCameraPermission !== true} 
                    variant="outline"
                    className="flex-grow"
                >
                    <SwitchCamera className="mr-2 h-4 w-4" /> Switch Camera
                </Button>
            </div>
          </div>
          <DialogFooter className="p-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

    