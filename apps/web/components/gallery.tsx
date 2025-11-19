"use client";

import { useState, useEffect } from "react";
import { useGalleryStore } from "@/stores/gallery-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Trash2,
  Image as ImageIcon,
  Grid3X3,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * Gallery component - Manage and display captured screenshots
 */

interface GalleryItem {
  id: string;
  screenshot_data: string;
  jewelry_type: string;
  finger?: string;
  hand?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface GalleryProps {
  className?: string;
  onSelectItem?: (item: GalleryItem) => void;
  enableDownloads?: boolean;
}

export function Gallery({
  className = "",
  onSelectItem,
  enableDownloads = true,
}: GalleryProps) {
  const {
    gallery: { items, isLoading },
    loadItems,
    removeItem,
    clearGallery,
  } = useGalleryStore();

  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();

  // Load items on mount
  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save extracted from IndexedDB (mock implementation)
  useEffect(() => {
    const interval = setInterval(() => {
      if (items.length > 0) {
        // In real app, sync with IndexedDB
        // console.log("[Gallery] Syncing with IndexedDB", items.length, "items");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [items]);

  const handleSelectItem = (item: GalleryItem) => {
    setSelectedItem(item);
    onSelectItem?.(item);
    setIsDialogOpen(true);
  };

  const handleDownload = async (item: GalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(`data:image/jpeg;base64,${item.screenshot_data}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `bijoux_${item.jewelry_type}_${new Date(item.timestamp).toISOString().slice(0, 10)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: "Image saved successfully",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not save image",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await removeItem(itemId);
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
        setIsDialogOpen(false);
      }

      toast({
        title: "Deleted",
        description: "Image removed from gallery",
      });
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not remove image",
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    if (items.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${items.length} images?`
    );

    if (confirmed) {
      try {
        await clearGallery();
        setSelectedItem(null);
        setIsDialogOpen(false);

        toast({
          title: "Gallery cleared",
          description: "All images have been removed",
        });
      } catch {
        toast({
          title: "Clear failed",
          description: "Could not clear gallery",
          variant: "destructive",
        });
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (base64String: string): string => {
    const sizeInBytes = Math.ceil((base64String.length * 3) / 4);
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <GallerySkeleton />;
  }

  if (items.length === 0) {
    return <GalleryEmpty onRefresh={() => loadItems()} />;
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5" />
            Gallery
            <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            >
              {viewMode === "grid" ? "List" : "Grid"} View
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
              disabled={items.length === 0}
            >
              Clear All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[600px] w-full rounded-md border">
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4"
                : "space-y-3 p-4"
            }
          >
            {items.map((item) => (
              <GalleryItemCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                onSelect={() => handleSelectItem(item)}
                onDownload={(e) => handleDownload(item, e)}
                onDelete={(e) => handleDelete(item.id, e)}
                enableDownloads={enableDownloads}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Item Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <button className="hidden">Open</button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            {selectedItem ? (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={`data:image/jpeg;base64,${selectedItem.screenshot_data}`}
                    alt={`${selectedItem.jewelry_type} screenshot`}
                    className="w-full h-auto rounded-lg"
                  />
                  <Badge className="absolute top-2 left-2">
                    {selectedItem.jewelry_type}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Date:</strong> {formatDate(selectedItem.timestamp)}
                  </div>
                  <div>
                    <strong>Type:</strong> {selectedItem.jewelry_type}
                  </div>
                  {selectedItem.finger && (
                    <div>
                      <strong>Finger:</strong> {selectedItem.finger}
                    </div>
                  )}
                  {selectedItem.hand && (
                    <div>
                      <strong>Hand:</strong> {selectedItem.hand}
                    </div>
                  )}
                  <div>
                    <strong>Size:</strong> {formatFileSize(selectedItem.screenshot_data)}
                  </div>
                </div>

                <div className="flex gap-2">
                  {enableDownloads && (
                    <Button
                      onClick={(e) => handleDownload(selectedItem, e)}
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  )}
                  <Button
                    onClick={(e) => handleDelete(selectedItem.id, e)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <GallerySkeleton />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// Gallery item card component
interface GalleryItemCardProps {
  item: GalleryItem;
  viewMode: "grid" | "list";
  onSelect: () => void;
  onDownload: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>) => void;
  enableDownloads: boolean;
}

function GalleryItemCard({
  item,
  viewMode,
  onSelect,
  onDownload,
  onDelete,
  enableDownloads,
}: GalleryItemCardProps) {
  if (viewMode === "list") {
    return (
      <div
        className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
        onClick={onSelect}
      >
        <img
          src={`data:image/jpeg;base64,${item.screenshot_data}`}
          alt={item.jewelry_type}
          className="w-16 h-16 object-cover rounded"
        />

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge>{item.jewelry_type}</Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(item.timestamp).toLocaleDateString()}
            </span>
          </div>

          <div className="text-sm text-muted-foreground">
            {item.finger && <span>Finger: {item.finger} </span>}
            {item.hand && <span>Hand: {item.hand}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {enableDownloads && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative cursor-pointer transition-transform hover:scale-105"
      onClick={onSelect}
    >
      <img
        src={`data:image/jpeg;base64,${item.screenshot_data}`}
        alt={item.jewelry_type}
        className="w-full h-32 object-cover rounded-lg"
      />

      <div className="absolute top-2 left-2">
        <Badge variant="secondary">{item.jewelry_type}</Badge>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-1">
          {enableDownloads && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 bg-black/50 hover:bg-black/70"
              onClick={onDownload}
              title="Download"
            >
              <Download className="h-3 w-3 text-white" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-red-500/50 hover:bg-red-500/70"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3 w-3 text-white" />
          </Button>
        </div>
      </div>

      <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-white bg-black/50 px-1 rounded">
          {new Date(item.timestamp).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// Gallery empty state
function GalleryEmpty({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Gallery is empty</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Start trying on jewelry to see your screenshots here
        </p>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

// Gallery skeleton loading
function GallerySkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { GalleryEmpty, GallerySkeleton, GalleryItemCard };
export default Gallery;