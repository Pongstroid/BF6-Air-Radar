/**
 * -------------------------------------------------------------------------
 * Airsup_v1_34 Radar Hotfix
 * -------------------------------------------------------------------------
 * Date: 2026
 * Authors: LongLiveBF4 (@iamnotdrell)
 *
 * Description:
 * This hotfix modifies the radar system to improve gameplay behavior
 * and reduce radar clutter.
 *
 * Changes Implemented:
 *
 * 1. Radar Creation Restriction
 *    - Radar UI is now created ONLY when a player enters an air vehicle.
 *    - Radar is removed when the player exits the air vehicle.
 *    - Prevents radar from appearing while on foot or in ground vehicles.
 *
 * 2. Radar Detection Filtering
 *    - Radar now detects ONLY vehicles.
 *    - Infantry players are ignored.
 *    - This reduces visual noise and improves radar relevance.
 *
 * 3. Radar Update Safety Check
 *    - Radar update logic now runs only while the player is inside
 *      a supported air vehicle.
 *    - Prevents unnecessary calculations when radar should not be active.
 *
 * Files / Functions Modified:
 *
 *    initializePlayerState()
 *        - Removed automatic radar creation.
 *
 *    OnPlayerEnterVehicle()
 *        - Added radar creation for supported air vehicles.
 *
 *    OnPlayerExitVehicle()
 *        - Added radar destruction when leaving air vehicles.
 *
 *    updateRadar()
 *        - Added vehicle-only detection filter.
 *        - Added safety check to ensure radar runs only in aircraft.
 *
 * Notes:
 * - Radar UI layout and rendering logic were not modified.
 * - Radar math and positioning remain unchanged.
 * - This change focuses only on activation conditions and target filtering.
 * - Portions of this hotfix were developed with the assistance of a
 *   generative AI coding assistant (ChatGPT, based on OpenAI GPT-5.3).
 */

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

