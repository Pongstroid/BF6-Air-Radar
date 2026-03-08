/**
 * Airsup_v1_34
 * Air Sup baseline with triple-tap interact team-switch HUD panel.
 * Radar: left-center, 50% larger, blip + heading tick style.
 * Fix: removed initializeAllCurrentPlayers - widgets only created via OnPlayerJoinGame.
 * Copyright (c) 2026 Ethan Mills, Pongstroid. All rights reserved.
 */

// -----------------------------------------------------------------------------
// GAME MODE VARIABLES
// -----------------------------------------------------------------------------
const playerKills = 0;
const playerDeaths = 1;
const playerScore = 2;
const playerCaptures = 3;

let team1ScoreTimer = 0;
let team2ScoreTimer = 0;
let radarOwnerId = 0;
const radarInitializedPlayers: Set<number> = new Set();

const TRIPLE_TAP_WINDOW_SECONDS = 1.25;

interface PlayerTeamSwitchUi {
    hintTextName: string;
    debugTapTextName: string;
    debugClickTextName: string;
    panelName: string;
    panelLabelName: string;
    team1ButtonName: string;
    team2ButtonName: string;
    closeButtonName: string;
    team1TextName: string;
    team2TextName: string;
    closeTextName: string;
    panelVisible: boolean;
    tapCount: number;
    lastTapTime: number;
    interactPoint: mod.InteractPoint | null;
    lastDebugTapCount: number;
    panelOpenedAt: number;
}

const playerTeamSwitchUiMap: Map<number, PlayerTeamSwitchUi> = new Map();

class InteractMultiClickDetector {
    private static readonly STATES: Record<number, { lastIsInteracting: boolean; clickCount: number; sequenceStartTime: number }> = {};
    private static readonly WINDOW_MS = 2000;
    private static readonly REQUIRED_CLICKS = 3;

    public static checkMultiClick(player: mod.Player): boolean {
        const playerId = mod.GetObjId(player);
        const isInteracting = mod.GetSoldierState(player, mod.SoldierStateBool.IsInteracting);
        let state = this.STATES[playerId];
        if (!state) {
            this.STATES[playerId] = state = { lastIsInteracting: isInteracting, clickCount: 0, sequenceStartTime: 0 };
        }
        if (isInteracting === state.lastIsInteracting) return false;
        state.lastIsInteracting = isInteracting;
        if (!isInteracting) return false;
        const now = Date.now();
        if (state.clickCount > 0 && now - state.sequenceStartTime > this.WINDOW_MS) { state.clickCount = 0; }
        if (state.clickCount === 0) { state.sequenceStartTime = now; state.clickCount = 1; return false; }
        if (++state.clickCount !== this.REQUIRED_CLICKS) return false;
        state.clickCount = 0;
        return true;
    }

    public static getTapProgress(player: mod.Player): number {
        const state = this.STATES[mod.GetObjId(player)];
        if (!state) return 0;
        return state.clickCount;
    }
}

// -----------------------------------------------------------------------------
// AIR RADAR
// -----------------------------------------------------------------------------
function checkIsJet(vehicle: any): boolean {
    try {
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.F16)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.F22)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.JAS39)) return true;
        if (mod.CompareVehicleName(vehicle, mod.VehicleList.SU57)) return true;
    } catch {}
    return false;
}

// Radar position: left-center using Center anchor
const RADAR_OX = -620;
const RADAR_OY = 75;
const RADAR_CX = RADAR_OX;
const RADAR_CY = RADAR_OY;

