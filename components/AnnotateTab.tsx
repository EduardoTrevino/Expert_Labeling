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

/**
 * We dynamically import the Leaflet map,
 * which expects two main props:
 *   polygons: PolygonData[]
 *   onPolygonCreated(geojson)
 *   onPolygonClicked(PolygonData)
 */
const MapLeaflet = dynamic(() => import("@/components/MapLeaflet"), { ssr: false });

/**
 * Substation types for user to select
 */
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

/**
 * Full list of substation components we care about (for the labeling UI).
 * Some come from OSM shapefiles; others might be added by user drawing.
 */
const COMPONENT_OPTIONS = [
  "Power compensator",
  "Power transformer",
  "Power generator",
  "Power line",
  "Power plant",
  "Power switch",
  "Power tower",
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

interface SubstationData {
  id: string;
  full_id?: string;
  name?: string;
  substation_type?: string;
  geometry: any; // the substation polygon (GeoJSON)
  created_at: string;
  completed: boolean;
}

interface ComponentPolygon {
  id: string;
  substation_id: string | null; // if null, not yet assigned
  label: string;
  confirmed?: boolean;
  geometry: any; // geojson
  created_at: string;
}

export default function AnnotateTab() {
  const [substations, setSubstations] = useState<SubstationData[]>([]);
  const [selectedSubstation, setSelectedSubstation] = useState<SubstationData | null>(null);

  const [componentPolygons, setComponentPolygons] = useState<ComponentPolygon[]>([]);
  const [substationType, setSubstationType] = useState<string>("");

  // For the annotation dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPolygon, setDialogPolygon] = useState<ComponentPolygon | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  // We no longer guess "incomplete vs. complete" because we do not
  // know how many components "should" be in a substation. But if you
  // still want a quick display, you can do something simpler:
  const [incompleteLabels, setIncompleteLabels] = useState<string[]>(COMPONENT_OPTIONS);
  const [completeLabels, setCompleteLabels] = useState<string[]>([]);

  // Fetch all substations from DB
  useEffect(() => {
    fetchSubstations();
  }, []);

  async function fetchSubstations() {
    const { data, error } = await supabase
      .from("substations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setSubstations(data || []);
    // Optionally auto-select the first
    if (data && data.length > 0) {
      setSelectedSubstation(data[0]);
      setSubstationType(data[0].substation_type ?? "");
    }
  }

  // Whenever user picks a substation from the sidebar
  // we load its existing component polygons
  useEffect(() => {
    if (!selectedSubstation) return;
    setSubstationType(selectedSubstation.substation_type ?? "");
    fetchComponentPolygons(selectedSubstation.id);
  }, [selectedSubstation]);

  async function fetchComponentPolygons(substationId: string) {
    // We only fetch polygons that are assigned to this substation:
    const { data, error } = await supabase
      .from("component_polygons")
      .select("*")
      .eq("substation_id", substationId);
    if (error) {
      console.error(error);
      return;
    }
    setComponentPolygons(data || []);
  }

  function handleSelectSubstation(substation: SubstationData) {
    setSelectedSubstation(substation);
    setComponentPolygons([]);
  }

  // Let user pick a substation type from a dropdown
  function handleSubstationTypeChange(val: string) {
    setSubstationType(val);
    if (val !== "Other") {
      updateSubstationType(val);
    }
  }

  // If user chooses "Other" and then types a custom type
  function handleSubstationOtherBlur() {
    if (substationType === "Other" && otherText.trim() && selectedSubstation) {
      updateSubstationType(otherText.trim());
    }
  }

  async function updateSubstationType(finalVal: string) {
    if (!selectedSubstation) return;
    const { error } = await supabase
      .from("substations")
      .update({ substation_type: finalVal })
      .eq("id", selectedSubstation.id);
    if (error) console.error(error);
  }

  /**
   * MAP: When user draws a new polygon in Leaflet
   */
  function handlePolygonCreated(geojson: any) {
    if (!selectedSubstation) return;
    // This is brand new => substation_id = that substation
    const newPoly: ComponentPolygon = {
      id: `temp-${Date.now()}`,
      substation_id: selectedSubstation.id,
      label: "",
      confirmed: false,
      geometry: geojson.geometry,
      created_at: new Date().toISOString(),
    };
    setDialogPolygon(newPoly);
    setSelectedComponents([]);
    setOtherText("");
    setDialogOpen(true);
  }

  /**
   * MAP: Clicking an existing polygon => open annotation dialog
   * We skip if label === "power_substation_polygon" because
   * the substation boundary is not for editing. But in
   * this approach, we store the boundary in `substations`,
   * not `component_polygons`, so it won't appear as a component anyway.
   */
  function handlePolygonClicked(poly: ComponentPolygon) {
    // open the dialog to re-label or delete
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

  /**
   * Dialog "Save" => either insert or update the polygon in `component_polygons`
   */
  async function handleSavePolygon() {
    if (!dialogPolygon || !selectedSubstation) return;
    let finalLabel = "";
    if (selectedComponents.length > 0) {
      // If user picked from known list
      finalLabel = selectedComponents[0];
    } else if (otherText.trim()) {
      // If user typed a custom label
      finalLabel = otherText.trim();
    }

    const isTemp = dialogPolygon.id.startsWith("temp-");
    if (isTemp) {
      // Insert new
      const { data, error } = await supabase
        .from("component_polygons")
        .insert([
          {
            substation_id: selectedSubstation.id,
            label: finalLabel,
            geometry: dialogPolygon.geometry,
            confirmed: false,
          },
        ])
        .select("*");
      if (!error && data && data.length > 0) {
        setComponentPolygons((prev) => [...prev, data[0]]);
      } else if (error) {
        console.error(error);
      }
    } else {
      // Update existing
      const { data, error } = await supabase
        .from("component_polygons")
        .update({ label: finalLabel, confirmed: false })
        .eq("id", dialogPolygon.id)
        .select("*");
      if (!error && data && data.length > 0) {
        setComponentPolygons((prev) =>
          prev.map((p) =>
            p.id === dialogPolygon.id
              ? { ...p, label: finalLabel, confirmed: false }
              : p
          )
        );
      } else if (error) {
        console.error(error);
      }
    }

    setDialogPolygon(null);
    setDialogOpen(false);
  }

  /**
   * Dialog "Delete" => remove from DB if already inserted
   */
  async function handleDeletePolygon() {
    if (!dialogPolygon) return;

    if (dialogPolygon.id.startsWith("temp-")) {
      // Not yet in DB => just remove from local
      setDialogPolygon(null);
      setDialogOpen(false);
      return;
    }

    // Delete from supabase
    const { error } = await supabase
      .from("component_polygons")
      .delete()
      .eq("id", dialogPolygon.id);
    if (error) {
      console.error(error);
    } else {
      setComponentPolygons((prev) => prev.filter((p) => p.id !== dialogPolygon.id));
    }
    setDialogPolygon(null);
    setDialogOpen(false);
  }

  /**
   * When user is done with a substation, mark it as complete
   */
  async function handleCompleteSubstation() {
    if (!selectedSubstation) return;
    // We set completed=true
    const { error } = await supabase
      .from("substations")
      .update({ completed: true })
      .eq("id", selectedSubstation.id);
    if (error) {
      console.error(error);
      alert("Error completing substation");
      return;
    }
    alert("Substation completed!");

    // Remove from local list
    setSubstations((prev) => prev.filter((s) => s.id !== selectedSubstation.id));
    setSelectedSubstation(null);
    setComponentPolygons([]);
  }

  // Optional: still show "complete vs incomplete" based on `confirmed`?
  useEffect(() => {
    const usedLabels = componentPolygons
      .filter((p) => p.confirmed && COMPONENT_OPTIONS.includes(p.label))
      .map((p) => p.label);
    const uniqueUsed = Array.from(new Set(usedLabels));
    const complete = COMPONENT_OPTIONS.filter((opt) => uniqueUsed.includes(opt));
    const incomplete = COMPONENT_OPTIONS.filter((opt) => !uniqueUsed.includes(opt));
    setCompleteLabels(complete);
    setIncompleteLabels(incomplete);
  }, [componentPolygons]);

  /**
   * For the map, we combine:
   *  - The substation boundary itself (labeled "power_substation_polygon")
   *  - The component polygons from `componentPolygons`
   */
  function getMapPolygons() {
    if (!selectedSubstation) return [];

    // Substation boundary as a "PolygonData"
    const boundaryPolygon = {
      id: "substation_" + selectedSubstation.id,
      substation_id: selectedSubstation.id,
      label: "power_substation_polygon",
      confirmed: true,
      geometry: selectedSubstation.geometry,
      created_at: selectedSubstation.created_at,
    };

    return [boundaryPolygon, ...componentPolygons];
  }

  return (
    <div className="flex gap-4 mt-6">
      {/* Sidebar */}
      <div className="w-64 flex flex-col">
        <div className="mb-4 font-semibold text-gray-800">
          {substations.length} substations left to annotate
        </div>
        <ScrollArea className="h-[600px]">
          <div className="flex flex-col space-y-2">
            {substations.map((sub) => (
              <div
                key={sub.id}
                className={`p-2 rounded hover:bg-gray-100 cursor-pointer ${
                  selectedSubstation?.id === sub.id ? "bg-gray-200" : ""
                }`}
                onClick={() => handleSelectSubstation(sub)}
              >
                <div className="text-sm font-medium">
                  {sub.full_id || sub.name || "Unnamed Substation"}
                </div>
                <div className="text-xs text-gray-600">
                  {sub.created_at.slice(0, 10)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col relative">
        {selectedSubstation ? (
          <Card className="p-4 bg-white shadow-md flex-1 flex flex-col">
            {/* Substation type row */}
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
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  onBlur={handleSubstationOtherBlur}
                />
              )}
            </div>

            {/* Badge row (optional) */}
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

            {/* Map */}
            <div className="flex-1 relative border" style={{ minHeight: 400 }}>
              <MapLeaflet
                polygons={getMapPolygons()}
                disablePanZoom={false}
                onPolygonCreated={handlePolygonCreated}
                onPolygonClicked={handlePolygonClicked}
              />
            </div>

            {/* Complete substation button */}
            <Button
              onClick={handleCompleteSubstation}
              className="bottom-4 right-4 bg-blue-300 text-black mt-4"
            >
              Complete Substation
            </Button>
          </Card>
        ) : (
          <div className="p-8 text-gray-600">
            Select a substation from the sidebar.
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
            <DialogTitle>Annotate / Confirm Component</DialogTitle>
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
                Other Label:
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
