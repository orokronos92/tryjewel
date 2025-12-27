"use client";

import React from "react";
import { Gallery } from "@/components/gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, Share2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * Gallery Page - Browse and manage captured screenshots
 */

export default function GalleryPage() {
  const { toast } = useToast();

  const handleShare = async (item: any) => {
    try {
      if (navigator.share) {
        const blob = await fetch(`data:image/jpeg;base64,${item.screenshot_data}`).then(r => r.blob());
        const file = new File([blob], `${item.jewelry_type}_${item.id}.jpg`, { type: "image/jpeg" });

        await navigator.share({
          title: `Bijoux AI - ${item.jewelry_type}`,
          text: `Check out this virtual try-on of a ${item.jewelry_type}!`,
          files: [file],
        });
      } else {
        toast({
          title: "Share not supported",
          description: "Web Share API is not available on this device",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Share failed:", error);
      toast({
        title: "Share failed",
        description: "Could not share the image",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
              <p className="text-muted-foreground">
                Browse and manage your captured screenshots
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Gallery Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Images</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">
                Captured screenshots
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">
                Local storage
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Capture</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">
                Days ago
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gallery Component */}
        <Gallery
          onSelectItem={(item) => {
            console.log("Selected item:", item);
          }}
          enableDownloads={true}
        />
      </div>
    </div>
  );
}

// Gallery item detail view component
function GalleryItemDetail({ item }: { item: any }) {
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      const response = await fetch(`data:image/jpeg;base64,${item.screenshot_data}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `bijoux_${item.jewelry_type}_${item.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: "Image saved successfully",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not save image",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    // Implementation would go here
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <img
          src={`data:image/jpeg;base64,${item.screenshot_data}`}
          alt={item.jewelry_type}
          className="w-full h-auto rounded-lg"
        />
        <Badge className="absolute top-2 left-2">
          {item.jewelry_type}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <strong>Type:</strong> {item.jewelry_type}
        </div>
        <div>
          <strong>Date:</strong> {new Date(item.timestamp).toLocaleString()}
        </div>
        {item.finger && (
          <div>
            <strong>Finger:</strong> {item.finger}
          </div>
        )}
        {item.hand && (
          <div>
            <strong>Hand:</strong> {item.hand}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// Export utilities
export { GalleryItemDetail };

// Type exports
export interface GalleryPageProps {
  enableShare?: boolean;
  enableDownload?: boolean;
  viewMode?: "grid" | "list";
}

// Mobile-optimized version
export function MobileGalleryPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-4">
        <Gallery
          className="max-w-full"
          enableDownloads={true}
        />
      </div>
    </div>
  );
}

// Performance-optimized version
export const GalleryPageMemo = React.memo(GalleryPage);