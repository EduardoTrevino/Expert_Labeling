"use client";

import { Card } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";

export default function CompleteTab() {
  const hasCompletedImages = false; // This will be controlled by Supabase data

  if (!hasCompletedImages) {
    return (
      <div className="grid grid-cols-[300px_1fr] gap-6 mt-6">
        <Card className="p-4 bg-white shadow-md text-navy-900">
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <ImageIcon className="w-12 h-12 text-navy-300 mb-4" />
            <p className="text-navy-600">No images have been completed</p>
          </div>
        </Card>

        <Card className="p-4 bg-white shadow-md">
          <div className="flex flex-col items-center justify-center h-[600px] text-center">
            <ImageIcon className="w-16 h-16 text-navy-300 mb-4" />
            <p className="text-navy-600">Click on an image to modify or view annotations</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[300px_1fr] gap-6 mt-6">
      <Card className="p-4 bg-white shadow-md text-navy-900">
        <div className="space-y-4">
          <div>
            <p className="font-semibold">Uploaded by:</p>
            <p>Eduardo</p>
          </div>
          <div>
            <p className="font-semibold">Annotated by:</p>
            <p>Eduardo</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white shadow-md">
        <div className="relative w-full h-[600px]">
          <img
            src="/preview-image.jpg"
            alt="Completed"
            className="w-full h-full object-contain"
          />
        </div>
      </Card>
    </div>
  );
}