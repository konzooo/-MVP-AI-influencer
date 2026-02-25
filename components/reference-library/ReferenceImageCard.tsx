"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, MapPin, Camera, Clock, Palette, Smile, Edit2, Save, X, Loader2 } from "lucide-react";
import type { ReferenceImage, ReferenceImageMetadata } from "@/lib/types";

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editData, setEditData] = useState({
    summary: image.summary,
    tags: image.tags,
    indoor_outdoor: image.metadata.indoor_outdoor,
    place_type: image.metadata.place.type,
    place_detail: image.metadata.place.detail,
    capture_method: image.metadata.capture_method,
    framing: image.metadata.framing,
    expression_type: image.metadata.expression.type,
    expression_mouth: image.metadata.expression.mouth,
    expression_detail: image.metadata.expression.detail,
    time_of_day: image.metadata.time_of_day,
    image_style_color: image.metadata.image_style.color,
    image_style_detail: image.metadata.image_style.detail,
  });

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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/reference-images/${image.filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editData.summary,
          tags: editData.tags,
          metadata: {
            schema_version: image.metadata.schema_version,
            indoor_outdoor: editData.indoor_outdoor as any,
            place: { type: editData.place_type, detail: editData.place_detail },
            capture_method: editData.capture_method as any,
            framing: editData.framing as any,
            expression: {
              type: editData.expression_type as any,
              mouth: editData.expression_mouth as any,
              detail: editData.expression_detail,
            },
            time_of_day: editData.time_of_day as any,
            image_style: { color: editData.image_style_color as any, detail: editData.image_style_detail },
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      toast.success('Image details saved successfully');
      setIsEditMode(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      summary: image.summary,
      tags: image.tags,
      indoor_outdoor: image.metadata.indoor_outdoor,
      place_type: image.metadata.place.type,
      place_detail: image.metadata.place.detail,
      capture_method: image.metadata.capture_method,
      framing: image.metadata.framing,
      expression_type: image.metadata.expression.type,
      expression_mouth: image.metadata.expression.mouth,
      expression_detail: image.metadata.expression.detail,
      time_of_day: image.metadata.time_of_day,
      image_style_color: image.metadata.image_style.color,
      image_style_detail: image.metadata.image_style.detail,
    });
    setIsEditMode(false);
  };

  const imageElement = (
    <div className="relative aspect-square overflow-hidden rounded-t-lg cursor-pointer bg-zinc-900">
      {!imageError ? (
        <Image
          src={image.thumbnailPath}
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
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Card className={`group will-change-auto ${
        selected ? 'ring-2 ring-violet-500' : 'hover:ring-2 hover:ring-violet-500/50'
      }`}>
        <CardContent className="p-0">
          {selectable ? <div onClick={handleSelect}>{imageElement}</div> : <DialogTrigger asChild>{imageElement}</DialogTrigger>}
          
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

      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {image.filename}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Image Preview */}
          <div className="relative w-full max-h-[60vh] overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center">
            {!imageError ? (
              <Image
                src={image.imagePath}
                alt={image.summary}
                width={1200}
                height={800}
                className="object-contain max-h-[60vh] w-auto"
                onError={() => setImageError(true)}
                priority
                sizes="100vw"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-zinc-400">
                <Camera className="h-16 w-16" />
              </div>
            )}
          </div>

          {/* Details */}
          <ScrollArea className="max-h-[30vh]">
            <div className="space-y-4">
              {/* Edit Mode Controls */}
              {!isEditMode && (
                <Button
                  onClick={() => setIsEditMode(true)}
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Details
                </Button>
              )}

              {isEditMode && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    className="flex-1 gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    disabled={isSaving}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Summary */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-zinc-100">Description</h4>
                  {!isEditMode && (
                    <Button
                      onClick={handleCopyDescription}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditMode ? (
                  <Textarea
                    value={editData.summary}
                    onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
                    className="min-h-24"
                  />
                ) : (
                  <p className="text-sm text-zinc-300">{image.summary}</p>
                )}
              </div>
              
              {/* Metadata */}
              {!isEditMode ? (
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
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500">Indoor/Outdoor</label>
                    <Select value={editData.indoor_outdoor} onValueChange={(v) => setEditData({ ...editData, indoor_outdoor: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indoor">Indoor</SelectItem>
                        <SelectItem value="outdoor">Outdoor</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Place Type</label>
                    <Input
                      value={editData.place_type}
                      onChange={(e) => setEditData({ ...editData, place_type: e.target.value })}
                      className="mt-1"
                      placeholder="e.g., bedroom, studio"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Capture Method</label>
                    <Select value={editData.capture_method} onValueChange={(v) => setEditData({ ...editData, capture_method: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mirror_selfie">Mirror Selfie</SelectItem>
                        <SelectItem value="front_selfie">Front Selfie</SelectItem>
                        <SelectItem value="non_selfie">Non-Selfie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Framing</label>
                    <Select value={editData.framing} onValueChange={(v) => setEditData({ ...editData, framing: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="closeup">Closeup</SelectItem>
                        <SelectItem value="chest_up">Chest Up</SelectItem>
                        <SelectItem value="waist_up">Waist Up</SelectItem>
                        <SelectItem value="full_body">Full Body</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Expression</label>
                    <Select value={editData.expression_type} onValueChange={(v) => setEditData({ ...editData, expression_type: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smile">Smile</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="laugh">Laugh</SelectItem>
                        <SelectItem value="serious">Serious</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Mouth</label>
                    <Select value={editData.expression_mouth} onValueChange={(v) => setEditData({ ...editData, expression_mouth: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Time of Day</label>
                    <Select value={editData.time_of_day} onValueChange={(v) => setEditData({ ...editData, time_of_day: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                        <SelectItem value="golden_hour">Golden Hour</SelectItem>
                        <SelectItem value="blue_hour">Blue Hour</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500">Image Style Color</label>
                    <Select value={editData.image_style_color} onValueChange={(v) => setEditData({ ...editData, image_style_color: v as any })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="color">Color</SelectItem>
                        <SelectItem value="bw">B&W</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              {/* Place Details */}
              {(editData.place_detail || isEditMode) && (
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Place Details</h4>
                  {isEditMode ? (
                    <Textarea
                      value={editData.place_detail}
                      onChange={(e) => setEditData({ ...editData, place_detail: e.target.value })}
                      className="min-h-20"
                      placeholder="Add place details..."
                    />
                  ) : (
                    <p className="text-sm text-zinc-300">{editData.place_detail}</p>
                  )}
                </div>
              )}

              {/* Expression Details */}
              {(editData.expression_detail || isEditMode) && (
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Expression Details</h4>
                  {isEditMode ? (
                    <Textarea
                      value={editData.expression_detail}
                      onChange={(e) => setEditData({ ...editData, expression_detail: e.target.value })}
                      className="min-h-20"
                      placeholder="Add expression details..."
                    />
                  ) : (
                    <p className="text-sm text-zinc-300">{editData.expression_detail}</p>
                  )}
                </div>
              )}

              {/* Style Details */}
              {(editData.image_style_detail || isEditMode) && (
                <div>
                  <h4 className="font-medium text-zinc-100 mb-2">Style Details</h4>
                  {isEditMode ? (
                    <Textarea
                      value={editData.image_style_detail}
                      onChange={(e) => setEditData({ ...editData, image_style_detail: e.target.value })}
                      className="min-h-20"
                      placeholder="Add style details..."
                    />
                  ) : (
                    <p className="text-sm text-zinc-300">{editData.image_style_detail}</p>
                  )}
                </div>
              )}
              
              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-zinc-100">Tags ({editData.tags.length})</h4>
                  {!isEditMode && (
                    <Button
                      onClick={handleCopyTags}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditMode ? (
                  <Input
                    value={editData.tags.join(", ")}
                    onChange={(e) => setEditData({
                      ...editData,
                      tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean)
                    })}
                    placeholder="Enter tags separated by commas"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {editData.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
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