function createRadarForPlayer(player: mod.Player) {
    try {
        const id = mod.GetObjId(player);
        if (radarInitializedPlayers.has(id)) return;
        radarInitializedPlayers.add(id);
        const root = mod.GetUIRoot();
        radarOwnerId = mod.GetObjId(player);
        const s = "" + radarOwnerId;
        mod.AddUIContainer("radarBorder" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(231, 231, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.8, 0), 0.9, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarBg" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(225, 225, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.05, 0), 0.65, mod.UIBgFill.Solid, player);
        // Grid: crosshair lines
        mod.AddUIContainer("radarGH" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(225, 1, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.45, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarGV" + s, mod.CreateVector(RADAR_OX, RADAR_OY, 0), mod.CreateVector(1, 225, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.45, mod.UIBgFill.Solid, player);
        // Grid: 1/3 range ring (~37px from center, 200m)
        mod.AddUIContainer("radarR1T" + s, mod.CreateVector(RADAR_OX, RADAR_OY - 37, 0), mod.CreateVector(74, 1, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR1B" + s, mod.CreateVector(RADAR_OX, RADAR_OY + 37, 0), mod.CreateVector(74, 1, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR1L" + s, mod.CreateVector(RADAR_OX - 37, RADAR_OY, 0), mod.CreateVector(1, 74, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR1R" + s, mod.CreateVector(RADAR_OX + 37, RADAR_OY, 0), mod.CreateVector(1, 74, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        // Grid: 2/3 range ring (~75px from center, 400m)
        mod.AddUIContainer("radarR2T" + s, mod.CreateVector(RADAR_OX, RADAR_OY - 75, 0), mod.CreateVector(150, 1, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR2B" + s, mod.CreateVector(RADAR_OX, RADAR_OY + 75, 0), mod.CreateVector(150, 1, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR2L" + s, mod.CreateVector(RADAR_OX - 75, RADAR_OY, 0), mod.CreateVector(1, 150, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("radarR2R" + s, mod.CreateVector(RADAR_OX + 75, RADAR_OY, 0), mod.CreateVector(1, 150, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(0, 0.3, 0), 0.3, mod.UIBgFill.Solid, player);
        // Player blip + heading tick (white) at radar center
        mod.AddUIContainer("playerBlip" + s, mod.CreateVector(RADAR_CX, RADAR_CY, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(1, 1, 1), 1.0, mod.UIBgFill.Solid, player);
        mod.AddUIContainer("playerHead" + s, mod.CreateVector(RADAR_CX, RADAR_CY - 8, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, true, 0, mod.CreateVector(1, 1, 1), 1.0, mod.UIBgFill.Solid, player);
        // Enemy blips (red, 8x8)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("enemyBlip" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 0.2, 0.2), 1.0, mod.UIBgFill.Solid, player);
        }
        // Enemy heading ticks (orange, 4x4)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("enemyHead" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(1, 0.6, 0.2), 1.0, mod.UIBgFill.Solid, player);
        }
        // Friendly blips (blue, 8x8)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("friendBlip" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(8, 8, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0.2, 0.5, 1.0), 1.0, mod.UIBgFill.Solid, player);
        }
        // Friendly heading ticks (light blue, 4x4)
        for (let i = 0; i < 4; i++) {
            mod.AddUIContainer("friendHead" + i + s, mod.CreateVector(0, 0, 0), mod.CreateVector(4, 4, 0), mod.UIAnchor.Center, root, false, 0, mod.CreateVector(0.4, 0.7, 1.0), 1.0, mod.UIBgFill.Solid, player);
        }
    } catch {}
}

function destroyRadarWidgets() {
    try {
        const s = "" + radarOwnerId;
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarBorder" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarBg" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarGH" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarGV" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR1T" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR1B" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR1L" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR1R" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR2T" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR2B" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR2L" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("radarR2R" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("playerBlip" + s)); } catch {}
        try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("playerHead" + s)); } catch {}
        for (let i = 0; i < 4; i++) {
            try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("enemyBlip" + i + s)); } catch {}
            try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("enemyHead" + i + s)); } catch {}
            try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("friendBlip" + i + s)); } catch {}
            try { mod.DeleteUIWidget(mod.FindUIWidgetWithName("friendHead" + i + s)); } catch {}
        }
    } catch {}
}


function updateRadar(eventPlayer: mod.Player) {
    try {
        const s = "" + mod.GetObjId(eventPlayer);
        const playerPos = mod.GetObjectPosition(eventPlayer);
        const playerTeam = mod.GetTeam(eventPlayer);

        // Player yaw
        let yawRad = 0;
        if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsInVehicle)) {
            try {
                const veh = mod.GetVehicleFromPlayer(eventPlayer);
                if (veh != null) {
                    const vel = mod.GetVehicleState(veh, mod.VehicleStateVector.LinearVelocity);
                    const vx: any = mod.XComponentOf(vel);
                    const vz: any = mod.ZComponentOf(vel);
                    const vxn = Number(vx);
                    const vzn = Number(vz);
                    const speed = Math.sqrt(vxn * vxn + vzn * vzn);
                    if (speed > 1) { yawRad = Math.atan2(vxn, vzn); }
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
        const allPlayers = mod.AllPlayers();
        const count = mod.CountOf(allPlayers);
        let enemyIdx = 0;
        let friendIdx = 0;

        for (let e = 0; e < count; e++) {
            if (enemyIdx >= 4 && friendIdx >= 4) break;
            const other = mod.ValueInArray(allPlayers, e);
            if (other === eventPlayer) continue;

            const otherTeam = mod.GetTeam(other);
            const isFriendly = mod.Equals(otherTeam, playerTeam);

            // Skip if we're full on this type
            if (isFriendly && friendIdx >= 4) continue;
            if (!isFriendly && enemyIdx >= 4) continue;

            const otherPos = mod.GetObjectPosition(other);

            if (!isFriendly) {
            }

            const wx: any = mod.XComponentOf(otherPos);
            const wz: any = mod.ZComponentOf(otherPos);
            const px: any = mod.XComponentOf(playerPos);
            const pz: any = mod.ZComponentOf(playerPos);
            const dx = Number(wx) - Number(px);
            const dz = Number(wz) - Number(pz);
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (isNaN(dist) || dist < 1) continue;

            // Rotate by player yaw
            const rx = -(dx * cosY - dz * sinY);
            const ry = -(dx * sinY + dz * cosY);

            // Scale: 600m = 90px
            const scale = 90 / 600;
            let rpx = Math.round(rx * scale);
            let rpy = Math.round(ry * scale);

            // Clamp to radar bounds
            const maxR = 90;
            const rd = Math.sqrt(rpx * rpx + rpy * rpy);
            if (rd > maxR) {
                rpx = Math.round(rpx * maxR / rd);
                rpy = Math.round(rpy * maxR / rd);
            }
            if (isNaN(rpx) || isNaN(rpy)) continue;

            // Choose widget prefix and index based on team
            const prefix = isFriendly ? "friend" : "enemy";
            const idx = isFriendly ? friendIdx : enemyIdx;

            // Position blip
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
                        const eVel = mod.GetVehicleState(eVeh, mod.VehicleStateVector.LinearVelocity);
                        const evx = Number(mod.XComponentOf(eVel) as any);
                        const evz = Number(mod.ZComponentOf(eVel) as any);
                        const eSpd = Math.sqrt(evx * evx + evz * evz);
                        if (eSpd > 1) { eYawRad = Math.atan2(evx, evz); hasHeading = true; }
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

            if (isFriendly) friendIdx++;
            else enemyIdx++;
        }

        // Hide unused blips
        for (let i = enemyIdx; i < 4; i++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("enemyBlip" + i + s), false); } catch {}
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("enemyHead" + i + s), false); } catch {}
        }
        for (let i = friendIdx; i < 4; i++) {
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("friendBlip" + i + s), false); } catch {}
            try { mod.SetUIWidgetVisible(mod.FindUIWidgetWithName("friendHead" + i + s), false); } catch {}
        }
    } catch {}
}

