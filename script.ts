/**
 * Air_Radar v41 (Standalone)
 * Radar-only script for Battlefield 6 Portal.
 * Drop into any game mode with aircraft to get a working radar HUD.
 *
 * What this does:
 * - Adds a radar on the left side of your screen when you're flying a jet or helicopter.
 * - Shows nearby aircraft as colored dots with heading indicators.
 * - The radar rotates with your aircraft so "up" is always the direction you're flying.
 * - Radar automatically appears when you enter an aircraft and disappears when you leave.
 *
 * Radar colors:
 * - White dot (center)      = You
 * - Red dot                 = Enemy jet
 * - Yellow dot              = Enemy helicopter
 * - Blue dot                = Friendly jet
 * - Cyan/teal dot           = Friendly helicopter
 * - Small dot near each     = Shows which direction that aircraft is heading
 *
 * Radar range:
 * - Grid lines show 200m and 400m distance rings.
 * - Aircraft beyond 600m are not shown.
 * - Only pilots appear on radar (gunners/passengers do not).
 * - Aircraft flying below 35m above terrain are hidden from radar ("below radar").
 * - Friendlies always visible regardless of altitude.
 * - Your own blip dims when you're below radar.
 *
 * Copyright (c) 2026 Pongstroid, Ethan Mills. All rights reserved.
 */

// -----------------------------------------------------------------------------
// RADAR STATE
// -----------------------------------------------------------------------------
let radarOwnerId = 0;
const radarInitializedPlayers: Set<number> = new Set();
const radarVisiblePlayers: Set<number> = new Set();
const playerGroundY: Record<number, number> = {};

// -----------------------------------------------------------------------------
// AIRCRAFT DETECTION
// -----------------------------------------------------------------------------
function checkIsAircraft(vehicle: any): boolean {
    try {
        // Jets
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.F16)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.F22)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.JAS39)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.SU57)) return true;
        // Helicopters
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.AH64)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.Eurocopter)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.UH60)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.UH60_Pax)) return true;
    } catch {}
    return false;
}

function checkIsHeli(vehicle: any): boolean {
    try {
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.AH64)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.Eurocopter)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.UH60)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.UH60_Pax)) return true;
    } catch {}
    return false;
}

// -----------------------------------------------------------------------------
// RADAR CONSTANTS
// -----------------------------------------------------------------------------
const RADAR_OX = -620;
const RADAR_OY = 75;
const RADAR_CX = RADAR_OX;
const RADAR_CY = RADAR_OY;

