import { MODULE_NAME } from "./lib.js";
import { updateChallengeDie } from "./challenge-die.js";
import { updateInitiative } from "./initiative.js";
import { setupMana } from "./mana-points.js";

//CONFIG.debug.hooks = true;

Hooks.once('init', async function() {
  // lib-wrapper required
  if(!game.modules.get('lib-wrapper')?.active && game.user.isGM) {
    ui.notifications.error(`Module ${MODULE_NAME} requires the 'libWrapper' module. Please install and activate it.`);
  }

  console.log(`${MODULE_NAME} init`);
  updateChallengeDie();
  updateInitiative();
  setupMana();
});

Hooks.once('ready', async function() {
  console.log(`${MODULE_NAME} ready`);
});