// -----------------------------------------------------------------------------
// INITIALIZE GAME MODE
// -----------------------------------------------------------------------------
export async function OnGameModeStarted() {
    team1ScoreTimer = 0;
    team2ScoreTimer = 0;
    playerTeamSwitchUiMap.clear();

    const capturePointA = mod.GetCapturePoint(100);
    const capturePointB = mod.GetCapturePoint(101);
    const capturePointC = mod.GetCapturePoint(102);

    mod.EnableGameModeObjective(capturePointA, true);
    mod.EnableGameModeObjective(capturePointB, true);
    mod.EnableGameModeObjective(capturePointC, true);

    mod.SetCapturePointCapturingTime(capturePointA, 2.5);
    mod.SetCapturePointNeutralizationTime(capturePointA, 2.5);
    mod.SetCapturePointCapturingTime(capturePointB, 2.5);
    mod.SetCapturePointNeutralizationTime(capturePointB, 2.5);
    mod.SetCapturePointCapturingTime(capturePointC, 2.5);
    mod.SetCapturePointNeutralizationTime(capturePointC, 2.5);

    mod.SetMaxCaptureMultiplier(capturePointA, 1);
    mod.SetMaxCaptureMultiplier(capturePointB, 1);
    mod.SetMaxCaptureMultiplier(capturePointC, 1);

    mod.SetGameModeScore(mod.GetTeam(1), 0);
    mod.SetGameModeScore(mod.GetTeam(2), 0);

    setUpScoreBoard();

    // Delay initialization to ensure all players are fully loaded
    await mod.Wait(3);
    initializeAllCurrentPlayers();

    while (mod.GetMatchTimeRemaining() > 0) {
        await mod.Wait(1);
        updateTeamScores();
        updateScoreBoardTotal();
    }
}

// -----------------------------------------------------------------------------
// SCOREBOARD
// -----------------------------------------------------------------------------

function initializeAllCurrentPlayers() {
    const players = mod.AllPlayers();
    const count = mod.CountOf(players);
    for (let i = 0; i < count; i++) {
        const player = mod.ValueInArray(players, i) as mod.Player;
        initializePlayerState(player);
    }
}

function updateScoreBoardTotal() {
    const score1 = mod.GetGameModeScore(mod.GetTeam(1));
    const score2 = mod.GetGameModeScore(mod.GetTeam(2));
    mod.SetScoreboardHeader(
        mod.Message(mod.stringkeys.score, score1),
        mod.Message(mod.stringkeys.score, score2)
    );
}

