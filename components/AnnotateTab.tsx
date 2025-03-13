"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Dynamically import the map
const MapLeaflet = dynamic(() => import("@/components/MapLeaflet"), { ssr: false });

const SUBSTATION_TYPES = [
  "Transmission",
  "Distribution",
  "Industrial owned",
  "Customer Owned",
  "Sub-transmission station",
  "Switching station",
  "Gas Insulated Substation",
  "Other",
];

const COMPONENT_OPTIONS = [
  "Power transformer",
  "Circuit switch",
  "Circuit breaker",
  "High side power area",
  "Capacitor bank",
  "Battery bank",
  "Bus bar",
  "Control house",
  "Spare equipment",
  "Vehicles",
  "Tripolar disconnect switch",
  "Recloser",
  "Fuse disconnect switch",
  "Closed blade disconnect switch",
  "Current transformer",
  "Open blade disconnect switch",
  "Closed tandem disconnect switch",
  "Open tandem disconnect switch",
  "Lightning arrester",
  "Glass disc insulator",
  "Potential transformer",
  "Muffle",
];

interface ImageData {
  id: string;
  url: string; 
  name?: string;
  uploaded_by: string;
  created_at: string;
  completed?: boolean;
  substation_type?: string;
}

interface PolygonData {
  id: string;
  image_id: string;
  label: string;
  confirmed?: boolean;
  geometry: {
    type: string;
    coordinates: any[][];
  };
}

