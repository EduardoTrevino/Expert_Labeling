"use client";

import React, { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Polygon,
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
    coordinates: number[][][];
  };
  created_at: string;
}

interface MapLeafletProps {
  polygons: ComponentPolygon[]; // This includes the substation boundary as well
  disablePanZoom?: boolean;
  onPolygonCreated?: (geojson: any) => void;
  onPolygonClicked?: (poly: ComponentPolygon) => void;
}

/**
 * Convert a GeoJSON polygon => array of [lat, lng].
 */
function geoJsonToLatLngs(geometry: any) {
  if (!geometry || geometry.type !== "Polygon") return [];
  const coords = geometry.coordinates[0] || [];
  // coords are [lng, lat], so flip to [lat, lng]
  return coords.map(([lng, lat]: [number, number]) => [lat, lng]);
}

/**
 * Sub-component that auto-fits the map to the substation polygon if found.
 */
function FitBoundsToSubstation({ polygons }: { polygons: ComponentPolygon[] }) {
  const map = useMap();

  useEffect(() => {
    const substationPoly = polygons.find(
      (p) => p.label === "power_substation_polygon"
    );
    if (!substationPoly) {
      map.setView([40, -95], 4); // fallback
      return;
    }

    const latlngs = geoJsonToLatLngs(substationPoly.geometry);
    if (!latlngs.length) {
      map.setView([40, -95], 4);
      return;
    }

    const bounds = L.latLngBounds(latlngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView([40, -95], 4);
    }
  }, [polygons, map]);

  return null;
}

export default function MapLeaflet({
  polygons,
  disablePanZoom,
  onPolygonCreated,
  onPolygonClicked,
}: MapLeafletProps) {
  const handleCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON();
    onPolygonCreated?.(geojson);
  };

  // We do want to render everything except the substation polygon in "yellow"
  // The substation polygon is effectively "invisible" if you choose
  // or you can draw it in a special color.
  const visiblePolygons = polygons; // if you'd rather not show substation boundary, filter it out

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MapContainer style={{ width: "100%", height: "100%" }} maxZoom={24}>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution=""
          maxNativeZoom={19}
          maxZoom={24}
        />
        {/* Auto-fit to substation boundary */}
        <FitBoundsToSubstation polygons={polygons} />

        {/* Show polygons */}
        {visiblePolygons.map((poly) => {
          const latlngs = geoJsonToLatLngs(poly.geometry);
          // maybe color the substation boundary differently:
          const color =
            poly.label === "power_substation_polygon"
              ? "red"
              : poly.confirmed
              ? "blue"
              : "yellow";
          return (
            <Polygon
              key={poly.id}
              pathOptions={{ color, fillOpacity: 0.3 }}
              positions={latlngs}
              eventHandlers={{
                click: () => onPolygonClicked?.(poly),
              }}
            />
          );
        })}

        {/* FeatureGroup with Leaflet Draw */}
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
    </div>
  );
}