function setUpScoreBoard() {
    mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams);
    mod.SetScoreboardHeader(mod.Message(mod.stringkeys.score, 0), mod.Message(mod.stringkeys.score, 0));
    mod.SetScoreboardColumnNames(
        mod.Message(mod.stringkeys.SBHead1), mod.Message(mod.stringkeys.SBHead2),
        mod.Message(mod.stringkeys.SBHead3), mod.Message(mod.stringkeys.SBHead4)
    );
    mod.SetScoreboardColumnWidths(10, 10, 10, 10);
}

// -----------------------------------------------------------------------------
// TEAM SCORING
// -----------------------------------------------------------------------------
function getSecondsPerPoint(pointsHeld: number): number {
    if (pointsHeld === 3) return 1;
    if (pointsHeld === 2) return 5;
    if (pointsHeld === 1) return 10;
    return 0;
}

function updateTeamScores() {
    let team1PointsHeld = 0;
    let team2PointsHeld = 0;
    const ownerA = mod.GetCurrentOwnerTeam(mod.GetCapturePoint(100));
    const ownerB = mod.GetCurrentOwnerTeam(mod.GetCapturePoint(101));
    const ownerC = mod.GetCurrentOwnerTeam(mod.GetCapturePoint(102));

    if (mod.Equals(ownerA, mod.GetTeam(1))) team1PointsHeld++;
    else if (mod.Equals(ownerA, mod.GetTeam(2))) team2PointsHeld++;
    if (mod.Equals(ownerB, mod.GetTeam(1))) team1PointsHeld++;
    else if (mod.Equals(ownerB, mod.GetTeam(2))) team2PointsHeld++;
    if (mod.Equals(ownerC, mod.GetTeam(1))) team1PointsHeld++;
    else if (mod.Equals(ownerC, mod.GetTeam(2))) team2PointsHeld++;

    team1ScoreTimer++;
    team2ScoreTimer++;
    const team1Rate = getSecondsPerPoint(team1PointsHeld);
    const team2Rate = getSecondsPerPoint(team2PointsHeld);

    if (team1Rate > 0 && team1ScoreTimer >= team1Rate) {
        team1ScoreTimer = 0;
        mod.SetGameModeScore(mod.GetTeam(1), mod.GetGameModeScore(mod.GetTeam(1)) + 1);
    }
    if (team2Rate > 0 && team2ScoreTimer >= team2Rate) {
        team2ScoreTimer = 0;
        mod.SetGameModeScore(mod.GetTeam(2), mod.GetGameModeScore(mod.GetTeam(2)) + 1);
    }
}