// -----------------------------------------------------------------------------
// RADAR WIDGET CREATION
// -----------------------------------------------------------------------------
function createRadarForPlayer(player: mod.Player) {
    try {
        const id = mod.GetObjId(player);
        if (radarInitializedPlayers.has(id)) return;
        radarInitializedPlayers.add(id);
        const root = mod.GetUIRoot();
        radarOwnerId = mod.GetObjId(player);
        const s = "" + radarOwnerId;
        // Background
        mod.AddUIContainer("radarBorder" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(225, 225, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.15, 0), 0.65, mod.UIBgFill.Solid, player);
        // Grid: crosshair lines
        mod.AddUIContainer("radarGH" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(225, 1, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.45, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarGV" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(1, 225, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.45, mod.UIBgFill.Solid, player);
        // Grid: 200m range ring
        mod.AddUIContainer("radarR1T" + s, mod.CreateVector(RADAR_OX, RADAR_OY - 37, 0), mod.CreateVector(74, 1, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR1B" + s, mod.CreateVector(RADAR_OX, RADAR_OY + 37, 0), mod.CreateVector(74, 1, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR1L" + s, mod.CreateVector(RADAR_OX - 37, RADAR_OY, 0), mod.CreateVector(1, 74, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR1R" + s, mod.CreateVector(RADAR_OX + 37, RADAR_OY, 0), mod.CreateVector(1, 74, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        // Grid: 400m range ring
        mod.AddUIContainer("radarR2T" + s, mod.CreateVector(RADAR_OX, RADAR_OY - 75, 0), mod.CreateVector(150, 1, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR2B" + s, mod.CreateVector(RADAR_OX, RADAR_OY + 75, 0), mod.CreateVector(150, 1, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR2L" + s, mod.CreateVector(RADAR_OX - 75, RADAR_OY, 0), mod.CreateVector(1, 150, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR2R" + s, mod.CreateVector(RADAR_OX + 75, RADAR_OY, 0), mod.CreateVector(1, 150, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        // Player blip + heading tick (white)
        mod.AddUIContainer("playerBlip" + s, mod.CreateVector(RADAR_CX, RADAR_CY, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 1, 1), 1.0, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("playerHead" + s, mod.CreateVector(RADAR_CX, RADAR_CY - 8, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 1, 1), 1.0, mod.UIBgFill.Solid, player);
        // Enemy jet blips (red)
        for (let i = 0; i < 8; i++) {
            mod.AddUIContainer("enemyBlip" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 0.2, 0.2), 1.0, mod.UIBgFill.Solid, player);
        }
        // Enemy jet heading ticks (orange)
        for (let i = 0; i < 8; i++) {
            mod.AddUIContainer("enemyHead" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 0.6, 0.2), 1.0, mod.UIBgFill.Solid, player);
        }
        // Enemy heli blips (yellow)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("eHeliBlip" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 0.85, 0.2), 1.0, mod.UIBgFill.Solid, player);
        }
        // Enemy heli heading ticks (light yellow)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("eHeliHead" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 1, 0.5), 1.0, mod.UIBgFill.Solid, player);
        }
        // Friendly jet blips (blue)
        for (let i = 0; i < 8; i++) {
            mod.AddUIContainer("friendBlip" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0.2, 0.5, 1.0), 1.0, mod.UIBgFill.Solid, player);
        }
        // Friendly jet heading ticks (light blue)
        for (let i = 0; i < 8; i++) {
            mod.AddUIContainer("friendHead" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0.4, 0.7, 1.0), 1.0, mod.UIBgFill.Solid, player);
        }
        // Friendly heli blips (cyan)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("fHeliBlip" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0.2, 1, 0.7), 1.0, mod.UIBgFill.Solid, player);
        }
        // Friendly heli heading ticks (light cyan)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("fHeliHead" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0.5, 1, 0.85), 1.0, mod.UIBgFill.Solid, player);
        }
    } catch {}
}

// -----------------------------------------------------------------------------
// RADAR VISIBILITY
// -----------------------------------------------------------------------------
function setRadarVisible(player: mod.Player, visible: boolean) {
    try {
        const s = "" + mod.GetObjId(player);
        const frameWidgets = [
            "radarBorder", "radarGH", "radarGV",
            "radarR1T", "radarR1B", "radarR1L", "radarR1R",
            "radarR2T", "radarR2B", "radarR2L", "radarR2R",
            "playerBlip", "playerHead"
        ];
        for (let w = 0; w < frameWidgets.length; w++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName(frameWidgets[w] + s), visible); } catch {}
        }
        if (!visible) {
            for (let i = 0; i < 8; i++) {
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("enemyBlip" + i + s), false); } catch {}
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("enemyHead" + i + s), false); } catch {}
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("friendBlip" + i + s), false); } catch {}
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("friendHead" + i + s), false); } catch {}
            }
            for (let i = 0; i < 4; i++) {
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("eHeliBlip" + i + s), false); } catch {}
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("eHeliHead" + i + s), false); } catch {}
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("fHeliBlip" + i + s), false); } catch {}
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("fHeliHead" + i + s), false); } catch {}
            }
        }
        const id = mod.GetObjId(player);
        if (visible) radarVisiblePlayers.add(id);
        else radarVisiblePlayers.delete(id);
    } catch {}
}

