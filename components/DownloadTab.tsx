"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function DownloadTab() {
  const [hasAnnotatedImages, setHasAnnotatedImages] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAnnotatedImages();
  }, []);

  const checkAnnotatedImages = async () => {
    const { data } = await supabase
      .from('images')
      .select('id')
      .eq('completed', true)
      .limit(1);

    setHasAnnotatedImages(!!data?.length);
  };

  const handleDownload = async () => {
    if (!hasAnnotatedImages) {
      toast({
        title: "No annotated images",
        description: "There are no annotated images available for download",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: images } = await supabase
        .from('images')
        .select(`
          id,
          url,
          uploaded_by,
          created_at,
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

      if (!images?.length) {
        throw new Error('No images found');
      }

      const blob = new Blob([JSON.stringify(images, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'annotations.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Schema downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download schema",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-6">
      <Card className="p-8 bg-white shadow-md">
        <div className="text-center">
          <Download className="w-12 h-12 mx-auto mb-4 text-navy-400" />
          <h3 className="text-xl font-semibold mb-4 text-navy-900">Download Schema</h3>
          <p className="mb-6 text-navy-600">
            Download the annotation schema including image data and annotation coordinates
          </p>
          <Button
            onClick={handleDownload}
            className="bg-navy-600 hover:bg-navy-700 text-white"
          >
            Download Schema
          </Button>
        </div>
      </Card>
    </div>
  );
}