// -----------------------------------------------------------------------------
// TEAM SWITCH UI
// -----------------------------------------------------------------------------
function createTeamSwitchUi(player: mod.Player) {
    const id = mod.GetObjId(player);
    if (playerTeamSwitchUiMap.has(id)) return;

    const hintTextName = "HUD_TEAM_SWITCH_HINT_" + id;
    const debugTapTextName = "HUD_TEAM_SWITCH_DEBUG_TAP_" + id;
    const debugClickTextName = "HUD_TEAM_SWITCH_DEBUG_CLICK_" + id;
    const panelName = "HUD_TEAM_SWITCH_PANEL_" + id;
    const panelLabelName = "HUD_TEAM_SWITCH_LABEL_" + id;
    const team1ButtonName = "HUD_TEAM_SWITCH_T1_" + id;
    const team2ButtonName = "HUD_TEAM_SWITCH_T2_" + id;
    const closeButtonName = "HUD_TEAM_SWITCH_CLOSE_" + id;
    const team1TextName = "HUD_TEAM_SWITCH_T1_TEXT_" + id;
    const team2TextName = "HUD_TEAM_SWITCH_T2_TEXT_" + id;
    const closeTextName = "HUD_TEAM_SWITCH_CLOSE_TEXT_" + id;

    mod.AddUIText(hintTextName, mod.CreateVector(20, 690, 0), mod.CreateVector(440, 24, 0), mod.UIAnchor.BottomLeft, mod.GetUIRoot(), true, 5, mod.CreateVector(0, 0, 0), 0.35, mod.UIBgFill.Solid, mod.Message(mod.stringkeys.TEAM_SWITCH_HINT), 13, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, player);

    mod.AddUIContainer(panelName, mod.CreateVector(20, 500, 0), mod.CreateVector(440, 150, 0), mod.UIAnchor.BottomLeft, mod.GetUIRoot(), false, 6, mod.CreateVector(0, 0, 0), 0.5, mod.UIBgFill.Blur, player);

    const panel = mod.FindUIWidgetWithName(panelName);
    if (!panel) return;

    mod.AddUIText(panelLabelName, mod.CreateVector(70, 14, 0), mod.CreateVector(300, 24, 0), mod.UIAnchor.TopLeft, panel, false, 7, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message(mod.stringkeys.TEAM_SWITCH_LABEL), 15, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, player);

    mod.AddUIButton(team1ButtonName, mod.CreateVector(20, 50, 0), mod.CreateVector(180, 36, 0), mod.UIAnchor.TopLeft, panel, false, 7, mod.CreateVector(0.1, 0.2, 0.4), 0.95, mod.UIBgFill.Solid, true, mod.CreateVector(0.15, 0.35, 0.7), 1, mod.CreateVector(0.12, 0.12, 0.12), 0.6, mod.CreateVector(0.08, 0.2, 0.4), 1, mod.CreateVector(0.2, 0.45, 0.85), 1, mod.CreateVector(0.2, 0.45, 0.85), 1, player);
    mod.AddUIText(team1TextName, mod.CreateVector(30, 56, 0), mod.CreateVector(160, 24, 0), mod.UIAnchor.TopLeft, panel, false, 8, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message(mod.stringkeys.TEAM_SWITCH_JOIN_1), 13, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, player);

    mod.AddUIButton(team2ButtonName, mod.CreateVector(240, 50, 0), mod.CreateVector(180, 36, 0), mod.UIAnchor.TopLeft, panel, false, 7, mod.CreateVector(0.4, 0.1, 0.1), 0.95, mod.UIBgFill.Solid, true, mod.CreateVector(0.7, 0.15, 0.15), 1, mod.CreateVector(0.12, 0.12, 0.12), 0.6, mod.CreateVector(0.4, 0.1, 0.1), 1, mod.CreateVector(0.85, 0.2, 0.2), 1, mod.CreateVector(0.85, 0.2, 0.2), 1, player);
    mod.AddUIText(team2TextName, mod.CreateVector(250, 56, 0), mod.CreateVector(160, 24, 0), mod.UIAnchor.TopLeft, panel, false, 8, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message(mod.stringkeys.TEAM_SWITCH_JOIN_2), 13, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, player);

    mod.AddUIButton(closeButtonName, mod.CreateVector(130, 100, 0), mod.CreateVector(180, 34, 0), mod.UIAnchor.TopLeft, panel, false, 7, mod.CreateVector(0.12, 0.12, 0.12), 0.9, mod.UIBgFill.Solid, true, mod.CreateVector(0.2, 0.2, 0.2), 1, mod.CreateVector(0.12, 0.12, 0.12), 0.6, mod.CreateVector(0.1, 0.1, 0.1), 1, mod.CreateVector(0.3, 0.3, 0.3), 1, mod.CreateVector(0.3, 0.3, 0.3), 1, player);
    mod.AddUIText(closeTextName, mod.CreateVector(140, 105, 0), mod.CreateVector(160, 24, 0), mod.UIAnchor.TopLeft, panel, false, 8, mod.CreateVector(0, 0, 0), 0, mod.UIBgFill.None, mod.Message(mod.stringkeys.TEAM_SWITCH_CLOSE), 13, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center, player);

    playerTeamSwitchUiMap.set(id, {
        hintTextName, debugTapTextName, debugClickTextName, panelName, panelLabelName,
        team1ButtonName, team2ButtonName, closeButtonName,
        team1TextName, team2TextName, closeTextName,
        panelVisible: false, tapCount: 0, lastTapTime: -1000,
        interactPoint: null, lastDebugTapCount: -1, panelOpenedAt: -1000
    });

    const team1Button = mod.FindUIWidgetWithName(team1ButtonName);
    const team2Button = mod.FindUIWidgetWithName(team2ButtonName);
    const closeButton = mod.FindUIWidgetWithName(closeButtonName);
    if (team1Button) { mod.EnableUIButtonEvent(team1Button, mod.UIButtonEvent.ButtonDown, true); mod.EnableUIButtonEvent(team1Button, mod.UIButtonEvent.ButtonUp, true); }
    if (team2Button) { mod.EnableUIButtonEvent(team2Button, mod.UIButtonEvent.ButtonDown, true); mod.EnableUIButtonEvent(team2Button, mod.UIButtonEvent.ButtonUp, true); }
    if (closeButton) { mod.EnableUIButtonEvent(closeButton, mod.UIButtonEvent.ButtonDown, true); mod.EnableUIButtonEvent(closeButton, mod.UIButtonEvent.ButtonUp, true); }
    updateTeamSwitchButtonState(player);
}

function setTeamSwitchTapDebugText(player: mod.Player, message: mod.Message) {
    const id = mod.GetObjId(player);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;
    const debugWidget = mod.FindUIWidgetWithName(ui.debugTapTextName);
    if (!debugWidget) return;
    mod.SetUITextLabel(debugWidget, message);
}

