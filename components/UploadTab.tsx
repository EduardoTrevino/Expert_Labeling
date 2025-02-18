"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function UploadTab() {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="mt-6">
      <Card className="p-8 bg-white shadow-md">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center ${
            dragActive ? "border-navy-500 bg-navy-50" : "border-navy-200"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-navy-400" />
          <h3 className="text-xl font-semibold mb-2 text-navy-900">Upload Image</h3>
          <p className="text-navy-600 mb-4">
            Drag and drop your image here, or click to select
          </p>
          <Button variant="outline" className="bg-white text-navy-900 border-navy-200 hover:bg-navy-50">
            Select Image
          </Button>
          <input
            type="file"
            className="hidden"
            accept="image/*"
          />
        </div>
      </Card>
    </div>
  );
}