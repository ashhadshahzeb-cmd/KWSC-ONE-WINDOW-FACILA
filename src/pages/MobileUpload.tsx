import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, CheckCircle2, RefreshCw, Upload, Image as ImageIcon, Trash2, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function MobileUpload() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality for crisp yet lightweight size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (e) => reject(e);
      };
      reader.onerror = (e) => reject(e);
    });
  };

  const uploadImageToStorage = async (dataUrl: string): Promise<string> => {
    try {
      const blob = await fetch(dataUrl).then(r => r.blob());
      const fileName = `doc_images/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const { data, error } = await supabase.storage
        .from('file-tracking-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      if (error) {
        console.warn('Storage upload error, falling back to dataUrl:', error.message);
        return dataUrl;
      }
      const { data: urlData } = supabase.storage
        .from('file-tracking-images')
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (e) {
      console.warn('Storage upload exception, falling back to dataUrl:', e);
      return dataUrl;
    }
  };

  const handleFiles = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    setIsCompressing(true);
    try {
      const compressedList: string[] = [];
      for (const file of files) {
        const compressed = await compressImage(file);
        compressedList.push(compressed);
      }
      setPhotos(prev => [...prev, ...compressedList]);
      toast.success(`Added ${compressedList.length} photo(s)! (${photos.length + compressedList.length} total)`);
    } catch (err) {
      console.error("Compression error:", err);
      toast.error("Failed to process some images. Please try again.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = async () => {
    if (photos.length === 0 || !sessionId) {
      toast.error("Please take or select at least one photo.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Processing ${photos.length} photos...`);

    try {
      // 1. Upload each photo to Supabase storage first (tiny broadcast payload)
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${photos.length}...`);
        const url = await uploadImageToStorage(photos[i]);
        uploadedUrls.push(url);
      }

      setUploadProgress("Syncing to desktop...");
      const channelName = `mobile-upload-${sessionId}`;
      const channel = supabase.channel(channelName);
      
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Send broadcast with array of uploaded image URLs
          const response = await channel.send({
            type: 'broadcast',
            event: 'image-uploaded',
            payload: { image: uploadedUrls },
          });

          if (response === 'ok') {
            setUploadedCount(uploadedUrls.length);
            setIsSuccess(true);
            toast.success(`${uploadedUrls.length} photo(s) sent to desktop!`);
            setTimeout(() => {
              supabase.removeChannel(channel);
            }, 2000);
          } else {
            throw new Error("Failed to send image data to desktop.");
          }
        } else if (status === 'CHANNEL_ERROR') {
          toast.error("Failed to connect to real-time sync channel.");
          setIsUploading(false);
        }
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload images. Please try again.");
      setIsUploading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-white flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md bg-zinc-900 border-teal-500/30 text-center py-8">
          <CardContent className="space-y-6">
            <CheckCircle2 className="w-20 h-20 text-teal-500 mx-auto animate-bounce" />
            <h2 className="text-2xl font-black tracking-tight">Upload Complete!</h2>
            <p className="text-zinc-400 text-sm">
              Successfully sent <strong>{uploadedCount} photo(s)</strong> to the desktop system.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  setPhotos([]);
                  setIsSuccess(false);
                }}
              >
                Upload More Photos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex flex-col items-center justify-center p-4 py-8">
      <Card className="w-full max-w-md bg-zinc-900 border-white/10 shadow-2xl">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-xl font-black tracking-tight text-teal-400">
            Document Mobile Upload
          </CardTitle>
          <p className="text-xs text-zinc-400">Capture or select multiple document photos to sync with desktop</p>
        </CardHeader>
        <CardContent className="space-y-5">
          
          {/* Photos Grid or Empty state */}
          {photos.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 px-1">
                <span>Selected Photos ({photos.length})</span>
                <button
                  type="button"
                  onClick={() => setPhotos([])}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1 bg-black/40 rounded-xl border border-white/5">
                {photos.map((src, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group bg-black/50 cursor-pointer">
                    <img
                      src={src}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onClick={() => setPreviewPhoto(src)}
                    />
                    <span className="absolute top-1 left-1 bg-black/80 text-[10px] font-black px-1.5 py-0.5 rounded text-white pointer-events-none">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotos(photos.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-md transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-800 rounded-2xl h-52 flex flex-col items-center justify-center p-4 text-center bg-black/40">
              <ImageIcon className="w-12 h-12 text-zinc-600 mb-2" />
              <span className="text-sm font-bold text-zinc-400">No Photos Selected Yet</span>
              <span className="text-[11px] text-zinc-600 mt-1">Take pictures with camera or pick from gallery</span>
            </div>
          )}

          {isCompressing && (
            <div className="flex items-center justify-center gap-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-xs font-bold text-teal-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Processing photos...
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              {/* Camera Button */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                  disabled={isCompressing || isUploading}
                />
                <div className="flex items-center justify-center gap-2 h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all border border-white/10 shadow-sm">
                  <Camera className="w-4 h-4 text-teal-400" />
                  {photos.length > 0 ? "+ Snap Next Page" : "Take Photo (Camera)"}
                </div>
              </label>

              {/* Gallery Multiple Picker */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                  disabled={isCompressing || isUploading}
                />
                <div className="flex items-center justify-center gap-2 h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all border border-white/10 shadow-sm">
                  <Plus className="w-4 h-4 text-teal-400" />
                  Pick Gallery (Multi)
                </div>
              </label>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={photos.length === 0 || isCompressing || isUploading}
              className="w-full h-12 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-black font-black rounded-xl gap-2 shadow-lg shadow-teal-500/20"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  {uploadProgress || `Uploading ${photos.length} photo(s)...`}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Sync All {photos.length > 0 ? `(${photos.length} Photos)` : ''} to Desktop
                </>
              )}
            </Button>

            <p className="text-[11px] text-zinc-500 text-center pt-1">
              💡 Tap <strong>"Snap Next Page"</strong> repeatedly to capture documents page-by-page, or pick multiple files from your gallery.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Full Photo Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-full max-h-[85vh]">
            <img src={previewPhoto} alt="Full view" className="max-h-[80vh] max-w-full object-contain rounded-xl" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 right-2 p-2 bg-black/80 text-white rounded-full font-bold text-xs"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