function setTeamSwitchClickDebugText(player: mod.Player, message: mod.Message) {
    const id = mod.GetObjId(player);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;
    const debugWidget = mod.FindUIWidgetWithName(ui.debugClickTextName);
    if (!debugWidget) return;
    mod.SetUITextLabel(debugWidget, message);
}

function widgetOrAncestorMatchesName(startWidget: mod.UIWidget, expectedNames: string[], maxDepth: number = 8): boolean {
    let current: mod.UIWidget | undefined = startWidget;
    for (let i = 0; i < maxDepth && current; i++) {
        const name = mod.GetUIWidgetName(current);
        for (let j = 0; j < expectedNames.length; j++) {
            const expected = expectedNames[j];
            if (name === expected || name === expected + "_BORDER" || name === expected + "_LABEL") return true;
        }
        current = mod.GetUIWidgetParent(current);
    }
    return false;
}

function setTeamSwitchPanelVisible(player: mod.Player, visible: boolean) {
    const id = mod.GetObjId(player);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;

    const panel = mod.FindUIWidgetWithName(ui.panelName);
    const label = mod.FindUIWidgetWithName(ui.panelLabelName);
    const t1Button = mod.FindUIWidgetWithName(ui.team1ButtonName);
    const t2Button = mod.FindUIWidgetWithName(ui.team2ButtonName);
    const closeButton = mod.FindUIWidgetWithName(ui.closeButtonName);
    const t1Text = mod.FindUIWidgetWithName(ui.team1TextName);
    const t2Text = mod.FindUIWidgetWithName(ui.team2TextName);
    const closeText = mod.FindUIWidgetWithName(ui.closeTextName);

    if (panel) mod.SetUIWidgetVisible(panel, visible);
    if (label) mod.SetUIWidgetVisible(label, visible);
    if (t1Button) mod.SetUIWidgetVisible(t1Button, visible);
    if (t2Button) mod.SetUIWidgetVisible(t2Button, visible);
    if (closeButton) mod.SetUIWidgetVisible(closeButton, visible);
    if (t1Text) mod.SetUIWidgetVisible(t1Text, visible);
    if (t2Text) mod.SetUIWidgetVisible(t2Text, visible);
    if (closeText) mod.SetUIWidgetVisible(closeText, visible);

    ui.panelVisible = visible;
    ui.panelOpenedAt = visible ? mod.GetMatchTimeElapsed() : -1000;
    mod.EnableUIInputMode(visible, player);

    if (visible) {
        if (t1Button) mod.SetUIButtonEnabled(t1Button, true);
        if (t2Button) mod.SetUIButtonEnabled(t2Button, true);
        if (closeButton) mod.SetUIButtonEnabled(closeButton, true);
        updateTeamSwitchButtonState(player);
    }
}

function processInteractTap(player: mod.Player) {
    const id = mod.GetObjId(player);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;
    const now = mod.GetMatchTimeElapsed();
    if (now - ui.lastTapTime > TRIPLE_TAP_WINDOW_SECONDS) { ui.tapCount = 0; }
    ui.tapCount++;
    ui.lastTapTime = now;
    if (ui.tapCount >= 3) { ui.tapCount = 0; setTeamSwitchPanelVisible(player, !ui.panelVisible); }
}

function isPlayerLikelyDeployed(player: mod.Player): boolean {
    return (
        mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive) ||
        mod.GetSoldierState(player, mod.SoldierStateBool.IsDead) ||
        mod.GetSoldierState(player, mod.SoldierStateBool.IsManDown)
    );
}

function ensureTeamSwitchInteractPoint(player: mod.Player) {
    if (!player || !mod.IsPlayerValid(player)) return;
    if (!isPlayerLikelyDeployed(player)) return;
    const id = mod.GetObjId(player);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;
    if (ui.interactPoint) return;

    const playerPosition = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
    const playerFacingDirection = mod.GetSoldierState(player, mod.SoldierStateVector.GetFacingDirection);
    if (!playerPosition || !playerFacingDirection) return;

    const interactPointPosition = mod.Add(mod.Add(playerPosition, playerFacingDirection), mod.CreateVector(0, 1.5, 0));
    const interactPoint = mod.SpawnObject(mod.RuntimeSpawn_Common.InteractPoint, interactPointPosition, mod.CreateVector(0, 0, 0)) as mod.InteractPoint;
    mod.EnableInteractPoint(interactPoint, true);
    ui.interactPoint = interactPoint;
    setTeamSwitchTapDebugText(player, mod.Message(mod.stringkeys.TEAM_SWITCH_DEBUG_ARMED));
}

