import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getFarms } from '../services/farmService.js';
import toast from 'react-hot-toast';

const FarmContext = createContext(null);

export function FarmProvider({ children }) {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshFarms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFarms();
      const list = Array.isArray(data) ? data : data.farms || [];
      setFarms(list);
      setSelectedFarm((prev) => {
        if (list.length === 0) return null;
        // 1. Keep current selection if still valid
        if (prev) {
          const still = list.find((f) => f.id === prev.id);
          if (still) return still;
        }
        // 2. Restore last-used farm from localStorage
        const savedId = localStorage.getItem('apris_selected_farm_id');
        if (savedId) {
          const saved = list.find((f) => String(f.id) === savedId);
          if (saved) return saved;
        }
        // 3. Fall back to first farm
        return list[0];
      });
    } catch {
      toast.error('Failed to load farms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFarms();
  }, [refreshFarms]);

  // Persist the selected farm so it survives a page reload
  useEffect(() => {
    if (selectedFarm) {
      localStorage.setItem('apris_selected_farm_id', String(selectedFarm.id));
    }
  }, [selectedFarm]);

  return (
    <FarmContext.Provider value={{ farms, selectedFarm, setSelectedFarm, loading, refreshFarms }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarmContext() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarmContext must be used within FarmProvider');
  return ctx;
}
