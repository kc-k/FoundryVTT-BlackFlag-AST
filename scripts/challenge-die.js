import { MODULE_NAME } from "./lib.js";
import { MODULE_SHORT } from "./lib.js";

/**
 * Primary die used when performing a challenge roll.
 * Copied and modified from BlackFlag system
 */
class BlackFlagASTChallengeDie extends BlackFlag.dice.ChallengeDie {
	constructor({ number = 2, faces = 10, ...args } = {}) {
		super({ number, faces, ...args });
	}

	/* ~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~ */

	/**
	 * Critical success target if no critical failure is set in options.
	 * @type {number}
	 */
	static CRITICAL_SUCCESS_TOTAL = 18;

	/* ~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~ */

	/**
	 * Critical failure target if no critical failure is set in options.
	 * @type {number}
	 */
	static CRITICAL_FAILURE_TOTAL = 4;

	/* ~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~ */

	/**
	 * Is this a valid challenge die?
	 * @type {boolean}
	 */
	get isValid() {
		return this.faces === 10;
	}

	/* ~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~-~ */

	/**
	 * Apply advantage mode to this die.
	 * @param {number} advantageMode - Advantage mode to apply, defined by {@link ChallengeRoll#MODES}.
	 */
	applyAdvantage(advantageMode) {
		this.options.advantageMode = advantageMode;
		if (advantageMode !== this.constructor.MODES.NORMAL) {
			this.number += 1;
			this.modifiers.push(advantageMode === this.constructor.MODES.ADVANTAGE ? `kh${this.number - 1}` : `kl${this.number - 1}`);
		}
    }
}


export function updateChallengeDie() {
  game.settings.register(MODULE_NAME, `enable2d10`, {
    name: game.i18n.format(`${MODULE_SHORT}.settings.enable2d10.label`),
    hint: game.i18n.format(`${MODULE_SHORT}.settings.enable2d10.hint`),
    scope: "world",
    config: true,
    requiresReload: true,
    default: true,
    type: Boolean
  });
  if (game.settings.get(MODULE_NAME, "enable2d10")) {
    console.log(`${MODULE_NAME} override ChallengeDie`);
    CONFIG.Dice.ChallengeDie = BlackFlagASTChallengeDie;
  }
}