function removeTeamSwitchInteractPoint(playerOrId: mod.Player | number) {
    const id = mod.IsType(playerOrId, mod.Types.Player) ? mod.GetObjId(playerOrId as mod.Player) : (playerOrId as number);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui || !ui.interactPoint) return;
    try { mod.EnableInteractPoint(ui.interactPoint, false); mod.UnspawnObject(ui.interactPoint); } catch {}
    ui.interactPoint = null;
    if (mod.IsType(playerOrId, mod.Types.Player)) {
        setTeamSwitchTapDebugText(playerOrId as mod.Player, mod.Message(mod.stringkeys.TEAM_SWITCH_DEBUG_WAIT));
    }
}

function updateTeamSwitchButtonState(player: mod.Player) {
    const id = mod.GetObjId(player);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;
    const t1Button = mod.FindUIWidgetWithName(ui.team1ButtonName);
    const t2Button = mod.FindUIWidgetWithName(ui.team2ButtonName);
    if (!t1Button || !t2Button) return;
    mod.SetUIButtonEnabled(t1Button, true);
    mod.SetUIButtonEnabled(t2Button, true);
}

async function forceUndeployPlayer(player: mod.Player): Promise<void> {
    if (!player || !mod.IsPlayerValid(player)) return;
    mod.UndeployPlayer(player);
    await mod.Wait(0.05);
    if (!player || !mod.IsPlayerValid(player)) return;
    mod.UndeployPlayer(player);
}

// -----------------------------------------------------------------------------
// PLAYER EVENTS
// -----------------------------------------------------------------------------
export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    initializePlayerState(eventPlayer);
}

function initializePlayerState(player: mod.Player) {
    mod.SetVariable(mod.ObjectVariable(player, playerKills), 0);
    mod.SetVariable(mod.ObjectVariable(player, playerDeaths), 0);
    mod.SetVariable(mod.ObjectVariable(player, playerCaptures), 0);
    mod.SetVariable(mod.ObjectVariable(player, playerScore), 0);
    updatePlayerScoreBoard(player);
    createTeamSwitchUi(player);
    ensureTeamSwitchInteractPoint(player);
    createRadarForPlayer(player);
}

function updatePlayerScoreBoard(player: mod.Player) {
    mod.SetScoreboardPlayerValues(player,
        mod.GetVariable(mod.ObjectVariable(player, playerScore)),
        mod.GetVariable(mod.ObjectVariable(player, playerKills)),
        mod.GetVariable(mod.ObjectVariable(player, playerDeaths)),
        mod.GetVariable(mod.ObjectVariable(player, playerCaptures))
    );
}

export function OnPlayerEarnKill(eventPlayer: mod.Player) {
    mod.SetVariable(mod.ObjectVariable(eventPlayer, playerKills), mod.Add(mod.GetVariable(mod.ObjectVariable(eventPlayer, playerKills)), 1));
    mod.SetVariable(mod.ObjectVariable(eventPlayer, playerScore), mod.Add(mod.GetVariable(mod.ObjectVariable(eventPlayer, playerScore)), 100));
    updatePlayerScoreBoard(eventPlayer);
}

export function OnPlayerDied(eventPlayer: mod.Player) {
    mod.SetVariable(mod.ObjectVariable(eventPlayer, playerDeaths), mod.Add(mod.GetVariable(mod.ObjectVariable(eventPlayer, playerDeaths)), 1));
    updatePlayerScoreBoard(eventPlayer);
}

export function OnCapturePointCaptured(eventCapturePoint: mod.CapturePoint) {
    const playersOnPoint = mod.GetPlayersOnPoint(eventCapturePoint);
    const currentOwner = mod.GetCurrentOwnerTeam(eventCapturePoint);
    const totalPlayersOnPoint = mod.CountOf(playersOnPoint);
    for (let i = 0; i < totalPlayersOnPoint; i++) {
        const player = mod.ValueInArray(playersOnPoint, i) as mod.Player;
        if (!mod.Equals(mod.GetTeam(player), currentOwner)) continue;
        mod.SetVariable(mod.ObjectVariable(player, playerCaptures), mod.Add(mod.GetVariable(mod.ObjectVariable(player, playerCaptures)), 1));
        mod.SetVariable(mod.ObjectVariable(player, playerScore), mod.Add(mod.GetVariable(mod.ObjectVariable(player, playerScore)), 200));
        updatePlayerScoreBoard(player);
    }
}

