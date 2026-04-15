import { useState, useEffect, useCallback } from 'react';
import { getFarms } from '../services/farmService.js';
import toast from 'react-hot-toast';

export default function useFarms() {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFarms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFarms();
      const list = Array.isArray(data) ? data : data.farms || [];
      setFarms(list);
      if (list.length > 0 && !selectedFarm) {
        setSelectedFarm(list[0]);
      }
    } catch (err) {
      toast.error('Failed to load farms');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchFarms();
  }, [fetchFarms]);

  return {
    farms,
    selectedFarm,
    setSelectedFarm,
    loading,
    refresh: fetchFarms,
  };
}
