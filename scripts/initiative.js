import { MODULE_NAME } from "./lib.js";
import { MODULE_SHORT } from "./lib.js";

/* <><><><> <><><><> <><><><> <><><><> */
/*           Data Preparation          */
/* <><><><> <><><><> <><><><> <><><><> */

/**
 * Calculate the derived data on initiative.
 */
function blackFlagASTComputeInitiative() {
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
function blackFlagASTGetInitiativeRollConfig(options = {}) {
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

function initiativeSettings () {
  game.settings.register(MODULE_NAME, `overrideInitiative`, {
    name: game.i18n.format(`${MODULE_SHORT}.settings.overrideInitiative.label`),
    hint: game.i18n.format(`${MODULE_SHORT}.settings.overrideInitiative.hint`),
    scope: "world",
    config: true,
    requiresReload: true,
    default: true,
    type: Boolean
  });
  // TODO allow overriding initiative config (specify which abilities / custom formula)
  //game.settings.register(MODULE_NAME, `overrideInitiativeAbilities`, {
  //  name: game.i18n.format("blackflag-AST.overrideInitiativeAbilities"),
  //  scope: "world",
  //  config: true,
  //  default: true,
  //  type: Boolean
  //});
}

export function updateInitiative() {
  initiativeSettings();
  if (game.settings.get(MODULE_NAME, "overrideInitiative")) {
    console.log(`${MODULE_NAME} override default initiative ability`);
    CONFIG.BlackFlag.defaultAbilities.initiative = [CONFIG.BlackFlag.defaultAbilities.initiative, "wisdom"];
    // TODO allow overriding initiative config (specify which abilities / custom formula)
    //CONFIG.BlackFlag.defaultAbilities.initiative = game.settings.get(MODULE_NAME, "overrideInitiativeAbilities");

    // start libwrapper overrides
    console.log(`${MODULE_NAME}  override initiative calculation`);
    // Why doesn't this work? Fine, I'll patch the child classes directly...
    //libWrapper.register(MODULE_NAME,
    //  'BlackFlag.data.actor.InitiativeTemplate.prototype.computeInitiative',
    //  blackFlagASTComputeInitiative, 'OVERRIDE'
    //);
    //libWrapper.register(MODULE_NAME,
    //  'BlackFlag.data.actor.InitiativeTemplate.prototype.getInitiativeRollConfig',
    //  blackFlagASTGetInitiativeRollConfig, 'OVERRIDE'
    //);
    libWrapper.register(MODULE_NAME,
        'BlackFlag.data.actor.PCData.prototype.computeInitiative',
        blackFlagASTComputeInitiative, 'OVERRIDE'
    );
    libWrapper.register(MODULE_NAME,
        'BlackFlag.data.actor.NPCData.prototype.computeInitiative',
        blackFlagASTComputeInitiative, 'OVERRIDE'
    );
    libWrapper.register(MODULE_NAME,
        'BlackFlag.data.actor.PCData.prototype.getInitiativeRollConfig',
        blackFlagASTGetInitiativeRollConfig, 'OVERRIDE'
    );
    libWrapper.register(MODULE_NAME,
        'BlackFlag.data.actor.NPCData.prototype.getInitiativeRollConfig',
        blackFlagASTGetInitiativeRollConfig, 'OVERRIDE'
    );
    // without libwrapper (for easier testing)
    //BlackFlag.data.actor.PCData.prototype.computeInitiative = blackFlagASTComputeInitiative;
    //BlackFlag.data.actor.PCData.prototype.getInitiativeRollConfig = blackFlagASTGetInitiativeRollConfig;
    //BlackFlag.data.actor.InitiativeTemplate.prototype.computeInitiative = blackFlagASTComputeInitiative;
    //BlackFlag.data.actor.InitiativeTemplate.prototype.getInitiativeRollConfig = blackFlagASTGetInitiativeRollConfig;
  }
}
