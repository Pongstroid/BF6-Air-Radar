function initializePlayerState(player: mod.Player) {

    // Initialize scoreboard stats
    mod.SetVariable(mod.ObjectVariable(player, playerKills), 0);
    mod.SetVariable(mod.ObjectVariable(player, playerDeaths), 0);
    mod.SetVariable(mod.ObjectVariable(player, playerCaptures), 0);
    mod.SetVariable(mod.ObjectVariable(player, playerScore), 0);

    updatePlayerScoreBoard(player);

    // Create the team switch UI
    createTeamSwitchUi(player);

    // Spawn the interact point used for triple-tap team switching
    ensureTeamSwitchInteractPoint(player);

    // IMPORTANT:
    // Radar is NO LONGER created here.
    // It will instead be created ONLY when the player enters an air vehicle.
}

export function OnPlayerEnterVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {

    // Check if the vehicle is one of the supported jet aircraft
    // (F16, F22, JAS39, SU57 from checkIsJet())
    if (checkIsJet(eventVehicle)) {

        // Create the radar UI for this player
        // This ensures radar only appears when flying aircraft
        createRadarForPlayer(eventPlayer);

    }
}

export function OnPlayerExitVehicle(eventPlayer: mod.Player, eventVehicle: mod.Vehicle) {

    // If the player leaves a jet aircraft,
    // remove all radar UI widgets
    if (checkIsJet(eventVehicle)) {

        destroyRadarWidgets();

    }
}

const other = mod.ValueInArray(allPlayers, e);

// Skip self
if (other === eventPlayer) continue;

// Radar should only detect vehicles
// Infantry players are ignored
if (!mod.GetSoldierState(other, mod.SoldierStateBool.IsInVehicle)) continue;

// Get the vehicle the player is using
const otherVeh = mod.GetVehicleFromPlayer(other);

// Safety check
if (otherVeh == null) continue;

