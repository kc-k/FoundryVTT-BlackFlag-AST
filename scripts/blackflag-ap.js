import { updateChallengeDie } from "./lib/challenge-die.js";
import { updateInitiative } from "./lib/initiative.js";

Hooks.once('init', async function() {
  // lib-wrapper required
  if(!game.modules.get('lib-wrapper')?.active && game.user.isGM) {
    ui.notifications.error("Module BlackFlag-AP requires the 'libWrapper' module. Please install and activate it.");
  }

  console.log("BLACKFLAG-AP init");
  updateChallengeDie();
  updateInitiative();
});

Hooks.once('ready', async function() {
  console.log("BLACKFLAG-AP ready");
});