// -----------------------------------------------------------------------------
// RADAR UPDATE
// -----------------------------------------------------------------------------
function updateRadar(eventPlayer: mod.Player) {
    if (!radarVisiblePlayers.has(mod.GetObjId(eventPlayer))) return;

    try {
        const s = "" + mod.GetObjId(eventPlayer);
        const playerPos = mod.GetObjectPosition(eventPlayer);
        const playerTeam = mod.GetTeam(eventPlayer);

        // Resolve yaw from vehicle facing or soldier facing
        let yawRad = 0;
        if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsInVehicle)) {
            try {
                const veh = mod.GetVehicleFromPlayer(eventPlayer);
                if (veh != null) {
                    try {
                        const vFacing = mod.GetVehicleState(veh, mod.VehicleStateVector.FacingDirection);
                        const vfx = Number(mod.XComponentOf(vFacing) as any);
                        const vfz = Number(mod.ZComponentOf(vFacing) as any);
                        if (!isNaN(vfx) && !isNaN(vfz) && (vfx !== 0 || vfz !== 0)) {
                            yawRad = Math.atan2(vfx, vfz);
                        }
                    } catch {
                        const vel = mod.GetVehicleState(veh, mod.VehicleStateVector.LinearVelocity);
                        const vxn = Number(mod.XComponentOf(vel) as any);
                        const vzn = Number(mod.ZComponentOf(vel) as any);
                        const speed = Math.sqrt(vxn * vxn + vzn * vzn);
                        if (speed > 1) { yawRad = Math.atan2(vxn, vzn); }
                    }
                }
            } catch {}
        } else {
            const facing = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetFacingDirection);
            const fx: any = mod.XComponentOf(facing);
            const fz: any = mod.ZComponentOf(facing);
            yawRad = Math.atan2(Number(fx), Number(fz));
        }

        const cosY = Math.cos(yawRad);
        const sinY = Math.sin(yawRad);

        // Dim own blip when below radar
        try {
            const selfGY = playerGroundY[mod.GetObjId(eventPlayer)];
            let selfBelowRadar = false;
            if (selfGY !== undefined) {
                const selfY = Number(mod.YComponentOf(playerPos) as any);
                if (!isNaN(selfY) && (selfY - selfGY) < 35) selfBelowRadar = true;
            }
            const pb = mod.FindUIWidgetWithName("playerBlip" + s);
            const ph = mod.FindUIWidgetWithName("playerHead" + s);
            if (pb) mod.SetUIWidgetBgAlpha(pb, selfBelowRadar ? 0.3 : 1.0);
            if (ph) mod.SetUIWidgetBgAlpha(ph, selfBelowRadar ? 0.3 : 1.0);
        } catch {}

        const allPlayers = mod.AllPlayers();
        const count = mod.CountOf(allPlayers);
        let eJetIdx = 0;
        let eHeliIdx = 0;
        let fJetIdx = 0;
        let fHeliIdx = 0;

        for (let e = 0; e < count; e++) {
            const other = mod.ValueInArray(allPlayers, e);
            if (other === eventPlayer) continue;

            if (!mod.GetSoldierState(other, mod.SoldierStateBool.IsInVehicle)) continue;
            try { if (Number(mod.GetPlayerVehicleSeat(other)) !== 0) continue; } catch {}
            let otherVeh: any = null;
            let isHeli = false;
            try {
                otherVeh = mod.GetVehicleFromPlayer(other);
                if (!otherVeh || !checkIsAircraft(otherVeh)) continue;
                isHeli = checkIsHeli(otherVeh);
            } catch { continue; }

            const otherTeam = mod.GetTeam(other);
            const isFriendly = mod.Equals(otherTeam, playerTeam);

            let prefix = "";
            let idx = 0;
            if (isFriendly && isHeli) {
                if (fHeliIdx >= 4) continue;
                prefix = "fHeli"; idx = fHeliIdx;
            } else if (isFriendly && !isHeli) {
                if (fJetIdx >= 8) continue;
                prefix = "friend"; idx = fJetIdx;
            } else if (!isFriendly && isHeli) {
                if (eHeliIdx >= 4) continue;
                prefix = "eHeli"; idx = eHeliIdx;
            } else {
                if (eJetIdx >= 8) continue;
                prefix = "enemy"; idx = eJetIdx;
            }

            const otherPos = mod.GetObjectPosition(other);

            const wx: any = mod.XComponentOf(otherPos);
            const wz: any = mod.ZComponentOf(otherPos);
            const px: any = mod.XComponentOf(playerPos);
            const pz: any = mod.ZComponentOf(playerPos);
            const dx = Number(wx) - Number(px);
            const dz = Number(wz) - Number(pz);
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (isNaN(dist) || dist < 1) continue;
            if (dist > 600) continue;

            // Below-radar: skip enemy contacts under 35m AGL
            if (!isFriendly) {
                try {
                    const otherId = mod.GetObjId(other);
                    const otherGY = playerGroundY[otherId];
                    if (otherGY !== undefined) {
                        const otherY = Number(mod.YComponentOf(otherPos) as any);
                        if (!isNaN(otherY) && (otherY - otherGY) < 35) continue;
                    }
                } catch {}
            }

            const rx = -(dx * cosY - dz * sinY);
            const ry = -(dx * sinY + dz * cosY);

            const scale = 90 / 600;
            let rpx = Math.round(rx * scale);
            let rpy = Math.round(ry * scale);

            const maxR = 90;
            const rd = Math.sqrt(rpx * rpx + rpy * rpy);
            if (rd > maxR) {
                rpx = Math.round(rpx * maxR / rd);
                rpy = Math.round(rpy * maxR / rd);
            }
            if (isNaN(rpx) || isNaN(rpy)) continue;

            const blip = mod.FindUIWidgetWithName(prefix + "Blip" + idx + s);
            mod.SetUIWidgetPosition(blip, mod.CreateVector(RADAR_CX + rpx, RADAR_CY + rpy, 0));
            mod.SetUIWidgetVisible(blip, true);

            // Heading tick
            try {
                let eYawRad = 0;
                let hasHeading = false;
                if (mod.GetSoldierState(other, mod.SoldierStateBool.IsInVehicle)) {
                    const eVeh = mod.GetVehicleFromPlayer(other);
                    if (eVeh != null) {
                        try {
                            const eFace = mod.GetVehicleState(eVeh, mod.VehicleStateVector.FacingDirection);
                            const efx = Number(mod.XComponentOf(eFace) as any);
                            const efz = Number(mod.ZComponentOf(eFace) as any);
                            if (!isNaN(efx) && !isNaN(efz) && (efx !== 0 || efz !== 0)) {
                                eYawRad = Math.atan2(efx, efz);
                                hasHeading = true;
                            }
                        } catch {}
                        if (!hasHeading) {
                            const eVel = mod.GetVehicleState(eVeh, mod.VehicleStateVector.LinearVelocity);
                            const evx = Number(mod.XComponentOf(eVel) as any);
                            const evz = Number(mod.ZComponentOf(eVel) as any);
                            const eSpd = Math.sqrt(evx * evx + evz * evz);
                            if (eSpd > 1) { eYawRad = Math.atan2(evx, evz); hasHeading = true; }
                        }
                    }
                } else {
                    const eFacing = mod.GetSoldierState(other, mod.SoldierStateVector.GetFacingDirection);
                    const efx = Number(mod.XComponentOf(eFacing) as any);
                    const efz = Number(mod.ZComponentOf(eFacing) as any);
                    if (efx !== 0 || efz !== 0) { eYawRad = Math.atan2(efx, efz); hasHeading = true; }
                }

                const headW = mod.FindUIWidgetWithName(prefix + "Head" + idx + s);
                if (hasHeading) {
                    const relHeadRad = eYawRad - yawRad;
                    const hOffX = Math.round(-Math.sin(relHeadRad) * 11);
                    const hOffY = Math.round(-Math.cos(relHeadRad) * 11);
                    mod.SetUIWidgetPosition(headW, mod.CreateVector(RADAR_CX + rpx + hOffX, RADAR_CY + rpy + hOffY, 0));
                    mod.SetUIWidgetVisible(headW, true);
                } else {
                    mod.SetUIWidgetVisible(headW, false);
                }
            } catch {
                try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName(prefix + "Head" + idx + s), false); } catch {}
            }

            if (isFriendly && isHeli) fHeliIdx++;
            else if (isFriendly) fJetIdx++;
            else if (isHeli) eHeliIdx++;
            else eJetIdx++;
        }

        // Hide unused blips
        for (let i = eJetIdx; i < 8; i++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("enemyBlip" + i + s), false); } catch {}
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("enemyHead" + i + s), false); } catch {}
        }
        for (let i = eHeliIdx; i < 4; i++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("eHeliBlip" + i + s), false); } catch {}
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("eHeliHead" + i + s), false); } catch {}
        }
        for (let i = fJetIdx; i < 8; i++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("friendBlip" + i + s), false); } catch {}
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("friendHead" + i + s), false); } catch {}
        }
        for (let i = fHeliIdx; i < 4; i++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("fHeliBlip" + i + s), false); } catch {}
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("fHeliHead" + i + s), false); } catch {}
        }
    } catch {}
}

