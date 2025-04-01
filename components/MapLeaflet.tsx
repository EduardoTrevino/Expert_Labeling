"use client";

import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Polygon,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

export interface ComponentPolygon {
  id: string;
  substation_id: string | null;
  label: string;
  confirmed?: boolean;
  geometry: {
    type: string;
    coordinates: any;
  };
  created_at: string;
  substation_full_id?: string; // optional
}

// We define some color mapping for known labels
const LABEL_COLORS: Record<string, string> = {
  "Power Compensator": "#00AAFF", // cyan-blue
  "Power Transformer": "#FF00AA", // magenta-pink
  "Power Generator": "#FFD700",   // gold
  "Power Line": "#ffa500",        // orange
  "Power Plant": "#800080",       // purple
  "Power Switch": "#DC143C",      // crimson red
  "Power Tower": "#0000FF",       // blue
};

function FitBoundsToSubstation({ polygons }: { polygons: ComponentPolygon[] }) {
  const map = useMap();

  useEffect(() => {
    const substationPoly = polygons.find(
      (p) => p.label === "power_substation_polygon"
    );
    if (!substationPoly || substationPoly.geometry?.type !== "Polygon") {
      map.setView([40, -95], 4);
      return;
    }

    const ring = substationPoly.geometry.coordinates[0];
    if (!ring || ring.length === 0) {
      map.setView([40, -95], 4);
      return;
    }

    const latlngs = ring.map(([lng, lat]: [number, number]) => [lat, lng]);
    const bounds = L.latLngBounds(latlngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView([40, -95], 4);
    }
  }, [polygons, map]);

  return null;
}

// Utility conversions
function convertPolygonRing(ring: number[][]) {
  return ring.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
}
function convertLineCoords(coords: number[][]) {
  return coords.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
}
function convertPointCoord(coords: number[]) {
  return [coords[1], coords[0]] as L.LatLngTuple;
}

/**
 * Renders each component on the map.
 *  - If `confirmed === true` => color = green
 *  - Else if newly drawn => color = yellow
 *  - Else color by LABEL_COLORS or fallback to "blue"
 *  - Substation boundary => red outline, not interactive
 */
function renderFeature(
  poly: ComponentPolygon,
  onPolygonClicked?: (p: ComponentPolygon) => void
) {
  const { geometry, label, confirmed, id } = poly;
  // If user tries to click => pass it up, unless it's the substation boundary
  const handleClick = () => onPolygonClicked?.(poly);

  const isNewShape = id.startsWith("temp-");

  // For substation boundary, we show a red outline and make it NOT clickable
  if (label === "power_substation_polygon") {
    if (geometry.type === "Polygon") {
      const outerRing = geometry.coordinates[0] || [];
      const latlngs = convertPolygonRing(outerRing);

      return (
        <Polygon
          key={poly.id}
          pathOptions={{
            color: "red",
            fill: false,
            weight: 2,
            interactive: false, // disable clicks
          }}
          positions={latlngs}
        />
      );
    }
    return null; // if not a polygon for some reason
  }

  // Decide color
  let color = "blue";
  if (confirmed) {
    color = "green";
  } else if (isNewShape) {
    color = "yellow";
  } else {
    color = LABEL_COLORS[label] || "blue";
  }

  switch (geometry.type) {
    case "Polygon": {
      const outerRing = geometry.coordinates[0] || [];
      const latlngs = convertPolygonRing(outerRing);
      return (
        <Polygon
          key={poly.id}
          pathOptions={{
            color,
            fill: false,
            weight: 3,
          }}
          positions={latlngs}
          eventHandlers={{ click: handleClick }}
        />
      );
    }
    case "LineString": {
      const coords = geometry.coordinates || [];
      const latlngs = convertLineCoords(coords);
      return (
        <Polyline
          key={poly.id}
          pathOptions={{ color, weight: 3 }}
          positions={latlngs}
          eventHandlers={{ click: handleClick }}
        />
      );
    }
    case "Point": {
      const coords = geometry.coordinates || [];
      const latlng = convertPointCoord(coords);
      return (
        <CircleMarker
          key={poly.id}
          center={latlng}
          pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
          radius={5}
          eventHandlers={{ click: handleClick }}
        />
      );
    }
    default:
      return null;
  }
}

interface MapLeafletProps {
  polygons: ComponentPolygon[];
  disablePanZoom?: boolean;
  onPolygonCreated?: (geojson: any) => void;
  onPolygonClicked?: (poly: ComponentPolygon) => void;
}

export default function MapLeaflet({
  polygons,
  disablePanZoom,
  onPolygonCreated,
  onPolygonClicked,
}: MapLeafletProps) {
  // Called when user draws a new shape
  const handleCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON();
    onPolygonCreated?.(geojson);
  };

  // Gather unique labels for the legend
  const presentLabels = Array.from(
    new Set(
      polygons
        .filter(
          (p) => p.label !== "power_substation_polygon" && !p.id.startsWith("temp-")
        )
        .map((p) => p.label)
    )
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapContainer style={{ width: "100%", height: "100%" }} maxZoom={24}>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution=""
          maxNativeZoom={19}
          maxZoom={24}
        />

        {/* Auto-fit the substation polygon's bounding box */}
        <FitBoundsToSubstation polygons={polygons} />

        {/* Render each feature */}
        {polygons.map((poly) => renderFeature(poly, onPolygonClicked))}

        <FeatureGroup>
          <EditControl
            position="topright"
            draw={{
              polygon: true,
              marker: false,
              polyline: false,
              rectangle: false,
              circle: false,
              circlemarker: false,
            }}
            edit={{
              edit: false,
              remove: false,
            }}
            onCreated={handleCreated}
          />
        </FeatureGroup>
      </MapContainer>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          zIndex: 9999,
          bottom: 10,
          left: 10,
          background: "rgba(255,255,255,0.75)",
          padding: "8px",
          borderRadius: "4px",
          boxShadow: "0 0 4px rgba(0,0,0,0.3)",
          fontSize: "0.85rem",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Legend</div>

        {presentLabels.map((lbl) => {
          const clr = LABEL_COLORS[lbl] || "blue";
          return (
            <div
              key={lbl}
              style={{ display: "flex", alignItems: "center", marginBottom: 4 }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  background: clr,
                  border: `2px solid ${clr}`,
                  marginRight: 6,
                }}
              />
              {lbl}
            </div>
          );
        })}

        {/* Newly drawn */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              background: "yellow",
              border: "2px solid yellow",
              marginRight: 6,
            }}
          />
          Newly Drawn
        </div>

        {/* Confirmed => green */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              background: "green",
              border: "2px solid green",
              marginRight: 6,
            }}
          />
          Confirmed
        </div>

        {/* Substation boundary */}
        <div style={{ display: "flex", alignItems: "center", marginTop: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              border: "2px solid red",
              marginRight: 6,
            }}
          />
          Substation Boundary
        </div>
      </div>
    </div>
  );
}
