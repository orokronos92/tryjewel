import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Gallery item metadata interface
 */
export interface ItemMetadata {
  [key: string]: unknown;
}

/**
 * Zustand store for gallery management
 */

export interface GalleryItem {
  id: string;
  screenshot_data: string; // base64
  jewelry_type: string;
  finger?: string;
  hand?: string;
  timestamp: number;
  metadata?: Record<string, ItemMetadata>;
}

interface GalleryState {
  items: GalleryItem[];
  isLoading: boolean;
  error: string | null;
}

interface GalleryStoreState {
  gallery: GalleryState;

  // Actions
  loadItems: () => Promise<void>;
  saveItem: (item: GalleryItem) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearGallery: () => Promise<void>;
  updateItem: (itemId: string, updates: Partial<GalleryItem>) => Promise<void>;
  searchItems: (query: string) => GalleryItem[];
  filterItems: (filters: {
    jewelry_type?: string;
    date_from?: number;
    date_to?: number;
  }) => GalleryItem[];

  // Utils
  exportAsZip: () => Promise<Blob>;
  exportAsJson: () => string;
  getStats: () => {
    total: number;
    byType: Record<string, number>;
    totalSize: number;
    dateRange: { min: number; max: number };
  };
}

// Type filter function
const applyFilters = (
  items: GalleryItem[],
  filters: {
    jewelry_type?: string;
    date_from?: number;
    date_to?: number;
  }
): GalleryItem[] => {
  return items.filter(item => {
    if (filters.jewelry_type && item.jewelry_type !== filters.jewelry_type) {
      return false;
    }
    if (filters.date_from && item.timestamp < filters.date_from) {
      return false;
    }
    if (filters.date_to && item.timestamp > filters.date_to) {
      return false;
    }
    return true;
  });
};

// Stats calculation
const calculateStats = (
  items: GalleryItem[]
) => {
  const total = items.length;
  const byType: Record<string, number> = {};
  let totalSize = 0;
  const timestamps: number[] = [];

  items.forEach(item => {
    byType[item.jewelry_type] = (byType[item.jewelry_type] || 0) + 1;
    totalSize += Math.ceil((item.screenshot_data.length * 3) / 4);
    timestamps.push(item.timestamp);
  });

  const dateRange = timestamps.length > 0
    ? { min: Math.min(...timestamps), max: Math.max(...timestamps) }
    : { min: 0, max: 0 };

  return { total, byType, totalSize, dateRange };
};

const defaultGalleryState: GalleryState = {
  items: [],
  isLoading: false,
  error: null,
};

export const useGalleryStore = create<GalleryStoreState>()(
  persist(
    (set, get) => ({
      gallery: { ...defaultGalleryState },

      // Load items from IndexedDB
      loadItems: async () => {
        set((state) => ({ gallery: { ...state.gallery, isLoading: true, error: null } }));

        try {
          // In a real app, use IndexedDB
          const stored = localStorage.getItem('gallery_items');
          const items = stored ? JSON.parse(stored) : [];

          set((state) => ({
            gallery: {
              ...state.gallery,
              items,
              isLoading: false,
            },
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load items';
          set((state) => ({
            gallery: {
              ...state.gallery,
              error: errorMessage,
              isLoading: false,
            },
          }));
        }
      },

      // Save item to gallery
      saveItem: async (item: GalleryItem) => {
        try {
          const { items } = get().gallery;
          const newItems = [...items, item];

          // Save to localStorage (in real app: IndexedDB)
          localStorage.setItem('gallery_items', JSON.stringify(newItems));

          set((state) => ({
            gallery: {
              ...state.gallery,
              items: newItems,
            },
          }));
        } catch (error) {
          throw error;
        }
      },

      // Remove item from gallery
      removeItem: async (itemId: string) => {
        try {
          const { items } = get().gallery;
          const newItems = items.filter((item) => item.id !== itemId);

          localStorage.setItem('gallery_items', JSON.stringify(newItems));

          set((state) => ({
            gallery: {
              ...state.gallery,
              items: newItems,
            },
          }));
        } catch (error) {
          throw error;
        }
      },

      // Clear entire gallery
      clearGallery: async () => {
        try {
          localStorage.removeItem('gallery_items');

          set((state) => ({
            gallery: {
              ...state.gallery,
              items: [],
            },
          }));
        } catch (error) {
          throw error;
        }
      },

      // Update item
      updateItem: async (itemId: string, updates: Partial<GalleryItem>) => {
        try {
          const { items } = get().gallery;
          const newItems = items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          );

          localStorage.setItem('gallery_items', JSON.stringify(newItems));

          set((state) => ({
            gallery: {
              ...state.gallery,
              items: newItems,
            },
          }));
        } catch (error) {
          throw error;
        }
      },

      // Search items
      searchItems: (query: string) => {
        const { items } = get().gallery;
        if (!query.trim()) return items;

        const lowerQuery = query.toLowerCase();
        return items.filter(
          (item) =>
            item.jewelry_type.toLowerCase().includes(lowerQuery) ||
            (item.finger && item.finger.toLowerCase().includes(lowerQuery)) ||
            (item.hand && item.hand.toLowerCase().includes(lowerQuery))
        );
      },

      // Filter items
      filterItems: (filters) => {
        const { items } = get().gallery;
        let filtered = [...items];

        if (filters.jewelry_type) {
          filtered = filtered.filter((item) => item.jewelry_type === filters.jewelry_type);
        }

        if (filters.date_from) {
          filtered = filtered.filter((item) => item.timestamp >= (filters.date_from ?? 0));
        }

        if (filters.date_to) {
          filtered = filtered.filter((item) => item.timestamp <= (filters.date_to ?? Date.now()));
        }

        return filtered;
      },

      // Export as ZIP (mock implementation)
      exportAsZip: async () => {
        // In real app: Use JSZip library
        const { items } = get().gallery;

        const zip = new (window as any).JSZip();
        const folder = zip.folder("bijoux_gallery");

        items.forEach((item) => {
          const blob = new Blob([atob(item.screenshot_data)], {
            type: "image/jpeg",
          });
          folder.file(`${item.jewelry_type}_${item.id}.jpg`, blob);
        });

        const content = await zip.generateAsync({ type: "blob" });
        return content;
      },

      // Export as JSON
      exportAsJson: () => {
        const { items } = get().gallery;
        return JSON.stringify(items, null, 2);
      },

      // Get gallery statistics
      getStats: () => {
        const { items } = get().gallery;

        const byType = items.reduce((acc, item) => {
          acc[item.jewelry_type] = (acc[item.jewelry_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const totalSize = items.reduce((acc, item) => {
          return acc + Math.ceil((item.screenshot_data.length * 3) / 4);
        }, 0);

        const timestamps = items.map((item) => item.timestamp).sort();

        return {
          total: items.length,
          byType,
          totalSize,
          dateRange: {
            min: timestamps[0] || 0,
            max: timestamps[timestamps.length - 1] || 0,
          },
        };
      },
    }),
    {
      name: 'gallery-store',
      partialize: (state) => ({
        gallery: state.gallery,
      }),
    }
  )
);

// Selectors
export const useGalleryItems = () => useGalleryStore((state) => state.gallery.items);
export const useGalleryLoading = () => useGalleryStore((state) => state.gallery.isLoading);
export const useGalleryError = () => useGalleryStore((state) => state.gallery.error);