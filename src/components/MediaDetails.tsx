import React, { useEffect, useState } from 'react';
import { Media, Entity } from '../types';
import { ArrowLeft, Clock, Monitor, Activity, Users, MapPin, Calendar, Share2, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';

interface MediaDetailsProps {
  media: Media;
  onBack: () => void;
}

export default function MediaDetails({ media, onBack }: MediaDetailsProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (!media.id) return;

    const q = query(collection(db, 'entities'), where('media_id', '==', media.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setEntities(entityData);
      setLoadingEntities(false);
    });

    return () => unsubscribe();
  }, [media.id]);

  const handleDelete = async () => {
    if (!media.id) return;
    setIsDeleting(true);
    try {
      // 1. Delete associated entities
      const q = query(collection(db, 'entities'), where('media_id', '==', media.id));
      const entitiesSnapshot = await getDocs(q);
      const deletePromises = entitiesSnapshot.docs.map(entityDoc => deleteDoc(entityDoc.ref));
      await Promise.all(deletePromises);

      // 2. Delete video from Storage if it exists
      if (media.video_url) {
        try {
          const videoRef = storageRef(storage, media.video_url);
          await deleteObject(videoRef);
        } catch (storageErr) {
          console.warn("Could not delete video file from storage:", storageErr);
          // Continue anyway to delete the database record
        }
      }

      // 3. Delete the media document
      await deleteDoc(doc(db, 'media', media.id));
      onBack();
    } catch (error) {
      console.error("Error deleting narrative:", error);
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-black/40 hover:text-[#F27D26] transition-colors"
        >
          <ArrowLeft size={16} /> Back to Collection
        </button>

        <button 
          onClick={() => setShowConfirmDelete(true)}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-rose-500/60 hover:text-rose-500 transition-colors"
        >
          <Trash2 size={16} /> Remove Narrative
        </button>
      </div>

      <AnimatePresence>
        {showConfirmDelete && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl space-y-6 text-center">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif italic font-bold">Remove from Archive?</h3>
                <p className="text-black/60 leading-relaxed">
                  This action will permanently delete this oral history and all its extracted cultural entities. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-[#F5F2ED] text-black font-bold rounded-2xl hover:bg-black/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Forever'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-5xl font-serif italic font-bold text-[#1A1A1A]">{media.title}</h2>
          <p className="text-black/40 font-mono text-xs uppercase tracking-[0.2em]">
            Archived on {new Date(media.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-white rounded-2xl border border-black/5 flex items-center gap-3">
            <Clock size={18} className="text-[#F27D26]" />
            <div>
              <p className="text-[10px] text-black/40 uppercase font-bold">Duration</p>
              <p className="text-sm font-bold">{media.duration}</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white rounded-2xl border border-black/5 flex items-center gap-3">
            <Monitor size={18} className="text-[#F27D26]" />
            <div>
              <p className="text-[10px] text-black/40 uppercase font-bold">Resolution</p>
              <p className="text-sm font-bold">{media.resolution}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white">
            {media.youtube_id ? (
              <iframe
                src={`https://www.youtube.com/embed/${media.youtube_id}?autoplay=0&rel=0`}
                title={media.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : media.video_url ? (
              <video 
                src={media.video_url} 
                controls 
                className="w-full h-full object-contain"
                poster={media.thumbnail}
              />
            ) : (
              <img 
                src={media.thumbnail} 
                alt={media.title} 
                className="w-full h-full object-cover opacity-90"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-black/5 space-y-6">
            <h3 className="text-2xl font-serif italic font-bold">Narrative Summary</h3>
            <p className="text-lg text-black/70 leading-relaxed font-serif italic">
              "{media.summary}"
            </p>
          </div>

          <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-black/5 space-y-6">
            <h3 className="text-2xl font-serif italic font-bold">Transcript</h3>
            <div className="max-h-96 overflow-y-auto pr-4 space-y-4 font-serif text-lg leading-relaxed text-black/60 custom-scrollbar">
              {media.transcript.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#1A1A1A] text-white rounded-[2.5rem] p-8 shadow-xl">
            <h3 className="text-xl font-serif italic font-bold mb-6 flex items-center gap-2">
              <Share2 size={20} className="text-[#F27D26]" />
              Extracted Entities
            </h3>
            
            <div className="space-y-6">
              {loadingEntities ? (
                <div className="flex items-center gap-2 text-white/40 font-mono text-xs uppercase tracking-widest py-4">
                  <Loader2 size={14} className="animate-spin" />
                  Extracting...
                </div>
              ) : entities.length === 0 ? (
                <p className="text-white/40 text-sm italic">No entities extracted for this record.</p>
              ) : (
                ['People', 'Places', 'Events', 'Movements'].map((type) => {
                  const filtered = entities.filter(e => e.type === type);
                  if (filtered.length === 0) return null;
                  
                  const Icon = type === 'People' ? Users : type === 'Places' ? MapPin : type === 'Events' ? Calendar : Share2;
                  
                  return (
                    <div key={type} className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        <Icon size={12} />
                        {type}
                      </div>
                      <div className="space-y-2">
                        {filtered.map((entity, idx) => (
                          <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <p className="font-bold text-sm text-[#F27D26]">{entity.name}</p>
                            <p className="text-xs text-white/50 mt-1 leading-tight">{entity.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-[#F27D26] text-white rounded-[2.5rem] p-8 shadow-xl">
            <h4 className="font-bold mb-2">Preservation Note</h4>
            <p className="text-sm text-white/80 leading-relaxed">
              This record is part of the permanent digital archive. All metadata and entities have been verified by the Griot AI engine for cultural accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
