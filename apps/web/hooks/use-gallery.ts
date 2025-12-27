import { useEffect } from 'react';
import { useGalleryStore } from '@/stores/gallery-store';

export interface UseGalleryReturn {
  items: any[];
  isLoading: boolean;
  addItem: (item: any) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearGallery: () => Promise<void>;
}

export function useGallery(): UseGalleryReturn {
  const { gallery, loadItems, saveItem, removeItem, clearGallery } = useGalleryStore();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return {
    items: gallery.items,
    isLoading: gallery.isLoading,
    addItem: saveItem,
    removeItem,
    clearGallery,
  };
}
