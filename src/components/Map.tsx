"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"

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
  userLocation?: [number, number] | null;
}

// Inline SVG icons to avoid ReferenceErrors in dynamic bundles
const MapPinIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="12" 
    height="12" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="lucide lucide-map-pin"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

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

export default function InteractiveMap({ tasks, volunteers, center = [20.5937, 78.9629], zoom = 5, userLocation }: MapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [icons, setIcons] = useState<Record<string, any>>({});
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    const initLeaflet = async () => {
      const Leaflet = await import('leaflet');
      setL(Leaflet.default);

      const createIcon = (color: string, isUser = false) => {
        return new Leaflet.DivIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: ${color}; width: ${isUser ? '18px' : '14px'}; height: ${isUser ? '18px' : '14px'}; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5); position: relative;">
            ${isUser ? '<div style="position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px; border: 2px solid ' + color + '; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
          </div>`,
          iconSize: [isUser ? 18 : 14, isUser ? 18 : 14],
          iconAnchor: [isUser ? 9 : 7, isUser ? 9 : 7],
        });
      };

      setIcons({
        high: createIcon(urgencyColors.high),
        medium: createIcon(urgencyColors.medium),
        low: createIcon(urgencyColors.low),
        volunteer: createIcon("#3b82f6"),
        user: createIcon("#8b5cf6", true), // Purple for user
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
          <span className="text-xs font-bold uppercase tracking-widest">Calibrating Satellites...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="map-container" className="h-[450px] w-full relative overflow-hidden rounded-xl bg-muted border">
      <MapContainer 
        id="map"
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={true} 
        className="h-full w-full"
        style={{ height: "450px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={center} zoom={zoom} />
        
        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={icons.user}>
            <Popup>
              <div className="p-1 text-center">
                <p className="font-bold text-sm text-primary">Your Location</p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Active Monitoring Area</p>
              </div>
            </Popup>
          </Marker>
        )}

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
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                     <MapPinIcon /> {task.location}
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Urgency</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] text-white font-bold uppercase ${
                        task.urgency === 'high' ? 'bg-red-500' : task.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}>
                        {task.urgency}
                      </span>
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
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
