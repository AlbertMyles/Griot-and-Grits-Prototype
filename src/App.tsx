import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Library, MessageSquare, Share2, Upload, Menu, X, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signIn, signOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Dashboard from './components/Dashboard';
import Collection from './components/Collection';
import GriotChat from './components/GriotChat';
import ConceptMap from './components/ConceptMap';
import MediaUpload from './components/MediaUpload';
import MediaDetails from './components/MediaDetails';
import EntityList from './components/EntityList';
import { Media } from './types';

type Page = 'dashboard' | 'collection' | 'chat' | 'map' | 'upload' | 'details' | 'entities' | 'places' | 'events';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          await setDoc(userRef, {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: 'user'
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectMedia = (media: Media) => {
    setSelectedMedia(media);
    setActivePage('details');
  };

  const handleStatClick = (type: 'media' | 'entities' | 'places' | 'events') => {
    if (type === 'media') {
      setActivePage('collection');
    } else {
      setActivePage(type as Page);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'collection', label: 'Collection', icon: Library },
    { id: 'chat', label: 'The Griot Chat', icon: MessageSquare },
    { id: 'map', label: 'Concept Map', icon: Share2 },
    { id: 'upload', label: 'Upload Media', icon: Upload },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-serif italic text-xl">Consulting the archive...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-xl border border-black/5 text-center space-y-8"
        >
          <div className="w-20 h-20 bg-[#1A1A1A] text-[#F27D26] rounded-3xl flex items-center justify-center mx-auto">
            <Library size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-serif italic font-bold">Griot & Grits</h1>
            <p className="text-black/60">An oral history platform for preserving cultural narratives.</p>
          </div>
          <button 
            onClick={signIn}
            className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
          <p className="text-xs text-black/30 uppercase tracking-widest font-mono">
            Secure Cultural Preservation
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans flex">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#1A1A1A] text-[#F5F2ED] transition-all duration-300 flex flex-col fixed h-full z-50`}
      >
        <div className="p-6 flex items-center justify-between border-bottom border-white/10">
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-serif italic font-bold tracking-tight"
            >
              Griot & Grits
            </motion.h1>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id as Page)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                activePage === item.id || (activePage === 'entities' && item.id === 'dashboard') || (activePage === 'places' && item.id === 'dashboard') || (activePage === 'events' && item.id === 'dashboard')
                  ? 'bg-[#F27D26] text-white' 
                  : 'hover:bg-white/5 text-white/70'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-rose-500/10 text-rose-400 transition-all"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
          {isSidebarOpen && (
            <div className="text-xs text-white/40 uppercase tracking-widest font-mono">
              Cultural Preservation v1.0
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'} p-8`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activePage === 'dashboard' && (
              <Dashboard 
                onSelectMedia={handleSelectMedia} 
                onViewAll={() => setActivePage('collection')} 
                onStatClick={handleStatClick}
              />
            )}
            {activePage === 'collection' && <Collection onSelectMedia={handleSelectMedia} />}
            {activePage === 'chat' && <GriotChat />}
            {activePage === 'map' && <ConceptMap />}
            {activePage === 'upload' && <MediaUpload onComplete={() => setActivePage('collection')} />}
            {activePage === 'details' && selectedMedia && (
              <MediaDetails 
                media={selectedMedia} 
                onBack={() => setActivePage('collection')} 
              />
            )}
            {(activePage === 'entities' || activePage === 'places' || activePage === 'events') && (
              <EntityList 
                type={activePage as any} 
                onBack={() => setActivePage('dashboard')} 
                onSelectMedia={handleSelectMedia}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
