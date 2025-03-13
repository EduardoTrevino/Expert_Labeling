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
import georaster from "georaster"; 
import GeoRasterLayer from "georaster-layer-for-leaflet";

// The shape of your DB polygons
export interface PolygonData {
  id: string;
  image_id: string;
  label: string;
  confirmed?: boolean;
  geometry: {
    type: string;
    coordinates: number[][][]; // single polygon ring
  };
}

interface MapLeafletProps {
  tifUrl: string;               // The public URL to your .tif from Supabase
  polygons: PolygonData[];      // Polygons from DB
  disablePanZoom?: boolean;     // If you truly want to lock the map, set true
  onPolygonCreated?: (geojson: any) => void;
  onPolygonClicked?: (poly: PolygonData) => void;
}

function geoJsonToLatLngs(geometry: any) {
  if (geometry.type !== "Polygon") return [];
  const coords = geometry.coordinates[0];
  return coords.map(([lng, lat]: [number, number]) => [lat, lng]);
}

/**
 * Sub-component that loads the GeoTIFF with georaster-layer-for-leaflet
 * and adds it to a custom Leaflet pane so we can control zIndex easily.
 */
function GeoTiffOverlay({
  tifUrl,
  disablePanZoom,
}: {
  tifUrl: string;
  disablePanZoom?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    let layer: GeoRasterLayer | null = null;

    async function loadRaster() {
      try {
        const response = await fetch(tifUrl);
        const arrayBuf = await response.arrayBuffer();
        const raster = await georaster(arrayBuf);

        // Create a new pane for the TIFF so we can set a higher zIndex
        map.createPane("geotiffPane");
        // map.getPane("geotiffPane")!.style.zIndex = "200"; 
        // polygons use default "overlayPane" which has zIndex 400 by default
        // OSM tile layer is typically zIndex 200

        layer = new GeoRasterLayer({
          georaster: raster,
          opacity: 1,
          resolution: 8192,
        });
        layer.addTo(map);

        // Fit map to the TIF's bounding box
        map.fitBounds(layer.getBounds());

        // If we want to disable panning/zooming, do so
        if (disablePanZoom) {
          map.dragging.disable();
          map.touchZoom.disable();
          map.doubleClickZoom.disable();
          map.scrollWheelZoom.disable();
          map.boxZoom.disable();
          map.keyboard.disable();
          const zoomControl = map.zoomControl;
          if (zoomControl) map.removeControl(zoomControl);
        }
      } catch (err) {
        console.error("Error loading GeoTIFF:", err);
      }
    }

    loadRaster();

    return () => {
      // On unmount, remove the layer if still there
      if (layer) map.removeLayer(layer);
    };
  }, [tifUrl, map, disablePanZoom]);

  return null;
}

export default function MapLeaflet({
  tifUrl,
  polygons,
  disablePanZoom,
  onPolygonCreated,
  onPolygonClicked,
}: MapLeafletProps) {
  const handleCreated = (e: any) => {
    const geojson = e.layer.toGeoJSON();
    if (onPolygonCreated) onPolygonCreated(geojson);
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MapContainer style={{ width: "100%", height: "100%" }} maxZoom={24}>
        {/* OSM behind the substation */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution=""
        />

        {/* The TIF overlay in its own pane so it's "above" the tile layer but below polygons */}
        <GeoTiffOverlay tifUrl={tifUrl} disablePanZoom={disablePanZoom} />

        {/* Render existing polygons in the default overlayPane, which is above geotiffPane */}
        {polygons.map((poly) => {
          const latlngs = geoJsonToLatLngs(poly.geometry);
          const color = poly.confirmed ? "blue" : "yellow";
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

        {/* FeatureGroup with the drawing controls */}
        <FeatureGroup>
          <EditControl
            position="topleft"
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
