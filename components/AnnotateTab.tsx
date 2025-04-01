"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// We dynamically import the Leaflet map
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
  "Power Compensator",
  "Power Transformer",
  "Power Generator",
  "Power Line",
  "Power Plant",
  "Power Switch",
  "Power Tower",
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
  substation_type?: string | null; // might be null
  geometry: any;
  created_at: string;
  completed: boolean;
}

interface ComponentPolygon {
  id: string;
  substation_id: string | null;
  label: string;
  confirmed?: boolean;
  geometry: any;
  created_at: string;
  substation_full_id?: string; // for OSM full_id reference
}

export default function AnnotateTab() {
  const [substations, setSubstations] = useState<SubstationData[]>([]);
  const [selectedSubstation, setSelectedSubstation] = useState<SubstationData | null>(null);

  const [componentPolygons, setComponentPolygons] = useState<ComponentPolygon[]>([]);
  const [substationType, setSubstationType] = useState<string>("");
  const [substationTypeNeedsHighlight, setSubstationTypeNeedsHighlight] = useState<boolean>(false);

  // For the annotation dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPolygon, setDialogPolygon] = useState<ComponentPolygon | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  // On mount, load all substations
  useEffect(() => {
    fetchSubstations();
  }, []);

  async function fetchSubstations() {
    const { data, error } = await supabase
      .from("substations")
      .select("*")
      .eq("completed", false)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setSubstations(data || []);
    if (data && data.length > 0) {
      setSelectedSubstation(data[0]);
    }
  }

  // Whenever substation changes, load polygons
  useEffect(() => {
    if (!selectedSubstation) return;
    setupSubstationType(selectedSubstation.substation_type ?? "");
    fetchComponentPolygons(selectedSubstation.id);
  }, [selectedSubstation]);

  function setupSubstationType(currentType: string) {
    if (!currentType) {
      setSubstationType("");
      setSubstationTypeNeedsHighlight(true);
      return;
    }
    if (SUBSTATION_TYPES.includes(currentType)) {
      setSubstationType(currentType);
      setSubstationTypeNeedsHighlight(true);
    } else {
      // not in known list
      setSubstationType("Other");
      setOtherText(currentType);
      setSubstationTypeNeedsHighlight(true);
    }
  }

  async function fetchComponentPolygons(substationId: string) {
    // assigned
    const { data: assigned, error: assignedErr } = await supabase
      .from("component_polygons")
      .select("*")
      .eq("substation_uuid", substationId);
    if (assignedErr) console.error(assignedErr);

    // unassigned
    const { data: unassigned, error: unassignedErr } = await supabase
      .from("component_polygons")
      .select("*")
      .is("substation_uuid", null);
    if (unassignedErr) console.error(unassignedErr);

    const combined = [...(assigned || []), ...(unassigned || [])];
    setComponentPolygons(combined);
  }

  function handleSelectSubstation(sub: SubstationData) {
    setSelectedSubstation(sub);
    setComponentPolygons([]);
  }

  function handleSubstationTypeChange(val: string) {
    setSubstationType(val);
    if (val === "") {
      setSubstationTypeNeedsHighlight(true);
    } else if (val !== "Other") {
      setSubstationTypeNeedsHighlight(false);
      updateSubstationType(val);
    }
  }

  function handleSubstationOtherBlur() {
    if (substationType === "Other" && otherText.trim() && selectedSubstation) {
      updateSubstationType(otherText.trim());
      setSubstationTypeNeedsHighlight(false);
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

  // MAP: user draws a new polygon => open dialog
  function handlePolygonCreated(geojson: any) {
    if (!selectedSubstation) return;
    const newPoly: ComponentPolygon = {
      id: `temp-${Date.now()}`,
      substation_id: selectedSubstation.id,
      label: "",
      confirmed: false,
      geometry: geojson.geometry,
      created_at: new Date().toISOString(),
      substation_full_id: selectedSubstation.full_id || undefined,
    };
    setDialogPolygon(newPoly);
    setSelectedComponents([]);
    setOtherText("");
    setDialogOpen(true);
  }

  // MAP: clicking existing shape => open dialog
  function handlePolygonClicked(poly: ComponentPolygon) {
    // If the label is known => check it; else put in "Other"
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

  // toggling a label in the checkbox list
  function toggleComponent(c: string) {
    setSelectedComponents((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  // Save changes from the dialog
  async function handleSavePolygon() {
    if (!dialogPolygon || !selectedSubstation) return;
    const finalLabel =
      selectedComponents.length > 0 ? selectedComponents[0] : otherText.trim() || "";

    const isTemp = dialogPolygon.id.startsWith("temp-");
    const payload = {
      substation_uuid: selectedSubstation.id,
      substation_full_id: dialogPolygon.substation_full_id ?? selectedSubstation.full_id ?? null,
      label: finalLabel,
      geometry: dialogPolygon.geometry,
      confirmed: true,
    };

    if (isTemp) {
      // insert
      const { data, error } = await supabase
        .from("component_polygons")
        .insert([payload])
        .select("*");
      if (!error && data) {
        setComponentPolygons((prev) => [...prev, ...data]);
      } else {
        console.error(error);
      }
    } else {
      // update
      const { data, error } = await supabase
        .from("component_polygons")
        .update(payload)
        .eq("id", dialogPolygon.id)
        .select("*");
      if (!error && data) {
        setComponentPolygons((prev) =>
          prev.map((p) => (p.id === dialogPolygon.id ? data[0] : p))
        );
      } else {
        console.error(error);
      }
    }
    setDialogOpen(false);
    setDialogPolygon(null);
  }

  async function handleDeletePolygon() {
    if (!dialogPolygon) return;
    if (dialogPolygon.id.startsWith("temp-")) {
      // not in DB
      setDialogOpen(false);
      setDialogPolygon(null);
      return;
    }
    const { error } = await supabase
      .from("component_polygons")
      .delete()
      .eq("id", dialogPolygon.id);
    if (error) console.error(error);
    else {
      setComponentPolygons((prev) => prev.filter((x) => x.id !== dialogPolygon.id));
    }
    setDialogOpen(false);
    setDialogPolygon(null);
  }

  // Mark substation complete => ensure substation_type is chosen
  async function handleCompleteSubstation() {
    if (!selectedSubstation) return;
    if (!substationType) {
      alert("Please select a substation type before completing.");
      return;
    }

    // everything is good => complete
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
    setSubstations((prev) => prev.filter((s) => s.id !== selectedSubstation.id));
    setSelectedSubstation(null);
    setComponentPolygons([]);
  }

  // The polygons for the map => we do NOT inject substation boundary as clickable
  function getMapPolygons() {
    if (!selectedSubstation) return componentPolygons;
    // If you do NOT want to see substation boundary at all, remove the line below
    const boundaryPolygon: ComponentPolygon = {
      id: "substation_" + selectedSubstation.id,
      substation_id: selectedSubstation.id,
      label: "power_substation_polygon",
      confirmed: true,
      geometry: selectedSubstation.geometry,
      created_at: selectedSubstation.created_at,
      substation_full_id: selectedSubstation.full_id,
    };
    return [boundaryPolygon, ...componentPolygons];
  }

  // Summaries: total count + how many confirmed
  const labelTotals: Record<string, number> = {};
  const labelConfirmed: Record<string, number> = {};
  componentPolygons.forEach((cp) => {
    if (!cp.label) return;
    labelTotals[cp.label] = (labelTotals[cp.label] || 0) + 1;
    if (cp.confirmed) {
      labelConfirmed[cp.label] = (labelConfirmed[cp.label] || 0) + 1;
    }
  });

  const summaryRows = Object.keys(labelTotals).sort().map((lbl) => {
    const total = labelTotals[lbl];
    const confirmed = labelConfirmed[lbl] || 0;
    return { lbl, total, confirmed };
  });

  // Substation type dropdown highlight logic
  const dropdownStyle: React.CSSProperties = {};
  if (substationTypeNeedsHighlight) {
    if (substationType === "") {
      dropdownStyle.backgroundColor = "rgba(255,0,0,0.2)"; // red
    } else if (substationType === "Other" && otherText.trim().length > 0) {
      dropdownStyle.backgroundColor = "white";
    } else {
      dropdownStyle.backgroundColor = "rgba(255,255,0,0.3)"; // yellow
    }
  }
  const otherStyle: React.CSSProperties = {};
  if (substationType === "Other" && substationTypeNeedsHighlight) {
    otherStyle.backgroundColor = "rgba(255,255,0,0.3)";
  }

  return (
    <div className="flex gap-4 mt-6">
      {/* Sidebar: substation list */}
      <div className="w-64 flex flex-col">
        <div className="mb-4 font-semibold text-gray-800">
          {substations.length} Substations to annotate
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

      {/* Main content: Map + annotation UI */}
      <div className="flex-1 flex flex-col relative">
        {selectedSubstation ? (
          <>
            <Card className="p-4 bg-white shadow-md flex-1 flex flex-col mb-4">
              {/* Substation Type */}
              <div className="mb-2 flex items-center gap-2">
                <label className="font-bold">Substation Type:</label>
                <select
                  className="border px-2 py-1 rounded"
                  style={dropdownStyle}
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
                    style={otherStyle}
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    onBlur={handleSubstationOtherBlur}
                  />
                )}
              </div>

              {/* The Leaflet map */}
              <div className="flex-1 relative border" style={{ minHeight: 400 }}>
                <MapLeaflet
                  polygons={getMapPolygons()}
                  onPolygonCreated={handlePolygonCreated}
                  onPolygonClicked={handlePolygonClicked}
                />
              </div>

              {/* Button => mark substation complete */}
              <Button
                onClick={handleCompleteSubstation}
                className="bottom-4 right-4 bg-blue-300 text-black mt-4"
              >
                Complete Substation
              </Button>
            </Card>

            {/* Summary of Components */}
            <Card className="p-4 bg-white shadow-md mb-4">
              <h2 className="text-lg font-semibold mb-2">Component Summary</h2>
              {summaryRows.length === 0 ? (
                <div className="text-sm text-gray-600">No components found.</div>
              ) : (
                <table className="text-sm w-full border">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-1 border-b text-left">Label</th>
                      <th className="px-2 py-1 border-b text-left">Total</th>
                      <th className="px-2 py-1 border-b text-left">Confirmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map(({ lbl, total, confirmed }) => (
                      <tr key={lbl}>
                        <td className="px-2 py-1 border-b">{lbl}</td>
                        <td className="px-2 py-1 border-b">{total}</td>
                        <td className="px-2 py-1 border-b">{confirmed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        ) : (
          <div className="p-8 text-gray-600">
            Select a substation from the sidebar.
          </div>
        )}
      </div>

      {/* Dialog for labeling or confirming a polygon */}
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
