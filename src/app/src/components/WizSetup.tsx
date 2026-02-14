import { useState, useEffect, useCallback } from "react";
import { ipcRenderer } from "@/utils/electron";
import { X, Minus, Wifi, Plus, Trash2, Save, Lightbulb, FolderPlus, Pencil, Check, Power } from "lucide-react";
import { ActionButton } from "./atoms/ActionButton.atom";

interface WizDeviceInfo {
  ip: string;
  roomId?: number;
  moduleName?: string;
}

interface WizGroup {
  name: string;
  deviceIps: string[];
}

export function WizSetup() {
  const [devices, setDevices] = useState<WizDeviceInfo[]>([]);
  const [groups, setGroups] = useState<WizGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [saved, setSaved] = useState(false);
  const [deviceStates, setDeviceStates] = useState<Record<string, boolean>>({});

  const fetchDeviceStates = useCallback((devs: WizDeviceInfo[]) => {
    if (devs.length > 0) {
      ipcRenderer.send("wiz-setup-get-states", devs.map((d) => d.ip));
    }
  }, []);

  useEffect(() => {
    const handleInit = (
      _: unknown,
      data: { devices: WizDeviceInfo[]; groups: WizGroup[] }
    ) => {
      setDevices(data.devices);
      setGroups(data.groups);
      if (data.groups.length > 0) setSelectedGroup(0);
      fetchDeviceStates(data.devices);
    };

    const handleScanResult = (_: unknown, result: WizDeviceInfo[]) => {
      setDevices(result);
      setScanning(false);
      fetchDeviceStates(result);
    };

    const handleGroupsSaved = (_: unknown, savedGroups: WizGroup[]) => {
      setGroups(savedGroups);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    };

    const handleDeviceStates = (_: unknown, states: Record<string, boolean>) => {
      setDeviceStates((prev) => ({ ...prev, ...states }));
    };

    ipcRenderer.on("wiz-setup-init", handleInit);
    ipcRenderer.on("wiz-setup-scan-result", handleScanResult);
    ipcRenderer.on("wiz-setup-groups-saved", handleGroupsSaved);
    ipcRenderer.on("wiz-setup-data", handleInit);
    ipcRenderer.on("wiz-setup-device-states", handleDeviceStates);

    ipcRenderer.send("wiz-setup-mounted");

    return () => {
      ipcRenderer.removeListener("wiz-setup-init", handleInit);
      ipcRenderer.removeListener("wiz-setup-scan-result", handleScanResult);
      ipcRenderer.removeListener("wiz-setup-groups-saved", handleGroupsSaved);
      ipcRenderer.removeListener("wiz-setup-data", handleInit);
      ipcRenderer.removeListener("wiz-setup-device-states", handleDeviceStates);
    };
  }, [fetchDeviceStates]);

  const handleScan = useCallback(() => {
    setScanning(true);
    ipcRenderer.send("wiz-setup-scan");
  }, []);

  const handleSave = useCallback(() => {
    ipcRenderer.send("wiz-setup-save-groups", groups);
  }, [groups]);

  const handleAddGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) return;
    const updated = [...groups, { name, deviceIps: [] }];
    setGroups(updated);
    setSelectedGroup(updated.length - 1);
    setNewGroupName("");
  }, [newGroupName, groups]);

  const handleDeleteGroup = useCallback(
    (index: number) => {
      const updated = groups.filter((_, i) => i !== index);
      setGroups(updated);
      if (selectedGroup === index) {
        setSelectedGroup(updated.length > 0 ? 0 : null);
      } else if (selectedGroup !== null && selectedGroup > index) {
        setSelectedGroup(selectedGroup - 1);
      }
    },
    [groups, selectedGroup]
  );

  const handleRenameGroup = useCallback(
    (index: number) => {
      const name = editGroupName.trim();
      if (!name) return;
      if (groups.some((g, i) => i !== index && g.name.toLowerCase() === name.toLowerCase())) return;
      const updated = [...groups];
      updated[index] = { ...updated[index], name };
      setGroups(updated);
      setEditingGroup(null);
      setEditGroupName("");
    },
    [editGroupName, groups]
  );

  const toggleDevice = useCallback(
    (deviceIp: string) => {
      if (selectedGroup === null) return;
      const updated = [...groups];
      const group = { ...updated[selectedGroup] };
      if (group.deviceIps.includes(deviceIp)) {
        group.deviceIps = group.deviceIps.filter((ip) => ip !== deviceIp);
      } else {
        group.deviceIps = [...group.deviceIps, deviceIp];
      }
      updated[selectedGroup] = group;
      setGroups(updated);
    },
    [selectedGroup, groups]
  );

  const handleToggleLight = useCallback((ip: string) => {
    const current = deviceStates[ip] ?? false;
    const next = !current;
    setDeviceStates((prev) => ({ ...prev, [ip]: next }));
    ipcRenderer.send("wiz-setup-toggle-device", { ip, state: next });
  }, [deviceStates]);

  const activeGroup = selectedGroup !== null ? groups[selectedGroup] : null;

  return (
    <div className="w-full h-full flex flex-col bg-grimoire-bg text-grimoire-text font-serif-grimoire pointer-events-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-grimoire-border bg-linear-to-b from-grimoire-bg-secondary/80 to-grimoire-bg/60 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2 app-drag-region shrink-0 flex-1">
          <Lightbulb className="w-5 h-5 text-grimoire-gold" />
          <span className="text-grimoire-gold font-fantasy text-lg font-semibold tracking-wide">
            Wiz Light Setup
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => ipcRenderer.send("wiz-setup-minimize")}
            className="p-1.5 rounded bg-black/20 border border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border transition-all"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => ipcRenderer.send("wiz-setup-close")}
            className="p-1.5 rounded bg-black/20 border border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-red hover:border-grimoire-red hover:bg-grimoire-red/10 transition-all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left - Groups sidebar */}
        <div className="w-56 shrink-0 border-r border-grimoire-border bg-grimoire-bg-secondary/40 flex flex-col">
          <div className="px-3 py-3 border-b border-grimoire-border/50">
            <p className="text-xs text-grimoire-text-dim font-fantasy uppercase tracking-wider mb-2">
              Groups
            </p>
            <div className="flex gap-1">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                placeholder="New group..."
                className="flex-1 px-2 py-1.5 bg-black/30 border border-grimoire-border rounded text-grimoire-text text-xs placeholder:text-grimoire-text-dim focus:outline-none focus:border-grimoire-gold-dim transition-all"
              />
              <button
                onClick={handleAddGroup}
                disabled={!newGroupName.trim()}
                className="p-1.5 rounded bg-grimoire-gold/20 border border-grimoire-gold/50 text-grimoire-gold hover:bg-grimoire-gold/30 transition-all disabled:opacity-30"
              >
                <FolderPlus size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {groups.map((group, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 px-3 py-2 cursor-pointer border-b border-grimoire-border/20 transition-all ${
                  selectedGroup === i
                    ? "bg-grimoire-gold/10 text-grimoire-gold"
                    : "text-grimoire-text-dim hover:text-grimoire-text hover:bg-white/5"
                }`}
                onClick={() => setSelectedGroup(i)}
              >
                {editingGroup === i ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameGroup(i);
                        if (e.key === "Escape") setEditingGroup(null);
                      }}
                      className="flex-1 min-w-0 px-1 py-0.5 bg-black/30 border border-grimoire-gold-dim rounded text-grimoire-text text-xs focus:outline-none"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameGroup(i);
                      }}
                      className="p-0.5 text-grimoire-green hover:text-grimoire-green/80"
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-fantasy truncate">
                      {group.name}
                    </span>
                    <span className="text-xs opacity-50">
                      {group.deviceIps.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroup(i);
                        setEditGroupName(group.name);
                      }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-grimoire-gold transition-all"
                      style={{ opacity: selectedGroup === i ? 1 : undefined }}
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(i);
                      }}
                      className="p-0.5 hover:text-grimoire-red transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {groups.length === 0 && (
              <p className="px-3 py-4 text-xs text-grimoire-text-dim text-center">
                No groups yet. Create one above.
              </p>
            )}
          </div>

          <div className="p-3 border-t border-grimoire-border/50 space-y-2">
            <ActionButton
              variant="primary"
              onClick={handleSave}
              icon={saved ? <Check size={14} /> : <Save size={14} />}
              className="w-full text-xs"
            >
              {saved ? "Saved!" : "Save Groups"}
            </ActionButton>
          </div>
        </div>

        {/* Right - Devices panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Scan bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-grimoire-border/50 bg-grimoire-bg-secondary/20">
            <ActionButton
              variant="accent"
              onClick={handleScan}
              isLoading={scanning}
              icon={<Wifi size={14} />}
              className="text-xs"
            >
              {scanning ? "Scanning..." : "Scan Network"}
            </ActionButton>
            <span className="text-xs text-grimoire-text-dim">
              {devices.length} device(s) found
            </span>
            {!activeGroup && groups.length > 0 && (
              <span className="text-xs text-grimoire-gold-dim ml-auto">
                Select a group to assign devices
              </span>
            )}
            {activeGroup && (
              <span className="text-xs text-grimoire-gold ml-auto font-fantasy">
                Editing: {activeGroup.name}
              </span>
            )}
          </div>

          {/* Devices list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-grimoire-text-dim">
                <Lightbulb size={40} className="opacity-30" />
                <p className="text-sm">No devices found yet.</p>
                <p className="text-xs">Click "Scan Network" to discover Wiz bulbs on your LAN.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {devices.map((device) => {
                  const isInGroup = activeGroup?.deviceIps.includes(device.ip) ?? false;
                  const memberOfGroups = groups
                    .filter((g) => g.deviceIps.includes(device.ip))
                    .map((g) => g.name);

                  const isOn = deviceStates[device.ip] ?? false;

                  return (
                    <div
                      key={device.ip}
                      className={`flex items-start gap-3 p-3 rounded border transition-all text-left ${
                        isInGroup
                          ? "bg-grimoire-gold/10 border-grimoire-gold/50 shadow-[0_0_8px_rgba(201,162,39,0.15)]"
                          : "bg-black/20 border-grimoire-border/50 hover:border-grimoire-border"
                      }`}
                    >
                      {/* Group checkbox area - clickable */}
                      <button
                        onClick={() => toggleDevice(device.ip)}
                        disabled={!activeGroup}
                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          isInGroup
                            ? "border-grimoire-gold bg-grimoire-gold/30"
                            : "border-grimoire-border"
                        } ${!activeGroup ? "opacity-40 cursor-default" : "cursor-pointer"}`}
                      >
                        {isInGroup && <Check size={10} className="text-grimoire-gold" />}
                      </button>
                      <div
                        className={`flex-1 min-w-0 ${activeGroup ? "cursor-pointer" : ""}`}
                        onClick={() => activeGroup && toggleDevice(device.ip)}
                      >
                        <p className="text-sm font-grimoire text-grimoire-text">
                          {device.ip}
                        </p>
                        <p className="text-xs text-grimoire-text-dim truncate">
                          {device.moduleName || "Unknown module"}
                          {device.roomId !== undefined && ` (Room ${device.roomId})`}
                        </p>
                        {memberOfGroups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {memberOfGroups.map((name) => (
                              <span
                                key={name}
                                className="px-1.5 py-0.5 text-[10px] rounded bg-grimoire-accent/20 text-grimoire-accent-bright border border-grimoire-accent/30"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Toggle light on/off */}
                      <button
                        onClick={() => handleToggleLight(device.ip)}
                        className={`shrink-0 p-1.5 rounded-full border transition-all ${
                          isOn
                            ? "bg-grimoire-gold/30 border-grimoire-gold text-grimoire-gold-bright shadow-[0_0_10px_rgba(201,162,39,0.3)]"
                            : "bg-black/30 border-grimoire-border/50 text-grimoire-text-dim hover:text-grimoire-text hover:border-grimoire-border"
                        }`}
                        title={isOn ? "Turn off" : "Turn on"}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
