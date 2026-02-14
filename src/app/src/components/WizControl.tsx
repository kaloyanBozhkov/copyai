import { useState, useEffect, useCallback } from "react";
import { ipcRenderer } from "@/utils/electron";
import { X, Minus, Lightbulb, Power } from "lucide-react";

interface WizDeviceInfo {
  ip: string;
  roomId?: number;
  moduleName?: string;
}

interface WizGroup {
  name: string;
  deviceIps: string[];
}

export function WizControl() {
  const [devices, setDevices] = useState<WizDeviceInfo[]>([]);
  const [groups, setGroups] = useState<WizGroup[]>([]);
  const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});

  const fetchStates = useCallback((devs: WizDeviceInfo[]) => {
    if (devs.length > 0) {
      ipcRenderer.send("wiz-control-get-states", devs.map((d) => d.ip));
    }
  }, []);

  useEffect(() => {
    const handleInit = (
      _: unknown,
      data: { devices: WizDeviceInfo[]; groups: WizGroup[] }
    ) => {
      setDevices(data.devices);
      setGroups(data.groups);
      fetchStates(data.devices);
    };

    const handleStates = (_: unknown, states: Record<string, boolean>) => {
      setDeviceStates((prev) => ({ ...prev, ...states }));
    };

    ipcRenderer.on("wiz-control-init", handleInit);
    ipcRenderer.on("wiz-control-device-states", handleStates);
    ipcRenderer.send("wiz-control-mounted");

    return () => {
      ipcRenderer.removeListener("wiz-control-init", handleInit);
      ipcRenderer.removeListener("wiz-control-device-states", handleStates);
    };
  }, [fetchStates]);

  const handleToggle = useCallback(
    (ip: string) => {
      const next = !(deviceStates[ip] ?? false);
      setDeviceStates((prev) => ({ ...prev, [ip]: next }));
      ipcRenderer.send("wiz-control-toggle", { ip, state: next });
    },
    [deviceStates]
  );

  const handleToggleGroup = useCallback(
    (group: WizGroup) => {
      // If any device in the group is on, turn all off. Otherwise turn all on.
      const anyOn = group.deviceIps.some((ip) => deviceStates[ip]);
      const nextState = !anyOn;
      const updates: Record<string, boolean> = {};
      for (const ip of group.deviceIps) {
        updates[ip] = nextState;
      }
      setDeviceStates((prev) => ({ ...prev, ...updates }));
      ipcRenderer.send("wiz-control-toggle-group", {
        ips: group.deviceIps,
        state: nextState,
      });
    },
    [deviceStates]
  );

  const getDeviceInfo = (ip: string) =>
    devices.find((d) => d.ip === ip);

  const allDeviceIps = new Set(groups.flatMap((g) => g.deviceIps));
  const ungrouped = devices.filter((d) => !allDeviceIps.has(d.ip));

  return (
    <div className="w-full h-full flex flex-col bg-grimoire-bg text-grimoire-text font-serif-grimoire pointer-events-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-grimoire-border bg-linear-to-b from-grimoire-bg-secondary/80 to-grimoire-bg/60 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2 app-drag-region shrink-0 flex-1">
          <Lightbulb className="w-5 h-5 text-grimoire-gold" />
          <span className="text-grimoire-gold font-fantasy text-lg font-semibold tracking-wide">
            Wiz Lights
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => ipcRenderer.send("wiz-control-minimize")}
            className="p-1.5 rounded bg-black/20 border border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border transition-all"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => ipcRenderer.send("wiz-control-close")}
            className="p-1.5 rounded bg-black/20 border border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-red hover:border-grimoire-red hover:bg-grimoire-red/10 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {groups.length === 0 && ungrouped.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-grimoire-text-dim">
            <Lightbulb size={40} className="opacity-30" />
            <p className="text-sm">No groups configured.</p>
            <p className="text-xs">Use wiz.setup to discover devices and create groups.</p>
          </div>
        )}

        {groups.map((group) => {
          const anyOn = group.deviceIps.some((ip) => deviceStates[ip]);
          return (
            <div key={group.name} className="space-y-2">
              {/* Group header with master toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleGroup(group)}
                  className={`p-2 rounded-full border transition-all ${
                    anyOn
                      ? "bg-grimoire-gold/30 border-grimoire-gold text-grimoire-gold-bright shadow-[0_0_12px_rgba(201,162,39,0.3)]"
                      : "bg-black/30 border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border"
                  }`}
                  title={anyOn ? `Turn off all in ${group.name}` : `Turn on all in ${group.name}`}
                >
                  <Power size={16} />
                </button>
                <span className="font-fantasy text-sm font-semibold text-grimoire-text">
                  {group.name}
                </span>
                <span className="text-xs text-grimoire-text-dim">
                  {group.deviceIps.length} light(s)
                </span>
              </div>

              {/* Devices in group */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-2">
                {group.deviceIps.map((ip) => {
                  const info = getDeviceInfo(ip);
                  const isOn = deviceStates[ip] ?? false;
                  return (
                    <button
                      key={ip}
                      onClick={() => handleToggle(ip)}
                      className={`flex items-center gap-2 p-2.5 rounded border transition-all ${
                        isOn
                          ? "bg-grimoire-gold/10 border-grimoire-gold/50 shadow-[0_0_8px_rgba(201,162,39,0.15)]"
                          : "bg-black/20 border-grimoire-border/50 hover:border-grimoire-border"
                      }`}
                    >
                      <Power
                        size={14}
                        className={`shrink-0 transition-colors ${
                          isOn ? "text-grimoire-gold-bright" : "text-grimoire-text-dim"
                        }`}
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-grimoire text-grimoire-text truncate">
                          {info?.moduleName || ip}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Ungrouped devices */}
        {ungrouped.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-fantasy text-sm font-semibold text-grimoire-text-dim">
                Ungrouped
              </span>
              <span className="text-xs text-grimoire-text-dim">
                {ungrouped.length} light(s)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-2">
              {ungrouped.map((device) => {
                const isOn = deviceStates[device.ip] ?? false;
                return (
                  <button
                    key={device.ip}
                    onClick={() => handleToggle(device.ip)}
                    className={`flex items-center gap-2 p-2.5 rounded border transition-all ${
                      isOn
                        ? "bg-grimoire-gold/10 border-grimoire-gold/50 shadow-[0_0_8px_rgba(201,162,39,0.15)]"
                        : "bg-black/20 border-grimoire-border/50 hover:border-grimoire-border"
                    }`}
                  >
                    <Power
                      size={14}
                      className={`shrink-0 transition-colors ${
                        isOn ? "text-grimoire-gold-bright" : "text-grimoire-text-dim"
                      }`}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-grimoire text-grimoire-text truncate">
                        {device.moduleName || device.ip}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
