/**
 * Primary die used when performing a challenge roll.
 * Copied and modified from BlackFlag system
 */
class BlackFlagAPChallengeDie extends BlackFlag.dice.ChallengeDie {
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


function updateChallengeDie() {
  console.log("BLACKFLAG-AP override ChallengeDie");
  CONFIG.Dice.ChallengeDie = BlackFlagAPChallengeDie;
}

export { updateChallengeDie }
