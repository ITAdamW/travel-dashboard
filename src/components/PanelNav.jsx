import { Compass, Map as MapIcon, NotebookPen, Route as RouteIcon } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const panelMeta = [
  { id: "atlas", label: "Panel 1", name: "Atlas", icon: MapIcon },
  { id: "story", label: "Panel 2", name: "Destination", icon: Compass },
  { id: "planner", label: "Panel 3", name: "Planner", icon: NotebookPen },
  { id: "route", label: "Panel 4", name: "Route", icon: RouteIcon },
];

export default function PanelNav({ activePanel, onChange }) {
  return (
    <div className="mb-4 rounded-[1.15rem] border border-[#E7DED2] bg-[linear-gradient(180deg,#FCFAF6_0%,#F6F0E5_100%)] p-1.5 shadow-[0_6px_18px_rgba(34,31,25,0.035)]">
      <div className="grid grid-cols-4 gap-1.5">
        {panelMeta.map((panel) => {
          const Icon = panel.icon;

          return (
            <button
              key={panel.id}
              onClick={() => onChange(panel.id)}
              className={cn(
                "rounded-[0.95rem] border px-3 py-2 text-left transition-all",
                activePanel === panel.id
                  ? "border-[#D7CCBC] bg-white shadow-[0_5px_14px_rgba(34,31,25,0.045)]"
                  : "border-transparent bg-transparent hover:border-[#E8DFD2] hover:bg-white/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border",
                    activePanel === panel.id
                      ? "border-[#DDD1C0] bg-[#F8F4ED] text-[#6B7A52]"
                      : "border-[#E9E1D4] bg-white/70 text-[#8D826F]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#8D826F]">
                    {panel.label}
                  </p>
                  <p className="text-[14px] font-medium text-[#1F1D1A]">
                    {panel.name}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