export function OnPlayerUIButtonEvent(eventPlayer: mod.Player, eventUIWidget: mod.UIWidget, eventUIButtonEvent: mod.UIButtonEvent) {
    const isButtonUp = mod.Equals(eventUIButtonEvent, mod.UIButtonEvent.ButtonUp);
    const isButtonDown = mod.Equals(eventUIButtonEvent, mod.UIButtonEvent.ButtonDown);
    if (!isButtonUp && !isButtonDown) return;

    const id = mod.GetObjId(eventPlayer);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui) return;

    const clickedName = mod.GetUIWidgetName(eventUIWidget);
    setTeamSwitchClickDebugText(eventPlayer, mod.Message("TS Debug: click " + clickedName));
    if (!ui.panelVisible) return;

    const t1Button = mod.FindUIWidgetWithName(ui.team1ButtonName);
    const t2Button = mod.FindUIWidgetWithName(ui.team2ButtonName);
    const closeButton = mod.FindUIWidgetWithName(ui.closeButtonName);

    const isCloseClick = clickedName === ui.closeButtonName || clickedName === ui.closeTextName || (!!closeButton && mod.Equals(eventUIWidget, closeButton)) || widgetOrAncestorMatchesName(eventUIWidget, [ui.closeButtonName, ui.closeTextName]);
    if (isCloseClick) { if (!isButtonUp) return; setTeamSwitchPanelVisible(eventPlayer, false); return; }

    const isTeam1Click = clickedName === ui.team1ButtonName || clickedName === ui.team1TextName || (!!t1Button && mod.Equals(eventUIWidget, t1Button)) || widgetOrAncestorMatchesName(eventUIWidget, [ui.team1ButtonName, ui.team1TextName]);
    if (isTeam1Click) { if (!isButtonUp) return; mod.SetTeam(eventPlayer, mod.GetTeam(1)); updateTeamSwitchButtonState(eventPlayer); setTeamSwitchPanelVisible(eventPlayer, false); void forceUndeployPlayer(eventPlayer); return; }

    const isTeam2Click = clickedName === ui.team2ButtonName || clickedName === ui.team2TextName || (!!t2Button && mod.Equals(eventUIWidget, t2Button)) || widgetOrAncestorMatchesName(eventUIWidget, [ui.team2ButtonName, ui.team2TextName]);
    if (isTeam2Click) { if (!isButtonUp) return; mod.SetTeam(eventPlayer, mod.GetTeam(2)); updateTeamSwitchButtonState(eventPlayer); setTeamSwitchPanelVisible(eventPlayer, false); void forceUndeployPlayer(eventPlayer); }
}

export function OnPlayerSwitchTeam(eventPlayer: mod.Player, eventTeam: mod.Team) {
    updateTeamSwitchButtonState(eventPlayer);
}

export function OngoingPlayer(eventPlayer: mod.Player) {
    if (!eventPlayer || !mod.IsPlayerValid(eventPlayer)) return;

    if (InteractMultiClickDetector.checkMultiClick(eventPlayer)) {
        const id = mod.GetObjId(eventPlayer);
        const ui = playerTeamSwitchUiMap.get(id);
        if (ui) {
            setTeamSwitchTapDebugText(eventPlayer, mod.Message(mod.stringkeys.TEAM_SWITCH_DEBUG_TRIPLE));
            setTeamSwitchPanelVisible(eventPlayer, !ui.panelVisible);
        }
    }

    const id = mod.GetObjId(eventPlayer);
    const ui = playerTeamSwitchUiMap.get(id);
    if (ui) {
        const progress = InteractMultiClickDetector.getTapProgress(eventPlayer);
        if (progress !== ui.lastDebugTapCount && progress > 0) {
            ui.lastDebugTapCount = progress;
            setTeamSwitchTapDebugText(eventPlayer, mod.Message(mod.stringkeys.TEAM_SWITCH_DEBUG_TAP, progress));
        } else if (progress === 0 && ui.lastDebugTapCount !== 0) {
            ui.lastDebugTapCount = 0;
        }
        if (ui.panelVisible && mod.GetMatchTimeElapsed() - ui.panelOpenedAt > 15) {
            setTeamSwitchPanelVisible(eventPlayer, false);
            setTeamSwitchTapDebugText(eventPlayer, mod.Message(mod.stringkeys.TEAM_SWITCH_DEBUG_TIMEOUT));
        }
    }

    if (isPlayerLikelyDeployed(eventPlayer)) { ensureTeamSwitchInteractPoint(eventPlayer); }
    else { removeTeamSwitchInteractPoint(eventPlayer); }

    // Lazy init: if player wasn't initialized yet, do it now
    if (!playerTeamSwitchUiMap.has(mod.GetObjId(eventPlayer))) {
        initializePlayerState(eventPlayer);
    }

    updateRadar(eventPlayer);
}

export function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {}
export function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {}

export function OnPlayerInteract(eventPlayer: mod.Player, eventInteractPoint: mod.InteractPoint) {
    const id = mod.GetObjId(eventPlayer);
    const ui = playerTeamSwitchUiMap.get(id);
    if (!ui || !ui.interactPoint) return;
    if (mod.GetObjId(eventInteractPoint) !== mod.GetObjId(ui.interactPoint)) return;
    processInteractTap(eventPlayer);
}