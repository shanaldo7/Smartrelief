
"use client"

import { useEffect, useState, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet"

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
  onTaskSelect?: (taskId: string | null) => void;
  selectedTaskId?: string | null;
}

// Inline SVGs for consistent icon rendering in dynamic chunks
const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

function ChangeView({ center, zoom, routeBounds }: { center: [number, number], zoom: number, routeBounds?: any }) {
  const map = useMap();
  useEffect(() => {
    if (routeBounds) {
      map.fitBounds(routeBounds, { padding: [100, 100], animate: true });
    } else if (
      map && 
      Array.isArray(center) && 
      center.length === 2 && 
      typeof center[0] === 'number' && 
      typeof center[1] === 'number' &&
      !isNaN(center[0]) && 
      !isNaN(center[1])
    ) {
      // Small optimization: only set view if it's actually different to avoid leaflet event loops
      const currentCenter = map.getCenter();
      const dist = Math.sqrt(Math.pow(currentCenter.lat - center[0], 2) + Math.pow(currentCenter.lng - center[1], 2));
      if (dist > 0.0001 || map.getZoom() !== zoom) {
        map.setView(center, zoom);
      }
    }
  }, [center, zoom, map, routeBounds]);
  return null;
}

export default function InteractiveMap({ 
  tasks, 
  volunteers, 
  center = [20.5937, 78.9629], 
  zoom = 5, 
  userLocation,
  onTaskSelect,
  selectedTaskId 
}: MapProps) {
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
          html: `<div style="background-color: ${color}; width: ${isUser ? '20px' : '16px'}; height: ${isUser ? '20px' : '16px'}; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.4); position: relative;">
            ${isUser ? '<div style="position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px; border: 2.5px solid ' + color + '; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
          </div>`,
          iconSize: [isUser ? 20 : 16, isUser ? 20 : 16],
          iconAnchor: [isUser ? 10 : 8, isUser ? 10 : 8],
        });
      };

      setIcons({
        high: createIcon(urgencyColors.high),
        medium: createIcon(urgencyColors.medium),
        low: createIcon(urgencyColors.low),
        volunteer: createIcon("#3b82f6"), // Blue for Rescuers
        user: createIcon("#a855f7", true), // Purple for Current Responder
      });
      setIsMounted(true);
    };

    initLeaflet();
  }, []);

  const selectedTask = useMemo(() => {
    if (!tasks || !selectedTaskId) return null;
    return tasks.find(t => t.id === selectedTaskId);
  }, [tasks, selectedTaskId]);

  const routeBounds = useMemo(() => {
    if (!L || !userLocation || !selectedTask || !selectedTask.latitude) return null;
    return L.latLngBounds([
      userLocation,
      [selectedTask.latitude, selectedTask.longitude]
    ]);
  }, [L, userLocation, selectedTask]);

  if (!isMounted || !L || Object.keys(icons).length === 0) {
    return (
      <div className="h-full w-full bg-muted animate-pulse rounded-xl flex items-center justify-center text-muted-foreground min-h-[450px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin border-4 border-primary border-t-transparent rounded-full" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">Engaging Tactical Satellites...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="map-container" className="h-[450px] w-full relative overflow-hidden rounded-xl bg-muted border shadow-inner">
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
        <ChangeView center={center} zoom={zoom} routeBounds={routeBounds} />
        
        {/* Tactical Route Visualization */}
        {userLocation && selectedTask && selectedTask.latitude && selectedTask.longitude && (
          <>
            <Polyline 
              positions={[userLocation, [selectedTask.latitude, selectedTask.longitude]]}
              color="#a855f7"
              weight={10}
              opacity={0.15}
            />
            <Polyline 
              positions={[userLocation, [selectedTask.latitude, selectedTask.longitude]]}
              color="#a855f7"
              dashArray="10, 15"
              weight={4}
              opacity={0.8}
            />
          </>
        )}

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={icons.user}>
            <Popup>
              <div className="p-2 text-center min-w-[140px]">
                <div className="flex items-center justify-center gap-2 mb-1">
                   <UserIcon />
                   <p className="font-bold text-sm text-purple-600">Active Responder</p>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Your Current Sector</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* NGO Task Markers */}
        {tasks.map((task) => (
          task.latitude && task.longitude && (
            <Marker 
              key={task.id} 
              position={[task.latitude, task.longitude]} 
              icon={icons[task.urgency as keyof typeof icons] || icons.low}
              eventHandlers={{
                click: () => {
                  if (onTaskSelect) onTaskSelect(task.id);
                },
              }}
            >
              <Popup>
                <div className="space-y-2 min-w-[200px] p-1">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-sm leading-tight text-foreground pr-2">{task.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] text-white font-extrabold uppercase ${
                      task.urgency === 'high' ? 'bg-red-500' : task.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                      {task.urgency}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                     <MapPinIcon /> {task.location}
                  </div>
                  
                  {userLocation ? (
                    <div className="pt-2 border-t mt-2 flex flex-col gap-2">
                       <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                         <p className="text-[9px] font-bold text-primary uppercase">Route Active</p>
                         <p className="text-[10px] text-muted-foreground">Follow tactical path to NGO site.</p>
                       </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t mt-2">
                       <p className="text-[10px] text-amber-600 font-bold uppercase italic">Detect location to render path</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        ))}

        {/* Volunteer / Rescuer Markers */}
        {volunteers.map((vol) => (
          vol.latitude && vol.longitude && (
            <Marker 
              key={vol.id} 
              position={[vol.latitude, vol.longitude]} 
              icon={icons.volunteer}
            >
              <Popup>
                <div className="space-y-2 min-w-[150px] p-1">
                  <div className="flex flex-col">
                    <p className="font-bold text-sm leading-tight text-foreground">{vol.name}</p>
                    <p className="text-[10px] text-blue-500 font-extrabold uppercase">Certified Rescuer</p>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium">
                    Base City: {vol.location}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {vol.skills?.slice(0, 3).map((s: string) => (
                      <span key={s} className="text-[8px] bg-muted px-1.5 py-0.5 rounded-md uppercase font-bold text-muted-foreground border border-muted-foreground/10">{s}</span>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(3);
            opacity: 0;
          }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .leaflet-popup-tip {
          background: white;
        }
        .custom-div-icon {
          background: none !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
