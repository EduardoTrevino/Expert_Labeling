"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/lib/store";
import shp from "shpjs";

export default function UploadTab() {
  const { name } = useUserStore();
  const { toast } = useToast();

  const [tifFile, setTifFile] = useState<File | null>(null);
  const [zipFiles, setZipFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  function log(msg: string) {
    setLogs((prev) => [...prev, msg]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    let foundTif: File | null = null;
    const foundZips: File[] = [];

    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".tif") || lower.endsWith(".tiff")) {
        foundTif = f;
      } else if (lower.endsWith(".zip")) {
        foundZips.push(f);
      }
    }

    setTifFile(foundTif);
    setZipFiles(foundZips);
    setLogs([]);
  }

  async function handleUpload() {
    if (!tifFile) {
      toast({ title: "No TIF file selected", variant: "destructive" });
      return;
    }
    setUploading(true);
    setLogs([]);

    try {
      // 1) Upload .tif to Supabase
      log(`Uploading ${tifFile.name}...`);
      const fileName = `${Date.now()}.tif`;
      const { error: tifErr } = await supabase.storage
        .from("images")
        .upload(fileName, tifFile);
      if (tifErr) throw tifErr;

      const { data: tifUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);
      if (!tifUrlData?.publicUrl) {
        throw new Error("Could not get public URL for TIF");
      }

      // 2) Insert row in images
      const { data: inserted, error: insErr } = await supabase
        .from("images")
        .insert([
          {
            url: tifUrlData.publicUrl,
            uploaded_by: name,
            name: tifFile.name,
          },
        ])
        .select("*");
      if (insErr) throw insErr;
      if (!inserted || inserted.length === 0) {
        throw new Error("No data returned from images insert");
      }
      const newImageId = inserted[0].id;
      log(`Created image row with ID=${newImageId}`);

      // 3) For each .zip => parse => insert polygons
      if (zipFiles.length === 0) {
        log("No shapefile .zip => skipping parse.");
      } else {
        for (const zip of zipFiles) {
          log(`Parsing shapefile zip: ${zip.name}`);
          const zBuf = await zip.arrayBuffer();
          const geojson = await shp(zBuf);
          const fcs = Array.isArray(geojson) ? geojson : [geojson];
          for (const fc of fcs) {
            if (fc.type !== "FeatureCollection") continue;
            const rawLabel = zip.name.replace(".zip", "");
            log(`Found ${fc.features.length} features in ${zip.name}`);
            for (const feat of fc.features) {
              const { error: polyErr } = await supabase
                .from("component_polygons")
                .insert([
                  {
                    image_id: newImageId,
                    label: rawLabel,
                    geometry: feat.geometry,
                  },
                ]);
              if (polyErr) {
                log(`Error inserting polygon: ${polyErr.message}`);
              }
            }
          }
        }
      }

      log("All done! TIF + shapefile inserts complete.");
      toast({ title: "Success", description: "Upload done." });
    } catch (err: any) {
      console.error(err);
      log(`Error: ${err.message}`);
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-6">
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-xl font-semibold mb-4">Upload .tif + Shapefile .zip(s)</h2>
        <p className="text-sm text-gray-700">
          1) Select exactly one .tif<br/>
          2) (Optional) any number of .zip shapefile sets
        </p>
        <input
          type="file"
          multiple
          accept=".tif,.tiff,.zip"
          onChange={handleFileSelect}
          className="mt-4"
        />

        <Button onClick={handleUpload} disabled={!tifFile || uploading} className="mt-4">
          {uploading ? "Uploading..." : "Upload Files"}
        </Button>

        <div className="mt-4 bg-gray-50 p-3 rounded border text-sm h-32 overflow-auto">
          {logs.map((m, i) => (
            <div key={i}>• {m}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
