import React, { useEffect, useState } from 'react';
import { Media, Entity } from '../types';
import { Play, Info, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';

interface CollectionProps {
  onSelectMedia: (media: Media) => void;
}

export default function Collection({ onSelectMedia }: CollectionProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'media'), orderBy('created_at', 'desc'));
    
    // Fetch entities separately and map them
    const unsubscribeMedia = onSnapshot(q, async (mediaSnapshot) => {
      const entitiesSnapshot = await getDocs(collection(db, 'entities'));
      const allEntities = entitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any as Entity[];

      const mediaData = mediaSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          entities: allEntities.filter(e => e.media_id === doc.id)
        } as Media;
      });
      
      setMedia(mediaData);
    });

    return () => unsubscribeMedia();
  }, []);

  const filteredMedia = media.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-serif italic font-bold text-[#1A1A1A]">Media Collection</h2>
          <p className="text-black/60 mt-2">A repository of voices and cultural narratives.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={18} />
            <input 
              type="text" 
              placeholder="Search archive..." 
              className="pl-10 pr-4 py-2 bg-white border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F27D26]/20 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 bg-white border border-black/5 rounded-xl hover:bg-black/5 transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredMedia.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group bg-white rounded-3xl overflow-hidden shadow-sm border border-black/5 hover:shadow-xl transition-all duration-500"
          >
            <div className="aspect-video bg-black relative overflow-hidden">
              <img 
                src={item.thumbnail} 
                alt={item.title} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <button 
                  onClick={() => onSelectMedia(item)}
                  className="w-16 h-16 bg-[#F27D26] text-white rounded-full flex items-center justify-center shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                >
                  <Play size={24} fill="currentColor" />
                </button>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono rounded uppercase tracking-widest">
                  {item.duration}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 group-hover:text-[#F27D26] transition-colors">{item.title}</h3>
              <p className="text-sm text-black/60 line-clamp-2 mb-4 leading-relaxed">
                {item.summary}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-black/5">
                <div className="flex -space-x-2">
                  {item.entities?.slice(0, 3).map((entity, idx) => (
                    <div 
                      key={idx}
                      className="w-8 h-8 rounded-full bg-[#F5F2ED] border-2 border-white flex items-center justify-center text-[10px] font-bold"
                      title={entity.name}
                    >
                      {entity.name.charAt(0)}
                    </div>
                  ))}
                  {(item.entities?.length || 0) > 3 && (
                    <div className="w-8 h-8 rounded-full bg-black text-white border-2 border-white flex items-center justify-center text-[10px] font-bold">
                      +{(item.entities?.length || 0) - 3}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => onSelectMedia(item)}
                  className="text-xs font-bold uppercase tracking-widest text-black/40 hover:text-[#F27D26] transition-colors flex items-center gap-2"
                >
                  Details <Info size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredMedia.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={32} className="text-black/20" />
          </div>
          <h3 className="text-xl font-bold">No results found</h3>
          <p className="text-black/40">Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  );
}