// -----------------------------------------------------------------------------
// RADAR LIFECYCLE (terrain raycast + auto show/hide)
// -----------------------------------------------------------------------------
function radarTickForPlayer(eventPlayer: mod.Player) {
    if (!eventPlayer || !mod.IsPlayerValid(eventPlayer)) return;

    const pid = mod.GetObjId(eventPlayer);

    // Auto-show/hide radar based on aircraft state
    let inAircraft = false;
    try {
        if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsInVehicle)) {
            const veh = mod.GetVehicleFromPlayer(eventPlayer);
            if (veh && checkIsAircraft(veh)) inAircraft = true;
        }
    } catch {}

    if (inAircraft && !radarVisiblePlayers.has(pid)) {
        setRadarVisible(eventPlayer, true);
    } else if (!inAircraft && radarVisiblePlayers.has(pid)) {
        setRadarVisible(eventPlayer, false);
    }

    // Fire terrain raycast
    try {
        const pos = mod.GetObjectPosition(eventPlayer);
        const px = Number(mod.XComponentOf(pos) as any);
        const py = Number(mod.YComponentOf(pos) as any);
        const pz = Number(mod.ZComponentOf(pos) as any);
        let rpx = px;
        let rpy = py;
        let rpz = pz;
        if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsInVehicle)) {
            try {
                const veh = mod.GetVehicleFromPlayer(eventPlayer);
                if (veh) {
                    const vPos = mod.GetVehicleState(veh, mod.VehicleStateVector.VehiclePosition);
                    rpx = Number(mod.XComponentOf(vPos) as any);
                    rpy = Number(mod.YComponentOf(vPos) as any);
                    rpz = Number(mod.ZComponentOf(vPos) as any);
                }
            } catch {}
        }
        const start = mod.CreateVector(rpx, rpy, rpz);
        const end = mod.CreateVector(rpx, rpy - 1000, rpz);
        mod.RayCast(eventPlayer, start, end);
    } catch {}

    updateRadar(eventPlayer);
}

// -----------------------------------------------------------------------------
// EXPORTS — Hook these into your game mode
// -----------------------------------------------------------------------------

// Call in OnGameModeStarted:
//   radarInitializedPlayers.clear();
//   radarVisiblePlayers.clear();

// Call in initializePlayerState or OnPlayerJoinGame:
//   createRadarForPlayer(player);

// Call in OngoingPlayer:
//   radarTickForPlayer(eventPlayer);

// Call in OnPlayerEnterVehicle:
//   if (checkIsAircraft(eventVehicle)) setRadarVisible(eventPlayer, true);

// Call in OnPlayerExitVehicle:
//   setRadarVisible(eventPlayer, false);

// Required export — add to your exports:
export function OnRayCastHit(eventPlayer: mod.Player, eventPoint: mod.Vector, eventNormal: mod.Vector) {
    try {
        const pid = mod.GetObjId(eventPlayer);
        const gy = Number(mod.YComponentOf(eventPoint) as any);
        if (isNaN(gy)) return;
        const lastGY = playerGroundY[pid];
        if (lastGY !== undefined && Math.abs(gy - lastGY) > 50) return;
        playerGroundY[pid] = gy;
    } catch {}
}
