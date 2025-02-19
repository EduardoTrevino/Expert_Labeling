"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";

interface AnnotationData {
  id: string;
  x_coordinate: number;
  y_coordinate: number;
  annotation_type: string[];
  other_text?: string;
  created_by: string;
  created_at: string;
}

interface ImageData {
  id: string;
  url: string;
  uploaded_by: string;
  created_at: string;
  completed: boolean;
  annotations: AnnotationData[];
}

export default function CompleteTab() {
  const [completedImages, setCompletedImages] = useState<ImageData[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  // Fetch completed images along with their annotations
  useEffect(() => {
    const fetchCompletedImages = async () => {
      const { data, error } = await supabase
        .from('images')
        .select(`
          id,
          url,
          uploaded_by,
          created_at,
          completed,
          annotations: annotations (
            id,
            x_coordinate,
            y_coordinate,
            annotation_type,
            other_text,
            created_by,
            created_at
          )
        `)
        .eq('completed', true)
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Error fetching completed images:", error);
      } else {
        setCompletedImages(data || []);
        if (data && data.length > 0 && !selectedImage) {
          setSelectedImage(data[0]);
        }
      }
    };

    fetchCompletedImages();
  }, [selectedImage]);

  return (
    <div className="flex gap-4 mt-6">
      {/* Sidebar */}
      <div className="w-64 flex flex-col">
        <div className="mb-4 font-semibold text-navy-900">
          {completedImages.length} completed images
        </div>
        <ScrollArea className="h-[600px]">
          <div className="flex flex-col space-y-2">
            {completedImages.map(img => (
              <div
                key={img.id}
                className={`flex items-center p-2 rounded hover:bg-navy-50 cursor-pointer ${selectedImage?.id === img.id ? "bg-navy-100" : ""}`}
                onClick={() => setSelectedImage(img)}
              >
                <img src={img.url} alt="Thumbnail" className="w-16 h-16 object-cover rounded" />
                <div className="ml-2 text-sm text-navy-700">
                  {img.uploaded_by}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main display */}
      <div className="flex-1">
        {selectedImage ? (
          <Card className="p-4 bg-white shadow-md relative">
            <div className="w-full h-[600px] relative">
              <img
                src={selectedImage.url}
                alt="Completed"
                className="w-full h-full object-contain"
              />
              {selectedImage.annotations.map(ann => (
                <div
                  key={ann.id}
                  className="absolute w-4 h-4 bg-navy-500 rounded-full -translate-x-2 -translate-y-2"
                  style={{ left: `${ann.x_coordinate}%`, top: `${ann.y_coordinate}%` }}
                />
              ))}
            </div>
          </Card>
        ) : (
          <div className="p-8 text-center text-navy-600">
            Select a completed image from the sidebar.
          </div>
        )}
      </div>
    </div>
  );
}
