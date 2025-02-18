"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function DownloadTab() {
  const handleDownload = () => {
    // Implementation for downloading schema
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