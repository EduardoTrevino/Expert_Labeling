"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/lib/store";
import shp from "shpjs";

/**
 * This component handles:
 *  1) Letting user pick a .tif file.
 *  2) Letting user pick multiple .zip files (each zip = one component shapefile set).
 *  3) On "Upload", we store the .tif, create an `images` record,
 *     parse each .zip, insert polygons into `component_polygons`.
 */
export default function UploadTab() {
  const { name } = useUserStore(); // or however you manage user name
  const { toast } = useToast();

  // One TIF file
  const [tifFile, setTifFile] = useState<File | null>(null);
  // Multiple ZIP shapefile archives
  const [zipFiles, setZipFiles] = useState<File[]>([]);

  // For user feedback
  const [uploading, setUploading] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);

  // Keep a simple log for the user
  const logStatus = (message: string) => {
    setStatusMessages((prev) => [...prev, message]);
  };

  /**
   * Called when user selects files. We only store the .tif in `tifFile`
   * and any .zip in `zipFiles`.
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const allSelected = Array.from(e.target.files);

    // We'll let the user pick multiple files in a single open-file dialog:
    //  - exactly 1 TIF
    //  - zero or more ZIP
    let foundTif: File | null = null;
    const foundZips: File[] = [];

    allSelected.forEach((f) => {
      const lowerName = f.name.toLowerCase();
      if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) {
        foundTif = f;
      } else if (lowerName.endsWith(".zip")) {
        foundZips.push(f);
      }
      // else ignore any non .tif/.zip
    });

    setTifFile(foundTif);
    setZipFiles(foundZips);
    setStatusMessages([]); // reset logs
  };

  /**
   * Uploads the .tif to Storage, inserts `images` row,
   * then parses each .zip with shpjs => inserts polygons => `component_polygons`.
   */
  const handleUpload = async () => {
    if (!tifFile) {
      toast({
        title: "No TIF file selected",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    setStatusMessages([]);

    try {
      // ----------------------
      // 1) Upload the .tif
      // ----------------------
      logStatus(`Uploading TIF: ${tifFile.name}`);
      const tifExt = tifFile.name.split(".").pop();
      const tifFileName = `${Date.now()}.${tifExt}`;

      const { error: tifError } = await supabase.storage
        .from("images") // your storage bucket name
        .upload(tifFileName, tifFile);

      if (tifError) throw tifError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(tifFileName);
      if (!urlData?.publicUrl) {
        throw new Error("Failed to get public URL for .tif");
      }

      // ----------------------
      // 2) Insert row in `images`
      // ----------------------
      logStatus(`Inserting row into images table...`);

      const { data: insertedImages, error: insertErr } = await supabase
        .from("images")
        .insert([
          {
            url: urlData.publicUrl,
            uploaded_by: name,
            name: tifFile.name,
          },
        ])
        .select("*");

      if (insertErr) throw insertErr;
      if (!insertedImages?.length) {
        throw new Error("No data returned after inserting image");
      }

      const newImageId = insertedImages[0].id;
      logStatus(`Created image record: ID = ${newImageId}`);

      // ----------------------
      // 3) For each .zip => parse => insert polygons
      // ----------------------
      if (!zipFiles.length) {
        logStatus("No .zip files selected => no shapefiles to parse");
      } else {
        for (const zip of zipFiles) {
          logStatus(`Parsing zip: ${zip.name}`);
          const arrayBuff = await zip.arrayBuffer();

          // shpjs => parse => returns GeoJSON or array of GeoJSON
          const geojson = await shp(arrayBuff);

          // The default shpjs usage is that each .zip has a single FeatureCollection
          // But if your .zip has multiple shapefiles, shpjs might produce an object with multiple keys.
          // We’ll handle the single-FC scenario here:
          const featureCollections = Array.isArray(geojson)
            ? geojson
            : [geojson];

          for (const fc of featureCollections) {
            if (fc.type !== "FeatureCollection") continue;

            // We might guess a label from the zip name, e.g. “power_line”
            // Remove extension:
            const rawLabel = zip.name.replace(".zip", "");

            logStatus(
              `Found ${fc.features.length} features in ${zip.name}`
            );

            // Insert each feature into `component_polygons`
            for (const feature of fc.features) {
              // (optional) The shapefile’s original name might be in feature.properties
              // Or you can just store `rawLabel`.
              const label = rawLabel;

              const { error: polyErr } = await supabase
                .from("component_polygons")
                .insert([
                  {
                    image_id: newImageId,
                    label,
                    geometry: feature.geometry, // raw geometry
                  },
                ]);

              if (polyErr) {
                // Log but continue
                logStatus(
                  `Error inserting polygon for zip ${zip.name}: ${polyErr.message}`
                );
              }
            }
          } // end for (const fc of featureCollections)
        } // end for (const zip of zipFiles)
      }

      logStatus("All done! Upload completed successfully.");
      toast({
        title: "Success",
        description: "All uploads and inserts completed.",
      });
    } catch (error: any) {
      console.error(error);
      logStatus(`Error: ${error.message || error.toString()}`);
      toast({
        title: "Upload Failed",
        description: error.message || String(error),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-6">
      <Card className="p-6 bg-white shadow-md">
        <h2 className="text-xl font-semibold mb-4">Upload TIF &amp; Shapefile ZIP(s)</h2>

        <p className="text-sm text-gray-700">
          1) Select exactly one <strong>.tif</strong> file<br />
          2) Select any number of <strong>.zip</strong> files, each containing shapefile sidecars
        </p>

        <div className="mt-4">
          <input
            type="file"
            multiple
            accept=".tif,.tiff,.zip"
            onChange={handleFileSelect}
          />
        </div>

        {/* Display which files are selected */}
        <div className="mt-4">
          <div className="font-medium">Selected TIF:</div>
          <div className="text-gray-600">
            {tifFile ? tifFile.name : "No TIF file selected"}
          </div>
        </div>

        <div className="mt-2">
          <div className="font-medium">Selected ZIP(s):</div>
          <ul className="list-disc list-inside text-gray-600">
            {zipFiles.map((zip) => (
              <li key={zip.name}>{zip.name}</li>
            ))}
            {!zipFiles.length && <li>No ZIP files selected</li>}
          </ul>
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploading || !tifFile}
          className="mt-4"
        >
          {uploading ? "Uploading..." : "Upload All Files"}
        </Button>

        {/* Status messages */}
        <div className="mt-4 bg-gray-50 p-3 rounded-md border border-gray-200 text-sm text-gray-800 h-32 overflow-auto">
          {statusMessages.map((msg, idx) => (
            <div key={idx}>• {msg}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
