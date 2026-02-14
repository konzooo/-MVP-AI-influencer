"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Copy, MapPin, Camera, Clock, Palette, Smile } from "lucide-react";
import type { ReferenceImage } from "@/lib/types";

interface ReferenceImageCardProps {
  image: ReferenceImage;
  onSelect?: (image: ReferenceImage) => void;
  selectable?: boolean;
  selected?: boolean;
}

export function ReferenceImageCard({ 
  image, 
  onSelect, 
  selectable = false, 
  selected = false 
}: ReferenceImageCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCopyTags = () => {
    navigator.clipboard.writeText(image.tags.join(", "));
  };

  const handleCopyDescription = () => {
    navigator.clipboard.writeText(image.summary);
  };

  const handleSelect = () => {
    if (onSelect && selectable) {
      onSelect(image);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Card className={`group will-change-auto ${
        selected ? 'ring-2 ring-violet-500' : 'hover:ring-2 hover:ring-violet-500/50'
      }`}>
        <CardContent className="p-0">
          <DialogTrigger asChild>
            <div className="relative aspect-square overflow-hidden rounded-t-lg cursor-pointer bg-zinc-900">
              {!imageError ? (
                <Image
                  src={image.imagePath}
                  alt={image.summary}
                  fill
                  className="object-cover"
                  onError={() => setImageError(true)}
                  loading="lazy"
                  sizes="200px"
                  quality={75}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-400">
                  <Camera className="h-12 w-12" />
                </div>
              )}
            </div>
          </DialogTrigger>
          
          <div className="p-3">
            <h3 className="font-medium text-sm text-zinc-100 mb-1 line-clamp-1">
              {image.filename}
            </h3>
            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
              {image.summary}
            </p>
            
            <div className="flex flex-wrap gap-1 mb-2">
              {image.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {image.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{image.tags.length - 3}
                </Badge>
              )}
            </div>
            
            {selectable && (
              <Button
                onClick={handleSelect}
                variant={selected ? "default" : "outline"}
                size="sm"
                className="w-full"
              >
                {selected ? "Selected" : "Select"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {image.filename}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-900">
            {!imageError ? (
              <Image
                src={image.imagePath}
                alt={image.summary}
                fill
                className="object-contain"
                onError={() => setImageError(true)}
                priority
                sizes="(max-width: 1200px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                <Camera className="h-16 w-16" />
              </div>
            )}
          </div>
          
          {/* Details */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {/* Summary */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-zinc-100">Description</h4>
                  <Button
                    onClick={handleCopyDescription}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-zinc-300">{image.summary}</p>
              </div>
              
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-violet-400" />
                  <div>
                    <p className="text-xs text-zinc-500">Location</p>
                    <p className="text-sm text-zinc-300">
                      {image.metadata.indoor_outdoor} • {image.metadata.place.type}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-violet-400" />
                  <div>
                    <p className="text-xs text-zinc-500">Capture</p>
                    <p className="text-sm text-zinc-300">
                      {image.metadata.capture_method} • {image.metadata.framing}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4 text-violet-400" />
                  <div>
                    <p className="text-xs text-zinc-500">Expression</p>
                    <p className="text-sm text-zinc-300">
                      {image.metadata.expression.type} • {image.metadata.expression.mouth}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-violet-400" />
                  <div>
                    <p className="text-xs text-zinc-500">Time</p>
                    <p className="text-sm text-zinc-300">{image.metadata.time_of_day}</p>
                  </div>
                </div>
              </div>
              
              {/* Place Details */}
              {image.metadata.place.detail && (
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Place Details</h4>
                  <p className="text-sm text-zinc-300">{image.metadata.place.detail}</p>
                </div>
              )}
              
              {/* Expression Details */}
              {image.metadata.expression.detail && (
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Expression Details</h4>
                  <p className="text-sm text-zinc-300">{image.metadata.expression.detail}</p>
                </div>
              )}
              
              {/* Style Details */}
              {image.metadata.image_style.detail && (
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Style Details</h4>
                  <p className="text-sm text-zinc-300">{image.metadata.image_style.detail}</p>
                </div>
              )}
              
              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-zinc-100">Tags ({image.tags.length})</h4>
                  <Button
                    onClick={handleCopyTags}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {image.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {selectable && (
                <Button
                  onClick={() => {
                    handleSelect();
                    setIsDialogOpen(false);
                  }}
                  variant={selected ? "default" : "outline"}
                  className="w-full"
                >
                  {selected ? "Selected" : "Select Image"}
                </Button>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}