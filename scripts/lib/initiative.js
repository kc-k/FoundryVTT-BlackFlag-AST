/* <><><><> <><><><> <><><><> <><><><> */
/*           Data Preparation          */
/* <><><><> <><><><> <><><><> <><><><> */

/**
 * Calculate the derived data on initiative.
 */
function blackFlagAPComputeInitiative() {
	const init = this.attributes.initiative ??= {};
	init.ability ||= CONFIG.BlackFlag.defaultAbilities.initiative;
	const ability = this.abilities[init.ability[0]];
	const secondaryAbility = this.abilities[init.ability[1]];

	init.proficiency = new BlackFlag.documents.Proficiency(
		this.attributes.proficiency,
		init.proficiency.multiplier,
		init.proficiency.rounding
	);

	const initiativeData = [
		{ type: "ability-check", ability: init.ability[0], proficiency: init.proficiency.multiplier },
		{ type: "ability-check", ability: init.ability[1], proficiency: init.proficiency.multiplier },
		{ type: "initiative", proficiency: init.proficiency.multiplier }
	];
	init.modifiers = {
		_data: initiativeData,
		bonus: this.getModifiers(initiativeData),
		min: this.getModifiers(initiativeData, "min"),
		note: this.getModifiers(initiativeData, "note")
	};
	init.bonus = this.buildBonus(init.modifiers.bonus, {
		deterministic: true, rollData: this.parent.getRollData({deterministic: true})
	});

	init.mod = (ability?.mod ?? 0) + (secondaryAbility?.mod ?? 0) + init.proficiency.flat + init.bonus;
}

/* <><><><> <><><><> <><><><> <><><><> */
/*               Helpers               */
/* <><><><> <><><><> <><><><> <><><><> */

/** @override */
function blackFlagAPGetInitiativeRollConfig(options = {}) {
	const init = this.attributes?.initiative ?? {};
	const abilityKey = init.ability ?? CONFIG.BlackFlag.defaultAbilities.initiative;
	const ability = this.abilities?.[abilityKey[0]] ?? {};
	const secondaryAbility = this.abilities[init.ability[1]];

	const rollConfig = {
		rolls: [
			{
				...BlackFlag.utils.buildRoll(
					{
						mod: ability.mod,
						mod2: secondaryAbility.mod,
						prof: init.proficiency?.hasProficiency ? init.proficiency.term : null,
						bonus: this.buildBonus?.(this.getModifiers?.(init.modifiers?._data)),
						tiebreaker:
							game.settings.get(game.system.id, "initiativeTiebreaker") && ability ? ability.value / 100 : null
					},
					this.parent.getRollData()
				),
				options: foundry.utils.mergeObject(
					{
						minimum: this.buildMinimum?.(this.getModifiers?.(init.modifiers?._data, "min"))
					},
					options
				)
			}
		]
	};

	return rollConfig;
}

function updateInitiative() {
  console.log("BLACKFLAG-AP override default initiative ability");
  CONFIG.BlackFlag.defaultAbilities.initiative = [CONFIG.BlackFlag.defaultAbilities.initiative, "wisdom"]

  // start libwrapper overrides
  console.log("BLACKFLAG-AP override initiative calculation");
  // Why doesn't this work? Fine, I'll patch the child classes directly...
  //libWrapper.register('BlackFlag-AP',
  //  'BlackFlag.data.actor.InitiativeTemplate.prototype.computeInitiative',
  //  blackFlagAPComputeInitiative, 'OVERRIDE'
  //);
  //libWrapper.register('BlackFlag-AP',
  //  'BlackFlag.data.actor.InitiativeTemplate.prototype.getInitiativeRollConfig',
  //  blackFlagAPGetInitiativeRollConfig, 'OVERRIDE'
  //);
  libWrapper.register('BlackFlag-AP',
    'BlackFlag.data.actor.PCData.prototype.computeInitiative',
    blackFlagAPComputeInitiative, 'OVERRIDE'
  );
  libWrapper.register('BlackFlag-AP',
    'BlackFlag.data.actor.NPCData.prototype.computeInitiative',
    blackFlagAPComputeInitiative, 'OVERRIDE'
  );
  libWrapper.register('BlackFlag-AP',
    'BlackFlag.data.actor.PCData.prototype.getInitiativeRollConfig',
    blackFlagAPGetInitiativeRollConfig, 'OVERRIDE'
  );
  libWrapper.register('BlackFlag-AP',
    'BlackFlag.data.actor.NPCData.prototype.getInitiativeRollConfig',
    blackFlagAPGetInitiativeRollConfig, 'OVERRIDE'
  );
  // without libwrapper (for easier testing)
  //BlackFlag.data.actor.PCData.prototype.computeInitiative = blackFlagAPComputeInitiative;
  //BlackFlag.data.actor.PCData.prototype.getInitiativeRollConfig = blackFlagAPGetInitiativeRollConfig;
  //BlackFlag.data.actor.InitiativeTemplate.prototype.computeInitiative = blackFlagAPComputeInitiative;
  //BlackFlag.data.actor.InitiativeTemplate.prototype.getInitiativeRollConfig = blackFlagAPGetInitiativeRollConfig;
}

export { updateInitiative }
