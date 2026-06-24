import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileVideo, Loader2, CheckCircle2, AlertCircle, X, Link as LinkIcon, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { processVideo, processYoutubeUrl } from '../services/geminiService';
import { db, auth, storage } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface MediaUploadProps {
  onComplete: () => void;
}

type UploadMode = 'file' | 'youtube';

export default function MediaUpload({ onComplete }: MediaUploadProps) {
  const [mode, setMode] = useState<UploadMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'video/*': [],
      'audio/*': []
    },
    multiple: false
  });

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
        video.remove();
      };

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(dataUrl);
        } else {
          cleanup();
          resolve(`https://picsum.photos/seed/${file.name}/640/360`);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(`https://picsum.photos/seed/${file.name}/640/360`);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async () => {
    if (!auth.currentUser) return;
    
    let youtubeId = null;
    if (mode === 'youtube') {
      youtubeId = extractYoutubeId(youtubeUrl);
      if (!youtubeId) {
        setError('Invalid YouTube URL. Please provide a valid link.');
        return;
      }
    }

    if (!file && mode === 'file') {
      setError('Please select a video or audio file to upload.');
      return;
    }

    setIsUploading(true);
    setStatus(file ? 'Preparing upload...' : 'Connecting to YouTube...');
    setProgress(5);

    try {
      let thumbnail = '';
      let videoUrl = null;

      if (mode === 'youtube') {
        thumbnail = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
      } else if (file) {
        const isAudio = file.type.startsWith('audio/');
        
        // 1. Upload to Firebase Storage
        setStatus(isAudio ? 'Uploading audio to archive storage...' : 'Uploading video to archive storage...');
        try {
          const storageRef = ref(storage, `${isAudio ? 'audio' : 'videos'}/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);

          videoUrl = await new Promise<string>((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => {
                const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 30);
                setProgress(5 + p);
              }, 
              (error) => {
                console.error("Storage upload error:", error);
                reject(error);
              }, 
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              }
            );
          });
        } catch (storageErr: any) {
          console.error("Detailed Storage Error:", storageErr);
          if (storageErr.code === 'storage/retry-limit-exceeded') {
            throw new Error('Upload failed: The storage bucket is unreachable. This usually means CORS needs to be configured or the Storage service hasn\'t been started in the Firebase Console.');
          } else if (storageErr.code === 'storage/unknown') {
            throw new Error('Upload failed: An unknown error occurred. This often happens if the Google Cloud Storage API is not enabled for your project, or if there is a network interruption.');
          }
          throw storageErr;
        }

        // 2. Generate Thumbnail (only for video)
        if (!isAudio) {
          setStatus('Generating thumbnail...');
          thumbnail = await generateThumbnail(file);
        } else {
          thumbnail = `https://picsum.photos/seed/${file.name}/640/360?grayscale`;
        }
        setProgress(40);
      }
      
      let analysis;
      if (file) {
        setStatus('Griot is analyzing the oral history...');
        setProgress(45);

        // For analysis, we still need base64 for Gemini inlineData
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        analysis = await processVideo(fileData, file.type);
      } else if (youtubeId) {
        setStatus('Griot is analyzing the YouTube video...');
        setProgress(50);
        analysis = await processYoutubeUrl(youtubeUrl);
      } else {
        throw new Error('No source provided for analysis.');
      }

      setProgress(85);
      setStatus('Saving to archive...');

      const mediaData = {
        title: analysis.title || (file ? file.name.replace(/\.[^/.]+$/, "") : `YouTube Record (${youtubeId})`),
        filename: file ? file.name : `youtube_${youtubeId}`,
        thumbnail: thumbnail || "",
        youtube_id: youtubeId || null,
        video_url: videoUrl,
        duration: analysis.metadata?.duration || "Unknown",
        resolution: analysis.metadata?.resolution || "Unknown",
        frame_rate: analysis.metadata?.frame_rate || "Unknown",
        transcript: analysis.transcript || "No transcript available.",
        summary: analysis.summary || "No summary available.",
        authorId: auth.currentUser.uid,
        created_at: new Date().toISOString()
      };

      const mediaRef = await addDoc(collection(db, 'media'), mediaData);

      if (analysis.entities && Array.isArray(analysis.entities)) {
        for (const entity of analysis.entities) {
          await addDoc(collection(db, 'entities'), {
            type: entity.type || "Unknown",
            name: entity.name || "Unknown",
            description: entity.description || "",
            media_id: mediaRef.id
          });
        }
      }

      setProgress(100);
      setStatus('Archive updated successfully!');
      setTimeout(() => onComplete(), 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error processing with AI');
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="text-center">
        <h2 className="text-4xl font-serif italic font-bold text-[#1A1A1A]">Contribute to the Archive</h2>
        <p className="text-black/60 mt-2">Upload a video or link a YouTube record to preserve its cultural significance.</p>
      </header>

      <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-black/5">
        {!isUploading ? (
          <div className="space-y-8">
            <div className="flex p-1 bg-[#F5F2ED] rounded-2xl">
              <button 
                onClick={() => setMode('file')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'file' ? 'bg-white shadow-sm text-[#F27D26]' : 'text-black/40 hover:text-black/60'}`}
              >
                <FileVideo size={18} />
                Upload File
              </button>
              <button 
                onClick={() => setMode('youtube')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'youtube' ? 'bg-white shadow-sm text-[#F27D26]' : 'text-black/40 hover:text-black/60'}`}
              >
                <Youtube size={18} />
                Link YouTube
              </button>
            </div>

            {mode === 'youtube' && (
              <div className="space-y-4">
                <div className="relative">
                  <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" size={20} />
                  <input 
                    type="text"
                    placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-[#F5F2ED] rounded-2xl border-0 focus:ring-2 focus:ring-[#F27D26] font-medium"
                  />
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3">
                  <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    <strong>Smart Link:</strong> The Griot can now analyze public YouTube videos directly. No file upload is required if the video is public or unlisted.
                  </p>
                </div>
              </div>
            )}

            {mode === 'file' && (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer ${
                  isDragActive ? 'border-[#F27D26] bg-[#F27D26]/5' : 'border-black/10 hover:border-[#F27D26]/50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-20 h-20 bg-[#F5F2ED] rounded-full flex items-center justify-center mx-auto mb-6 text-[#F27D26]">
                  <Upload size={32} />
                </div>
                {file ? (
                  <div className="space-y-2">
                    <p className="text-xl font-bold">{file.name}</p>
                    <p className="text-sm text-black/40">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-rose-500 font-bold uppercase tracking-widest hover:underline"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xl font-bold">Drag & drop video or audio file for analysis</p>
                    <p className="text-sm text-black/40">or click to browse files</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 text-sm"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

            <button
              onClick={handleUpload}
              disabled={(mode === 'file' && !file) || (mode === 'youtube' && !youtubeUrl)}
              className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold text-lg hover:bg-black transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <FileVideo size={20} />
              Process Oral History
            </button>
          </div>
        ) : (
          <div className="py-12 text-center space-y-8">
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-black/5"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="60"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={377}
                  strokeDashoffset={377 - (377 * progress) / 100}
                  className="text-[#F27D26] transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={32} className="text-[#F27D26] animate-spin" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-serif italic font-bold">{status}</h3>
              <p className="text-black/40 font-mono text-sm uppercase tracking-widest">Processing Phase: {progress}%</p>
            </div>

            <div className="max-w-md mx-auto p-6 bg-[#F5F2ED] rounded-3xl text-left space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${progress >= 10 ? 'bg-emerald-500 text-white' : 'bg-black/10'}`}>
                  {progress >= 10 ? <CheckCircle2 size={12} /> : 1}
                </div>
                <span className={progress >= 10 ? 'text-black' : 'text-black/40'}>File ingestion</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${progress >= 30 ? 'bg-emerald-500 text-white' : 'bg-black/10'}`}>
                  {progress >= 30 ? <CheckCircle2 size={12} /> : 2}
                </div>
                <span className={progress >= 30 ? 'text-black' : 'text-black/40'}>AI Transcription & Analysis</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${progress >= 80 ? 'bg-emerald-500 text-white' : 'bg-black/10'}`}>
                  {progress >= 80 ? <CheckCircle2 size={12} /> : 3}
                </div>
                <span className={progress >= 80 ? 'text-black' : 'text-black/40'}>Database Ingestion</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
