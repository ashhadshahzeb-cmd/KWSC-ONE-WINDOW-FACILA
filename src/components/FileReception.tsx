import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileImage, ShieldCheck, CheckCircle2, Clock, Trash2, RefreshCw, Eye } from "lucide-react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useSyncManager } from "@/hooks/useSyncManager";
import { Badge } from "@/components/ui/badge";

export default function FileReception() {
  const [activeTab, setActiveTab] = useState("new_entry");
  const { mainCategories } = useAppConfig();
  const { isOnline, enqueue } = useSyncManager();

  // Form State
  const [trackingCode, setTrackingCode] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [fileImage, setFileImage] = useState<string>("");
  const [fileImages, setFileImages] = useState<string[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mobile Upload State
  const [mobileUploadSessionId, setMobileUploadSessionId] = useState<string>("");
  const [showMobileUploadQR, setShowMobileUploadQR] = useState(false);
  const [isMobileListening, setIsMobileListening] = useState(false);

  // Data State
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [completedFiles, setCompletedFiles] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      // Fetch from local db first
      const allLocal = await db.pendingFiles.toArray();
      let mergedData = [...allLocal];

      if (isOnline) {
        const { data, error } = await supabase
          .from('file_tracking_pending')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (!error && data) {
          const localDirty = allLocal.filter((l: any) => l.is_dirty);
          const dirtyCodes = new Set(localDirty.map((l: any) => l.tracking_code));
          mergedData = [
            ...localDirty,
            ...data.filter((d: any) => !dirtyCodes.has(d.tracking_code))
          ];
        }
      }

      setPendingFiles(mergedData.filter(r => r.status === 'pending'));
      setCompletedFiles(mergedData.filter(r => r.status === 'completed'));
    } catch (err) {
      console.error("Error fetching pending files", err);
    }
  };

  const generateTrackingCode = () => {
    const code = `TRK-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    setTrackingCode(code);
  };

  const handleSave = async () => {
    if (!trackingCode.trim()) {
      toast.error("Tracking code is required");
      return;
    }
    if (!category) {
      toast.error("Category is required");
      return;
    }
    
    setIsSaving(true);
    try {
      const codeToCheck = trackingCode.trim();
      
      // Check for duplicate code locally
      const allLocal = await db.pendingFiles.toArray();
      const existing = allLocal.find(r => r.tracking_code === codeToCheck);
      
      // Check for duplicate code online if not found locally
      let existsOnline = false;
      if (!existing && isOnline) {
        const { data } = await supabase
          .from('file_tracking_pending')
          .select('id')
          .eq('tracking_code', codeToCheck)
          .maybeSingle();
        if (data) existsOnline = true;
      }

      if (existing || existsOnline) {
        toast.error("This tracking code is already in use. Please generate a unique code.");
        setIsSaving(false);
        return;
      }
      const payload = {
        id: crypto.randomUUID ? crypto.randomUUID() : `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tracking_code: trackingCode.trim(),
        category,
        subject: subject.trim(),
        file_image: fileImages[0] || fileImage || null,
        file_images: fileImages.length > 0 ? fileImages : undefined,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // Save to local DB
      await db.pendingFiles.put({ ...payload, is_dirty: true } as any);

      // Queue for sync
      await enqueue({
        action: 'insert',
        table: 'file_tracking_pending',
        payload,
        record_id: payload.tracking_code
      });

      toast.success("File reception entry saved successfully!");
      setTrackingCode("");
      setCategory("");
      setSubject("");
      setFileImage("");
      setFileImages([]);
      fetchData();
      setActiveTab("pending_files");
    } catch (err: any) {
      toast.error(err.message || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            File Reception Desk
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Capture incoming files and assign tracking codes before processing.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#0f1115] border border-white/5 p-1">
          <TabsTrigger value="new_entry" className="text-xs font-bold px-4 py-2">
            New Entry
          </TabsTrigger>
          <TabsTrigger value="pending_files" className="text-xs font-bold px-4 py-2">
            Pending Queue
            {pendingFiles.length > 0 && (
              <Badge className="ml-2 bg-primary text-primary-foreground">{pendingFiles.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed_files" className="text-xs font-bold px-4 py-2">
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new_entry" className="mt-6">
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg">Register Incoming File</CardTitle>
              <CardDescription>Take a picture and assign a tracking code to the file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-white/70 uppercase">Tracking Code *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. TRK-123456"
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value)}
                        className="font-mono bg-[#111318] border-white/10"
                      />
                      <Button variant="outline" onClick={generateTrackingCode} className="shrink-0 bg-[#111318]">
                        Auto
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-white/70 uppercase">Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-[#111318] border-white/10">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {mainCategories.map(cat => (
                          <SelectItem key={cat.config_key} value={cat.config_key}>{cat.config_label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-white/70 uppercase">Subject</Label>
                    <Input
                      placeholder="e.g. Request for funds"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="bg-[#111318] border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-white/70 uppercase">Document Photos / Scans</Label>
                    {fileImages.length > 0 && (
                      <Badge variant="outline" className="text-xs font-bold text-teal-400 border-teal-500/30 bg-teal-500/10">
                        {fileImages.length} {fileImages.length === 1 ? 'Photo Attached' : 'Photos Attached'}
                      </Badge>
                    )}
                  </div>

                  {fileImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {fileImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 aspect-square">
                          <img src={img} alt={`Doc ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute top-1 left-1 bg-black/80 text-[10px] font-black px-1.5 py-0.5 rounded text-white">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = fileImages.filter((_, i) => i !== idx);
                              setFileImages(updated);
                              setFileImage(updated[0] || "");
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className={`cursor-pointer flex-1 ${isProcessingPhotos ? 'opacity-60 pointer-events-none' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={isProcessingPhotos}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          setIsProcessingPhotos(true);
                          try {
                            const newUrls: string[] = [];
                            for (const file of files) {
                              const dataUrl = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const img = new Image();
                                  img.src = ev.target?.result as string;
                                  img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const MAX = 1000;
                                    let w = img.width, h = img.height;
                                    if (w > h) { if (w > MAX) { h = Math.round((h * MAX) / w); w = MAX; } }
                                    else { if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; } }
                                    canvas.width = w; canvas.height = h;
                                    canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                                  };
                                };
                                reader.readAsDataURL(file);
                              });
                              newUrls.push(dataUrl);
                            }
                            setFileImages(prev => {
                              const updated = [...prev, ...newUrls];
                              setFileImage(updated[0] || "");
                              return updated;
                            });
                            toast.success(`Attached ${files.length} photo(s)!`);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsProcessingPhotos(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-white/10 bg-[#111318] hover:bg-[#1a1d24] transition-colors text-sm font-bold text-muted-foreground">
                        {isProcessingPhotos ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 text-teal-400" />
                            {fileImages.length > 0 ? "+ Add More from PC" : "Upload from PC (Multiple Allowed)"}
                          </>
                        )}
                      </div>
                    </label>

                    <Button
                      type="button"
                      variant="secondary"
                      className="h-auto py-4 font-bold bg-primary/10 text-primary hover:bg-primary/20 shrink-0"
                      onClick={() => {
                        const sessionId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                        setMobileUploadSessionId(sessionId);
                        setShowMobileUploadQR(true);
                        setIsMobileListening(true);
                        
                        const channel = supabase.channel(`mobile-upload-${sessionId}`);
                        channel
                          .on('broadcast', { event: 'image-uploaded' }, (payload) => {
                            if (payload?.payload?.image) {
                              const incoming: string[] = Array.isArray(payload.payload.image)
                                ? payload.payload.image
                                : [payload.payload.image];
                              setFileImages(prev => {
                                const updated = [...prev, ...incoming];
                                setFileImage(updated[0] || "");
                                return updated;
                              });
                              toast.success(`${incoming.length} photo(s) received from mobile!`);
                            }
                          })
                          .subscribe();
                      }}
                    >
                      <FileImage className="w-4 h-4 mr-2 text-teal-400" /> Use Mobile Camera
                    </Button>
                  </div>

                  {showMobileUploadQR && (
                    <div className="p-4 bg-white rounded-xl flex flex-col items-center justify-center gap-4">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.origin + '/mobile-upload/' + mobileUploadSessionId)}`}
                        alt="QR Code"
                        className="w-[160px] h-[160px]"
                      />
                      <p className="text-xs text-black font-medium text-center">Scan with mobile to take or select multiple photos</p>
                      {fileImages.length > 0 && (
                        <span className="text-xs font-bold text-teal-600">✓ {fileImages.length} photo(s) received</span>
                      )}
                      <Button size="sm" variant="outline" className="w-full text-black border-black/20" onClick={() => {
                        setShowMobileUploadQR(false);
                        setIsMobileListening(false);
                      }}>Done / Close</Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/5">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground font-bold px-8 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                >
                  {isSaving ? "Saving..." : "Save Reception Entry"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending_files" className="mt-6">
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Pending Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#111318]">
                    <TableRow className="border-white/5 border-b">
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Date</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Tracking Code</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Category</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingFiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-white/40 font-medium">No pending files found.</TableCell>
                      </TableRow>
                    ) : pendingFiles.map((file, i) => (
                      <TableRow key={i} className="border-white/5">
                        <TableCell className="text-xs text-white/70">{new Date(file.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-bold text-primary">{file.tracking_code}</TableCell>
                        <TableCell className="text-xs uppercase font-medium">{mainCategories.find(c => c.config_key === file.category)?.config_label || file.category}</TableCell>
                        <TableCell>
                          <Badge className="bg-amber-500/10 text-amber-500 border-none font-bold">Pending</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed_files" className="mt-6">
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Completed Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#111318]">
                    <TableRow className="border-white/5 border-b">
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Date</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Tracking Code</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Category</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-white/50">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedFiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-white/40 font-medium">No completed files found.</TableCell>
                      </TableRow>
                    ) : completedFiles.map((file, i) => (
                      <TableRow key={i} className="border-white/5">
                        <TableCell className="text-xs text-white/70">{new Date(file.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono font-bold text-white/60">{file.tracking_code}</TableCell>
                        <TableCell className="text-xs uppercase font-medium text-white/60">{mainCategories.find(c => c.config_key === file.category)?.config_label || file.category}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold">Completed</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
