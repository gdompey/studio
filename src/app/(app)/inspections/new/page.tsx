// src/app/(app)/inspections/new/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { InspectionForm } from '@/components/inspection/InspectionForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Camera, MapPin, AlertTriangle, CheckCircle, ArrowRight, Video, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import type { InspectionPhoto } from '@/types';

type Step = 'capture' | 'details';

export default function NewInspectionPage() {
  const [currentStep, setCurrentStep] = useState<Step>('capture');
  
  // Capture Step State
  const [capturedPhotos, setCapturedPhotos] = useState<InspectionPhoto[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false); // For photo capture process

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Request Camera Permission
  useEffect(() => {
    if (currentStep !== 'capture') return;

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };
    if (hasCameraPermission === null) {
       getCameraPermission();
    }
    
    // Cleanup stream on component unmount or step change
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [currentStep, toast, hasCameraPermission]);

  // Request Location Permission & Get Location
  useEffect(() => {
    if (currentStep !== 'capture') return;

    const getLocation = () => {
      if (navigator.geolocation) {
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setHasLocationPermission(true);
            setLocationError(null);
            toast({ title: "Location Captured", description: `Lat: ${position.coords.latitude.toFixed(4)}, Lon: ${position.coords.longitude.toFixed(4)}` });
          },
          (error) => {
            let message = "Error retrieving location.";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                message = "Location access denied. Please enable location services.";
                break;
              case error.POSITION_UNAVAILABLE:
                message = "Location information is unavailable.";
                break;
              case error.TIMEOUT:
                message = "Request to get user location timed out.";
                break;
              default:
                message = "An unknown error occurred while fetching location.";
                break;
            }
            setLocationError(message);
            setHasLocationPermission(false);
            setLocation(null);
            toast({ variant: "destructive", title: "Location Error", description: message });
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } else {
        const message = "Geolocation is not supported by this browser.";
        setLocationError(message);
        setHasLocationPermission(false);
        toast({ variant: "destructive", title: "Location Not Supported", description: message });
      }
    };
    
    if (hasLocationPermission === null && !locationError) {
        getLocation();
    }
  }, [currentStep, toast, hasLocationPermission, locationError]);


  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !hasCameraPermission) {
      toast({ variant: 'destructive', title: 'Camera not ready', description: 'Cannot take photo.' });
      return;
    }
    if (capturedPhotos.length >= 5) { // Max 5 initial photos
        toast({ variant: 'destructive', title: 'Maximum Photos Reached', description: 'You can take up to 5 initial photos.' });
        return;
    }

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUri = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller size
    const newPhoto: InspectionPhoto = {
        name: `initial_photo_${Date.now()}.jpg`,
        url: '', // URL will be set upon actual upload if needed
        dataUri: dataUri,
    };
    setCapturedPhotos(prevPhotos => [...prevPhotos, newPhoto]);
    toast({ title: 'Photo Captured!', description: `Photo ${capturedPhotos.length + 1} added.` });
    setIsCapturing(false);
  };

  const handleRemovePhoto = (index: number) => {
    setCapturedPhotos(prevPhotos => prevPhotos.filter((_, i) => i !== index));
  };

  const proceedToDetails = () => {
    if (capturedPhotos.length === 0) {
      toast({ variant: 'destructive', title: 'No Photos', description: 'Please take at least one photo to proceed.' });
      return;
    }
    if (!location) {
      toast({ variant: 'destructive', title: 'No Location', description: 'Location data is required. Please ensure location services are enabled.' });
      return;
    }
    setCurrentStep('details');
  };

  const pageTitle = currentStep === 'capture' ? "Initial Capture: Photos & Location" : "New Truck Inspection Details";
  const pageDescription = currentStep === 'capture' 
    ? "Take initial photos of the truck and capture its current location."
    : "Fill out the form below to record the new truck inspection.";

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          {currentStep === 'capture' ? <Camera className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" /> }
          {pageTitle}
        </h1>
        <p className="text-muted-foreground mt-1">
          {pageDescription}
        </p>
      </header>

      {currentStep === 'capture' && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Video className="h-6 w-6 text-primary" /> Live Camera Feed</CardTitle>
            <CardDescription>Position the truck and take clear photos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative aspect-video bg-muted rounded-md overflow-hidden border">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
                  <AlertTriangle className="h-10 w-10 mb-2" />
                  <p className="text-center font-semibold">Camera Access Denied</p>
                  <p className="text-center text-sm">Please enable camera permissions in your browser settings.</p>
                </div>
              )}
              {hasCameraPermission === null && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                 </div>
              )}
            </div>

            <Button onClick={handleTakePhoto} disabled={!hasCameraPermission || isCapturing || capturedPhotos.length >= 5} className="w-full sm:w-auto bg-accent hover:bg-accent/90">
              {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Take Photo ({capturedPhotos.length}/5)
            </Button>

            {capturedPhotos.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Captured Photos:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {capturedPhotos.map((photo, index) => (
                    <div key={index} className="relative aspect-square border rounded-md overflow-hidden group">
                      <Image src={photo.dataUri} alt={`Captured Photo ${index + 1}`} layout="fill" objectFit="cover" data-ai-hint="truck exterior"/>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemovePhoto(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
                <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Location Status</CardTitle>
                {location && hasLocationPermission && (
                    <Alert variant="default" className="bg-green-50 border-green-300">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <AlertTitle className="text-green-700">Location Captured!</AlertTitle>
                        <AlertDescription className="text-green-600">
                        Latitude: {location.latitude.toFixed(5)}, Longitude: {location.longitude.toFixed(5)}
                        </AlertDescription>
                    </Alert>
                )}
                {locationError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-5 w-5" />
                        <AlertTitle>Location Error</AlertTitle>
                        <AlertDescription>{locationError}</AlertDescription>
                    </Alert>
                )}
                {hasLocationPermission === null && !locationError && (
                     <div className="flex items-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Requesting location permission...
                     </div>
                )}
            </div>


            <Button 
                onClick={proceedToDetails} 
                disabled={capturedPhotos.length === 0 || !location || !hasCameraPermission || !hasLocationPermission}
                className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Proceed to Inspection Details <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 'details' && location && (
        <InspectionForm 
          initialPhotos={capturedPhotos}
          initialLocation={location}
        />
      )}
    </div>
  );
}
