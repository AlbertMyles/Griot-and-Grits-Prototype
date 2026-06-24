import React, { useEffect, useState } from 'react';
import { Stats, Media, Entity } from '../types';
import { Users, MapPin, Calendar, Activity, ArrowRight, Library } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

interface DashboardProps {
  onSelectMedia: (media: Media) => void;
  onViewAll: () => void;
  onStatClick: (type: 'media' | 'entities' | 'places' | 'events') => void;
}

export default function Dashboard({ onSelectMedia, onViewAll, onStatClick }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const mediaQuery = query(collection(db, 'media'), orderBy('created_at', 'desc'), limit(5));
    
    const unsubscribeMedia = onSnapshot(mediaQuery, async (snapshot) => {
      const entitiesSnapshot = await getDocs(collection(db, 'entities'));
      const allEntities = entitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any as Entity[];

      const recentMedia = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          entities: allEntities.filter(e => e.media_id === doc.id)
        } as Media;
      });
      
      // For simplicity in this demo, we'll fetch other counts once when media changes
      const mediaCountSnap = await getDocs(collection(db, 'media'));
      const entitiesSnap = await getDocs(collection(db, 'entities'));
      const placesSnap = await getDocs(query(collection(db, 'entities'), where('type', '==', 'Places')));
      const eventsSnap = await getDocs(query(collection(db, 'entities'), where('type', '==', 'Events')));

      setStats({
        mediaCount: mediaCountSnap.size,
        entityCount: entitiesSnap.size,
        placeCount: placesSnap.size,
        eventCount: eventsSnap.size,
        recentMedia
      });
    });

    return () => unsubscribeMedia();
  }, []);

  if (!stats) return <div className="animate-pulse">Loading archive statistics...</div>;

  const statCards = [
    { id: 'media', label: 'Oral Histories', value: stats.mediaCount, icon: Library, color: 'bg-blue-500' },
    { id: 'entities', label: 'Identified Entities', value: stats.entityCount, icon: Users, color: 'bg-emerald-500' },
    { id: 'places', label: 'Geographic Points', value: stats.placeCount, icon: MapPin, color: 'bg-amber-500' },
    { id: 'events', label: 'Historical Milestones', value: stats.eventCount, icon: Calendar, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-serif italic font-bold text-[#1A1A1A]">Archive Overview</h2>
        <p className="text-black/60 mt-2">Preserving the voices of our ancestors and the stories of our communities.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onStatClick(stat.id as any)}
            className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow group"
          >
            <div className={`p-4 rounded-2xl ${stat.color} text-white group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-black/40 font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">Recent Additions</h3>
            <button 
              onClick={onViewAll}
              className="text-[#F27D26] flex items-center gap-2 text-sm font-semibold hover:underline"
            >
              View All <ArrowRight size={16} />
            </button>
          </div>
          <div className="space-y-4">
            {stats.recentMedia.map((item) => (
              <div 
                key={item.id} 
                onClick={() => onSelectMedia(item)}
                className="flex items-center gap-4 p-4 hover:bg-[#F5F2ED] rounded-2xl transition-colors cursor-pointer group"
              >
                <div className="w-16 h-16 rounded-xl bg-black/10 overflow-hidden flex-shrink-0">
                  <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold group-hover:text-[#F27D26] transition-colors">{item.title}</h4>
                  <p className="text-sm text-black/40 line-clamp-1">{item.summary}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-black/30">{new Date(item.created_at).toLocaleDateString()}</p>
                  <p className="text-xs font-mono text-black/30 uppercase">{item.duration}</p>
                </div>
              </div>
            ))}
            {stats.recentMedia.length === 0 && (
              <div className="text-center py-12 text-black/30 italic">
                No media in the archive yet. Start by uploading an oral history.
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1A1A1A] text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-serif italic font-bold mb-4">Griot's Wisdom</h3>
            <p className="text-white/70 leading-relaxed mb-6 italic">
              "Until the lion has his or her own storyteller, the hunter will always have the best part of the story."
            </p>
            <div className="h-px bg-white/10 mb-6" />
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#F27D26]" />
                <span className="text-sm text-white/60">System actively monitoring for cultural connections</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-white/60">Entity extraction engine operational</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10">
            <Library size={200} />
          </div>
        </div>
      </div>
    </div>
  );
}
