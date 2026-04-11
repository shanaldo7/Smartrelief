
"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix for default Leaflet icon not appearing in Next.js
const getIcon = (color: string) => {
  return new L.DivIcon({
    className: "custom-div-icon",
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const urgencyColors = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
};

interface MapProps {
  tasks: any[];
  volunteers: any[];
  center?: [number, number];
  zoom?: number;
}

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function InteractiveMap({ tasks, volunteers, center = [20.5937, 78.9629], zoom = 5 }: MapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-full w-full bg-muted animate-pulse rounded-xl" />;

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ChangeView center={center} zoom={zoom} />
      
      {tasks.map((task) => (
        task.latitude && task.longitude && (
          <Marker 
            key={task.id} 
            position={[task.latitude, task.longitude]} 
            icon={getIcon(urgencyColors[task.urgency as keyof typeof urgencyColors] || urgencyColors.low)}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-bold text-sm leading-tight">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.location}</p>
                <div className="flex gap-2 items-center mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] text-white font-bold uppercase ${
                    task.urgency === 'high' ? 'bg-red-500' : task.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}>
                    {task.urgency}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">{task.status}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      ))}

      {volunteers.map((vol) => (
        vol.latitude && vol.longitude && (
          <Marker 
            key={vol.id} 
            position={[vol.latitude, vol.longitude]} 
            icon={getIcon("#3b82f6")}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-bold text-sm leading-tight">{vol.name}</p>
                <p className="text-xs text-muted-foreground">{vol.location}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vol.skills?.slice(0, 2).map((s: string) => (
                    <span key={s} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{s}</span>
                  ))}
                </div>
              </div>
            </Popup>
          </Marker>
        )
      ))}
    </MapContainer>
  );
}
