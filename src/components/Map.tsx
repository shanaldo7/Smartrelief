
"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet"
import { Button } from "@/components/ui/button"
import { Zap, Map as MapIcon, XCircle, User as UserIconLucide, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

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
  renderTags?: (task: any) => React.ReactNode;
}

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

/**
 * Custom Heatmap Layer using leaflet.heat
 */
function HeatmapLayer({ tasks, active, L }: { tasks: any[], active: boolean, L: any }) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !L || !L.heatLayer) return;

    if (active && tasks.length > 0) {
      const points = tasks
        .filter(t => t.latitude && t.longitude && t.status !== 'completed')
        .map(t => [
          t.latitude, 
          t.longitude, 
          t.urgency === 'high' ? 1.0 : t.urgency === 'medium' ? 0.6 : 0.3
        ]);
      
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }

      heatLayerRef.current = L.heatLayer(points, {
        radius: 35,
        blur: 20,
        maxZoom: 10,
        gradient: { 0.4: '#3b82f6', 0.65: '#10b981', 1: '#ef4444' }
      }).addTo(map);
    } else {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, tasks, active, L]);

  return null;
}

function ChangeView({ center, zoom, routeBounds }: { center: [number, number], zoom: number, routeBounds?: any }) {
  const map = useMap();
  const lastCenter = useRef<[number, number] | null>(null);
  const lastZoom = useRef<number | null>(null);
  const lastRouteBounds = useRef<any>(null);

  useEffect(() => {
    if (routeBounds) {
      if (lastRouteBounds.current && lastRouteBounds.current.equals(routeBounds)) return;
      lastRouteBounds.current = routeBounds;
      
      const currentBounds = map.getBounds();
      if (!currentBounds.equals(routeBounds)) {
        map.fitBounds(routeBounds, { padding: [80, 80], animate: true });
      }
    } else if (
      map && 
      Array.isArray(center) && 
      center.length === 2 && 
      typeof center[0] === 'number' && 
      typeof center[1] === 'number' &&
      !isNaN(center[0]) && 
      !isNaN(center[1])
    ) {
      if (lastCenter.current && 
          Math.abs(lastCenter.current[0] - center[0]) < 0.0001 && 
          Math.abs(lastCenter.current[1] - center[1]) < 0.0001 &&
          lastZoom.current === zoom) {
        return;
      }
      
      lastCenter.current = center;
      lastZoom.current = zoom;
      
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
  selectedTaskId,
  renderTags
}: MapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [icons, setIcons] = useState<Record<string, any>>({});
  const [L, setL] = useState<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    const initLeaflet = async () => {
      const Leaflet = await import('leaflet');
      // @ts-ignore
      await import('leaflet.heat');
      setL(Leaflet.default);

      const createIcon = (color: string, isUser = false) => {
        return new Leaflet.DivIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: ${color}; width: ${isUser ? '22px' : '18px'}; height: ${isUser ? '22px' : '18px'}; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.3); position: relative;">
            ${isUser ? '<div style="position: absolute; top: -5px; left: -5px; right: -5px; bottom: -5px; border: 3px solid ' + color + '; border-radius: 50%; animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
          </div>`,
          iconSize: [isUser ? 22 : 18, isUser ? 22 : 18],
          iconAnchor: [isUser ? 11 : 9, isUser ? 11 : 9],
        });
      };

      setIcons({
        high: createIcon(urgencyColors.high),
        medium: createIcon(urgencyColors.medium),
        low: createIcon(urgencyColors.low),
        volunteer: createIcon("#3b82f6"), 
        user: createIcon("#a855f7", true), 
      });
      setIsMounted(true);
    };

    initLeaflet();
  }, []);

  const selectedTask = useMemo(() => {
    if (!tasks || !selectedTaskId) return null;
    return tasks.find(t => t.id === selectedTaskId) || null;
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
      <div className="h-full w-full bg-muted animate-pulse rounded-3xl flex items-center justify-center text-muted-foreground min-h-[450px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin border-4 border-primary border-t-transparent rounded-full shadow-2xl" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Engaging Orbital Sensors...</span>
        </div>
      </div>
    );
  }

  return (
    <div id="map-container" className="h-[450px] w-full relative overflow-hidden rounded-3xl bg-muted border shadow-2xl">
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
        
        <HeatmapLayer tasks={tasks} active={showHeatmap} L={L} />

        {userLocation && selectedTask && selectedTask.latitude && selectedTask.longitude && (
          <>
            <Polyline 
              positions={[userLocation, [selectedTask.latitude, selectedTask.longitude]]}
              color="#a855f7"
              weight={12}
              opacity={0.1}
            />
            <Polyline 
              positions={[userLocation, [selectedTask.latitude, selectedTask.longitude]]}
              color="#a855f7"
              weight={5}
              opacity={0.9}
              dashArray="1, 10"
            />
          </>
        )}

        {userLocation && (
          <Marker position={userLocation} icon={icons.user}>
            <Popup className="tactical-popup">
              <div className="p-3 text-center min-w-[160px]">
                <div className="flex items-center justify-center gap-2 mb-2">
                   <UserIcon />
                   <p className="font-black text-xs text-purple-600 uppercase">Active Unit</p>
                </div>
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Sector Locked</p>
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
              eventHandlers={{
                click: () => {
                  if (onTaskSelect) onTaskSelect(task.id);
                },
              }}
            >
              <Popup className="tactical-popup">
                <div className="space-y-3 min-w-[220px] p-2">
                  <div className="flex justify-between items-start">
                    <p className="font-black text-sm leading-tight text-foreground pr-3 uppercase">{task.title}</p>
                    <span className={`px-2 py-0.5 rounded-md text-[8px] text-white font-black uppercase shadow-lg ${
                      task.urgency === 'high' ? 'bg-red-500' : task.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}>
                      {task.urgency}
                    </span>
                  </div>
                  {renderTags && renderTags(task)}
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-bold uppercase">
                     <MapPinIcon /> {task.location}
                  </div>
                  
                  {task.assignedTo && (
                    <div className="p-2 bg-accent/10 border-2 border-accent/20 rounded-xl">
                      <p className="text-[8px] font-black text-accent uppercase">Managing NGO: {task.submittedBy}</p>
                      <p className="text-[9px] font-bold text-foreground uppercase mt-1">Responder: {task.assignedTo}</p>
                    </div>
                  )}

                  <div className="pt-2 border-t mt-3 flex flex-col gap-2">
                     <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                       <p className="text-[9px] font-black text-primary uppercase">Tactical Status</p>
                       <p className="text-[10px] text-muted-foreground italic">{task.status === 'open' ? 'Ready for deployment.' : 'Mission in progress.'}</p>
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
              <Popup className="tactical-popup">
                <div className="space-y-3 min-w-[180px] p-2">
                  <div className="flex flex-col">
                    <p className="font-black text-sm leading-tight text-foreground uppercase">{vol.name}</p>
                    <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mt-1">Verified Responder</p>
                  </div>
                  {vol.currentAssignment ? (
                    <div className="p-2 bg-blue-500/5 border-2 border-blue-500/20 rounded-xl">
                      <p className="text-[8px] font-black text-blue-600 uppercase">Assigned to: {vol.currentAssignment.ngoName}</p>
                      <p className="text-[9px] font-bold uppercase mt-1">Role: {vol.currentAssignment.role}</p>
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground font-bold uppercase">
                      Base: {vol.location}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vol.skills?.slice(0, 3).map((s: string) => (
                      <span key={s} className="text-[8px] bg-muted px-2 py-0.5 rounded-md uppercase font-black text-muted-foreground border">{s}</span>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>

      {/* Floating Tactical Controls */}
      <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-2">
        <Button 
          size="sm" 
          variant={showHeatmap ? "default" : "secondary"} 
          className={cn(
            "rounded-full shadow-2xl font-black uppercase text-[9px] px-6 h-10 border-2 border-white/50 backdrop-blur-md transition-all",
            showHeatmap ? "bg-primary text-white" : "bg-white/80 text-foreground hover:bg-white"
          )}
          onClick={() => setShowHeatmap(!showHeatmap)}
        >
          <Zap className={cn("h-4 w-4 mr-2", showHeatmap && "animate-pulse")} /> 
          {showHeatmap ? "Deactivate Heatmap" : "Activate Heatmap"}
        </Button>
      </div>

      <style jsx global>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 20px;
          padding: 8px;
          box-shadow: 0 15px 45px rgba(0,0,0,0.15);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .leaflet-popup-tip {
          background: white;
        }
        .custom-div-icon {
          background: none !important;
          border: none !important;
        }
        .tactical-popup .leaflet-popup-content {
          margin: 12px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
