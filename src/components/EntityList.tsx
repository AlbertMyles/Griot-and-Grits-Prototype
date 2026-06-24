import React, { useEffect, useState } from 'react';
import { Entity, Media } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Search, Users, MapPin, Calendar, Share2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

interface EntityListProps {
  type: 'entities' | 'places' | 'events';
  onBack: () => void;
  onSelectMedia: (media: Media) => void;
}

export default function EntityList({ type, onBack, onSelectMedia }: EntityListProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = query(collection(db, 'entities'));
    if (type === 'places') {
      q = query(collection(db, 'entities'), where('type', '==', 'Places'));
    } else if (type === 'events') {
      q = query(collection(db, 'entities'), where('type', '==', 'Events'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entityData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      // Group by name to avoid duplicates if they appear in multiple videos
      const uniqueEntities: Entity[] = [];
      const seenNames = new Set();
      
      entityData.forEach(e => {
        if (!seenNames.has(e.name)) {
          uniqueEntities.push(e);
          seenNames.add(e.name);
        }
      });

      setEntities(uniqueEntities);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [type]);

  const handleViewMedia = async (mediaId: string) => {
    const mediaDoc = await getDoc(doc(db, 'media', mediaId));
    if (mediaDoc.exists()) {
      onSelectMedia({ id: mediaDoc.id, ...mediaDoc.data() } as Media);
    }
  };

  const filteredEntities = entities.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTitle = () => {
    switch(type) {
      case 'places': return 'Geographic Points';
      case 'events': return 'Historical Milestones';
      default: return 'Identified Entities';
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'places': return <MapPin size={24} className="text-amber-500" />;
      case 'events': return <Calendar size={24} className="text-rose-500" />;
      default: return <Users size={24} className="text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-black/40 hover:text-[#F27D26] transition-colors"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-black/5 flex items-center justify-center">
            {getIcon()}
          </div>
          <div>
            <h2 className="text-4xl font-serif italic font-bold text-[#1A1A1A]">{getTitle()}</h2>
            <p className="text-black/60 mt-1">Cultural markers extracted from the oral history archive.</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={18} />
          <input 
            type="text" 
            placeholder="Search markers..." 
            className="pl-10 pr-4 py-2 bg-white border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F27D26]/20 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-white rounded-3xl animate-pulse border border-black/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntities.map((entity, i) => (
            <motion.div
              key={entity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black/5 text-black/40 rounded">
                  {entity.type}
                </span>
                <button 
                  onClick={() => handleViewMedia(entity.media_id)}
                  className="text-[#F27D26] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="View Source Narrative"
                >
                  <ExternalLink size={16} />
                </button>
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-[#F27D26] transition-colors">{entity.name}</h3>
              <p className="text-sm text-black/60 leading-relaxed line-clamp-3">
                {entity.description}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filteredEntities.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={32} className="text-black/20" />
          </div>
          <h3 className="text-xl font-bold">No markers found</h3>
          <p className="text-black/40">Try adjusting your search or explore the archive.</p>
        </div>
      )}
    </div>
  );
}
