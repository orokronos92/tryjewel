import { useState, useEffect } from 'react';
import { useJewelryStore } from '@/stores/jewelry-store';

export interface UseJewelryModelsReturn {
  availableModels: any[];
  isLoading: boolean;
  error: string | null;
  loadModel: (modelId: string) => Promise<any>;
  preloadModels: (modelIds: string[]) => Promise<void>;
}

export function useJewelryModels(): UseJewelryModelsReturn {
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedModel, setSelectedModel } = useJewelryStore();

  useEffect(() => {
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Failed to load models');
      const models = await response.json();
      setAvailableModels(models);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setIsLoading(false);
    }
  };

  const loadModel = async (modelId: string) => {
    setIsLoading(true);
    try {
      const model = availableModels.find(m => m.id === modelId);
      if (!model) throw new Error(`Model ${modelId} not found`);

      // TODO: Implémenter GLTFLoader ici
      setSelectedModel(model);
      return model;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const preloadModels = async (modelIds: string[]) => {
    for (const modelId of modelIds) {
      await loadModel(modelId);
    }
  };

  return {
    availableModels,
    isLoading,
    error,
    loadModel,
    preloadModels,
  };
}