export default function AnnotateTab() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  const [polygons, setPolygons] = useState<PolygonData[]>([]);
  const [substationType, setSubstationType] = useState("");
  const [substationTypeOther, setSubstationTypeOther] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPolygon, setDialogPolygon] = useState<PolygonData | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  const [incompleteLabels, setIncompleteLabels] = useState<string[]>(COMPONENT_OPTIONS);
  const [completeLabels, setCompleteLabels] = useState<string[]>([]);

  // Filter out substation polygon if you prefer
  const actualPolygons = polygons.filter((p) => p.label !== "power_substation_polygon");

  useEffect(() => {
    fetchUncompletedImages();
  }, []);

  async function fetchUncompletedImages() {
    const { data } = await supabase
      .from("images")
      .select("*")
      .eq("completed", false)
      .order("created_at", { ascending: false });
    setImages(data || []);
    if (data && data.length > 0) {
      setSelectedImage(data[0]);
    }
  }

  useEffect(() => {
    if (!selectedImage) return;
    fetchPolygonsForImage(selectedImage.id);
    setSubstationType(selectedImage.substation_type || "");
    setSubstationTypeOther("");
  }, [selectedImage]);

  async function fetchPolygonsForImage(imgId: string) {
    const { data } = await supabase
      .from("component_polygons")
      .select("*")
      .eq("image_id", imgId);
    setPolygons(data || []);
  }

  function handleSelectImage(img: ImageData) {
    setSelectedImage(img);
    setPolygons([]);
  }

  function handleSubstationTypeChange(val: string) {
    setSubstationType(val);
    if (val === "Other") {
      setSubstationTypeOther("");
    } else {
      updateSubstationType(val);
    }
  }
  async function updateSubstationType(finalVal: string) {
    if (!selectedImage) return;
    await supabase
      .from("images")
      .update({ substation_type: finalVal })
      .eq("id", selectedImage.id);
  }
  function handleSubstationOtherBlur() {
    if (!selectedImage) return;
    if (substationType === "Other" && substationTypeOther.trim()) {
      updateSubstationType(substationTypeOther.trim());
    }
  }

  // Called when user finishes drawing polygon
  function handlePolygonCreated(geojson: any) {
    if (!selectedImage) return;
    const newPoly: PolygonData = {
      id: `temp-${Date.now()}`,
      image_id: selectedImage.id,
      label: "",
      confirmed: false,
      geometry: geojson.geometry,
    };
    setDialogPolygon(newPoly);
    setSelectedComponents([]);
    setOtherText("");
    setDialogOpen(true);
  }

  function handlePolygonClicked(poly: PolygonData) {
    if (poly.label === "power_substation_polygon") return;
    setDialogPolygon(poly);
    if (COMPONENT_OPTIONS.includes(poly.label)) {
      setSelectedComponents([poly.label]);
      setOtherText("");
    } else {
      setSelectedComponents([]);
      setOtherText(poly.label || "");
    }
    setDialogOpen(true);
  }

  function toggleComponent(c: string) {
    setSelectedComponents((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  async function handleSavePolygon() {
    if (!dialogPolygon) return;
    let finalLabel = "";
    if (selectedComponents.length > 0) {
      finalLabel = selectedComponents[0];
    } else if (otherText.trim()) {
      finalLabel = otherText.trim();
    }
    const isTemp = dialogPolygon.id.startsWith("temp-");

    if (isTemp) {
      // Insert new
      const { data } = await supabase
        .from("component_polygons")
        .insert([
          {
            image_id: dialogPolygon.image_id,
            label: finalLabel,
            geometry: dialogPolygon.geometry,
            confirmed: false,
          },
        ])
        .select("*");
      if (data && data.length > 0) {
        setPolygons((prev) => [...prev, data[0]]);
      }
    } else {
      // Update existing
      const { data } = await supabase
        .from("component_polygons")
        .update({ label: finalLabel, confirmed: false })
        .eq("id", dialogPolygon.id)
        .select("*");
      if (data && data.length > 0) {
        setPolygons((prev) =>
          prev.map((p) =>
            p.id === dialogPolygon.id ? { ...p, label: finalLabel, confirmed: false } : p
          )
        );
      }
    }

    setDialogPolygon(null);
    setDialogOpen(false);
  }

  async function handleDeletePolygon() {
    if (!dialogPolygon) return;
    if (dialogPolygon.id.startsWith("temp-")) {
      setDialogPolygon(null);
      setDialogOpen(false);
      return;
    }
    await supabase
      .from("component_polygons")
      .delete()
      .eq("id", dialogPolygon.id);
    setPolygons((prev) => prev.filter((p) => p.id !== dialogPolygon.id));
    setDialogPolygon(null);
    setDialogOpen(false);
  }

  // Mark entire image as complete
  async function handleCompleteImage() {
    if (!selectedImage) return;
    if (!substationType || (substationType === "Other" && !substationTypeOther.trim())) {
      alert("Please select/enter substation type.");
      return;
    }
    if (substationType === "Other" && substationTypeOther.trim()) {
      await updateSubstationType(substationTypeOther.trim());
    }
    await supabase
      .from("images")
      .update({ completed: true })
      .eq("id", selectedImage.id);
    setImages((prev) => prev.filter((im) => im.id !== selectedImage.id));
    setSelectedImage(null);
    setPolygons([]);
    alert("Image completed!");
  }

  // Distinguish incomplete vs. complete from "confirmed" polygons
  useEffect(() => {
    const usedLabels = actualPolygons
      .filter((p) => p.confirmed && COMPONENT_OPTIONS.includes(p.label))
      .map((p) => p.label);
    const uniqueUsed = Array.from(new Set(usedLabels));
    const complete = COMPONENT_OPTIONS.filter((opt) => uniqueUsed.includes(opt));
    const incomplete = COMPONENT_OPTIONS.filter((opt) => !uniqueUsed.includes(opt));
    setCompleteLabels(complete);
    setIncompleteLabels(incomplete);
  }, [actualPolygons]);

  return (
    <div className="flex gap-4 mt-6">
      {/* Sidebar */}
      <div className="w-64 flex flex-col">
        <div className="mb-4 font-semibold text-gray-800">
          {images.length} images left to annotate
        </div>
        <ScrollArea className="h-[600px]">
          <div className="flex flex-col space-y-2">
            {images.map((img) => (
              <div
                key={img.id}
                className={`p-2 rounded hover:bg-gray-100 cursor-pointer ${
                  selectedImage?.id === img.id ? "bg-gray-200" : ""
                }`}
                onClick={() => handleSelectImage(img)}
              >
                <div className="text-sm font-medium">{img.name || "Unnamed"}</div>
                <div className="text-xs text-gray-600">By: {img.uploaded_by}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col relative">
        {selectedImage ? (
          <Card className="p-4 bg-white shadow-md flex-1 flex flex-col">
            {/* Substation Type row */}
            <div className="mb-2 flex items-center gap-2">
              <label className="font-bold">Substation Type:</label>
              <select
                className="border px-2 py-1 rounded"
                value={substationType}
                onChange={(e) => handleSubstationTypeChange(e.target.value)}
              >
                <option value="">(Select type)</option>
                {SUBSTATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {substationType === "Other" && (
                <input
                  type="text"
                  placeholder="Enter substation type"
                  className="border rounded px-2 py-1"
                  value={substationTypeOther}
                  onChange={(e) => setSubstationTypeOther(e.target.value)}
                  onBlur={handleSubstationOtherBlur}
                />
              )}
            </div>

            {/* Badge row */}
            <div className="flex gap-6 mb-2">
              <div>
                <div className="text-sm font-semibold mb-1">Incomplete</div>
                <div className="flex flex-wrap gap-2">
                  {incompleteLabels.map((lbl) => (
                    <Badge key={lbl} variant="destructive">
                      {lbl}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-1">Complete</div>
                <div className="flex flex-wrap gap-2">
                  {completeLabels.map((lbl) => (
                    <Badge key={lbl} variant="secondary">
                      {lbl}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Leaflet map => let user pan/zoom. No disablePanZoom */}
            <div className="flex-1 relative border" style={{ minHeight: 400 }}>
              <MapLeaflet
                tifUrl={selectedImage.url}
                polygons={actualPolygons}
                disablePanZoom={false} // let user move around & zoom
                onPolygonCreated={handlePolygonCreated}
                onPolygonClicked={handlePolygonClicked}
              />
            </div>

            {/* Complete image button bottom-right */}
            <Button
              onClick={handleCompleteImage}
              className="bottom-4 right-4 bg-blue-300 text-black"
            >
              Complete Image
            </Button>
          </Card>
        ) : (
          <div className="p-8 text-gray-600">
            Select an image from the sidebar.
          </div>
        )}
      </div>

      {/* Dialog for labeling polygons */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="z-[9999] max-w-lg"
          style={{ position: "absolute", cursor: "move" }}
        >
          <DialogHeader>
            <DialogTitle>Annotate Component</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 h-64 overflow-auto">
            {COMPONENT_OPTIONS.map((option) => {
              const checked = selectedComponents.includes(option);
              return (
                <div key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleComponent(option)}
                  />
                  <label>{option}</label>
                </div>
              );
            })}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                Other:
              </label>
              <input
                type="text"
                className="border rounded p-1 w-full"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeletePolygon}>
              Delete
            </Button>
            <Button onClick={handleSavePolygon}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
