import { updateChallengeDie } from "./lib/challenge-die.js";
import { updateInitiative } from "./lib/initiative.js";
import { MODULE_NAME } from "./lib/lib.js";

//CONFIG.debug.hooks = true;

Hooks.once('init', async function() {
  // lib-wrapper required
  if(!game.modules.get('lib-wrapper')?.active && game.user.isGM) {
    ui.notifications.error(`Module ${MODULE_NAME} requires the 'libWrapper' module. Please install and activate it.`);
  }

  console.log(`${MODULE_NAME} init`);
  updateChallengeDie();
  updateInitiative();
});

Hooks.once('ready', async function() {
  console.log(`${MODULE_NAME} ready`);
});
