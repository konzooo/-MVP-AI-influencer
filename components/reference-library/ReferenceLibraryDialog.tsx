"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ReferenceLibraryBrowser } from "./ReferenceLibraryBrowser";
import type { ReferenceImage } from "@/lib/types";

interface ReferenceLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImagesSelected: (images: ReferenceImage[]) => void;
}

export function ReferenceLibraryDialog({
  open,
  onOpenChange,
  onImagesSelected,
}: ReferenceLibraryDialogProps) {
  const handleImagesSelected = (images: ReferenceImage[]) => {
    onImagesSelected(images);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] h-[88vh] max-w-none sm:max-w-none p-0 gap-0 flex flex-col overflow-hidden border-zinc-800">
        <VisuallyHidden>
          <DialogTitle>Choose Reference Images</DialogTitle>
        </VisuallyHidden>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ReferenceLibraryBrowser
            selectionMode={true}
            onImagesSelected={handleImagesSelected}
            showHeader={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
