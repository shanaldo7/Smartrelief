"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import { MapPin } from "lucide-react"

const urgencyColors = {
  high: "#ef4444",   // Red
  medium: "#f59e0b", // Orange/Amber
  low: "#10b981",    // Green
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
    if (
      map && 
      Array.isArray(center) && 
      center.length === 2 && 
      typeof center[0] === 'number' && 
      typeof center[1] === 'number' &&
      !isNaN(center[0]) && 
      !isNaN(center[1])
    ) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

export default function InteractiveMap({ tasks, volunteers, center = [20.5937, 78.9629], zoom = 5 }: MapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [icons, setIcons] = useState<Record<string, any>>({});
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    // Dynamic import inside useEffect to ensure it only runs on the client
    const initLeaflet = async () => {
      const Leaflet = await import('leaflet');
      setL(Leaflet.default);

      const createIcon = (color: string) => {
        return new Leaflet.DivIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
      };

      setIcons({
        high: createIcon(urgencyColors.high),
        medium: createIcon(urgencyColors.medium),
        low: createIcon(urgencyColors.low),
        volunteer: createIcon("#3b82f6"),
      });
      setIsMounted(true);
    };

    initLeaflet();
  }, []);

  if (!isMounted || !L || Object.keys(icons).length === 0) {
    return (
      <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center text-muted-foreground min-h-[450px]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full" />
          <span className="text-xs font-bold uppercase tracking-widest">Initializing Radar...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-h-[450px] relative overflow-hidden rounded-xl">
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
              icon={icons[task.urgency as keyof typeof icons] || icons.low}
            >
              <Popup>
                <div className="space-y-1 min-w-[150px] p-1">
                  <p className="font-bold text-sm leading-tight text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                     <MapPin className="h-3 w-3" /> {task.location}
                  </p>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Urgency</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] text-white font-bold uppercase ${
                        task.urgency === 'high' ? 'bg-red-500' : task.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}>
                        {task.urgency}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Status</span>
                      <span className="text-[10px] font-bold text-primary uppercase">{task.status}</span>
                    </div>
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
              icon={icons.volunteer}
            >
              <Popup>
                <div className="space-y-1 min-w-[120px] p-1">
                  <p className="font-bold text-sm leading-tight text-foreground">{vol.name}</p>
                  <p className="text-xs text-muted-foreground">{vol.location}</p>
                  <div className="mt-2">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold mb-1">Expertise</p>
                    <div className="flex flex-wrap gap-1">
                      {vol.skills?.slice(0, 3).map((s: string) => (
                        <span key={s} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}
