import { MODULE_NAME } from "./lib.js";

export const ITEM_ID = 'TpcB4d7o34UOWenr';
export const COMPENDIUM_SOURCE_ID = `Compendium.${MODULE_NAME}.blackflag-ap-items.Item.${ITEM_ID}`;
const SPELL_PROG_LOC = "CONFIG.BlackFlag.spellcastingTypes.leveled.progression";

function manaSettings () {
  game.settings.register(MODULE_NAME, `enableMana`, {
    name: game.i18n.format("blackflag-ap.enableMana"),
    scope: "world",
    config: true,
    requiresReload: true,
    default: true,
    type: Boolean
  });
  // Setup the default settings object that things can reference
  game.settings.register(MODULE_NAME, "settings", {
    name: game.i18n.format("blackflag-ap.enableMana"),
    scope: "world",
    default: ManaPoints.defaultSettings,
    type: Object,
    config: false,
    //onChange: (x) => window.location.reload()
  });
  game.settings.register(MODULE_NAME, `chatMessagePrivate`, {
    name: game.i18n.format("blackflag-ap.enableMana"),
    scope: "world",
    config: true,
    requiresReload: false,
    choices: {
        "None": "None",
        "GM": "GM",
        "All": "All"
    },
    default: "GM",
    type: String,
    onChange: (x) => game.settings.chatMessagePrivate = x
  });

}

export function setupMana() {
  manaSettings();
  if (game.settings.get(MODULE_NAME, "enableMana")) {
    /** spell launch dialog **/
    Hooks.on("renderActivityActivationDialog", async (dialog, html, formData) => {
      ManaPoints.checkDialogManaPoints(dialog, html, formData);
    })

    //Hooks.on("updateItem", ManaPoints.calculateManaPoints);
    Hooks.on("createItem", ManaPoints.calculateManaPointsCreate);
    Hooks.on("preDeleteItem", ManaPoints.removeItemFlag);
    //Hooks.on("preUpdateItem", ManaPoints.checkManaPointsValues);

    ////Hooks.on("dnd5e.computeLeveledProgression", ManaPoints.calculateManaPointsProgression);

    //Hooks.on("renderActorSheet5eCharacter", (app, html, data) => {
    //  ManaPoints.alterCharacterSheet(app, html, data);
    //});

    //Hooks.on("renderActorSheet5eNPC", (app, html, data) => {
    //  ManaPoints.alterCharacterSheet(app, html, data, 'npc');
    //});



    ///**
    //  * Hook that is triggered after the ManaPointsForm has been rendered. This
    //  * sets the visiblity of the custom formula fields based on if the current
    //  * formula is a custom formula.
    //  */
    //Hooks.on('renderManaPointsForm', (manaPointsForm, html, data) => {
    //  const isCustom = (data.isCustom || "").toString().toLowerCase() == "true"
    //  manaPointsForm.setCustomOnlyVisibility(isCustom)
    //})
    Hooks.on("blackFlag.preActivityConsumption", (item, consume, options, update) => {
      return ManaPoints.castSpell(item, consume, options, update);
    })

    //Hooks.on("renderItemSheet", async (app, html, data) => {
    //  ManaPoints.renderManaPointsItem(app, html, data);
    //})
  }
}

export class ManaPoints {
  static get settings() {
    let _settings = foundry.utils.mergeObject(this.defaultSettings, game.settings.get(MODULE_NAME, 'settings'), { insertKeys: true, insertValues: true });
    return foundry.utils.mergeObject(_settings, {chatMessagePrivate: game.settings.get(MODULE_NAME, "chatMessagePrivate")}, { insertKeys: true, insertValues: true});
  }
  /**
   * Get default settings object.
   */
  static get defaultSettings() {
    return {
      chatMessagePrivate: "GM",
      spResource: 'Mana',
      spAutoManapoints: true,
      spellManaCosts: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, 6: 9, 7: 10, 8: 11, 9: 13 },
      spUseLeveled: false,
      leveledProgressionFormula: { 1: "4", 2: "7", 3: "10", 4: "13", 5: "17", 6: "21", 7: "25", 8: "29", 9: "34", 10: "39", 11: "44", 12: "49", 13: "55", 14: "61", 15: "67", 16: "73", 17: "80", 18: "87", 19: "94", 20: "101" },
      spGmOnly: true,
      spColorL: '#3a0e5f',
      spColorR: '#8a40c7',
      spAnimateBar: true
    };
  }

  /**
   * Get a map of formulas to override values specific to those formulas.
   */
  static get formulas() {
    return {
      CUSTOM: {
        isCustom: true,
        leveledProgressionFormula: this.settings.leveledProgressionFormula,
        spCustomFormulaBase: '',
        spUseLeveled: false
      }
    }
  }

  static setSpColors() {
    document.documentElement.style.setProperty('--sp-left-color', ManaPoints.settings.spColorL);
    document.documentElement.style.setProperty('--sp-right-color', ManaPoints.settings.spColorR);
    if (ManaPoints.settings.spAnimateBar) {
      document.documentElement.style.setProperty('--sp-animation-name', 'scroll');
    } else {
      document.documentElement.style.setProperty('--sp-animation-name', 'none');
    }
  }

  static isModuleActive() {
    return game.settings.get(MODULE_NAME, 'enableMana');
  }

  static getActorFlagManaPointItem(actor) {
    const item_id = actor?.flags?.manapoints?.item;
    return typeof item_id === 'string' && item_id.trim().length > 0 ? item_id : false;
  }

  static isManaPointsItem(item) {
    return item.type === "feature" &&
      (item._stats?.compendiumSource === COMPENDIUM_SOURCE_ID);
  }

  static isMixedActorManaPointEnabled(actor) {
    return actor?.flags?.manapoints?.enabled ?? false;
  }

  /**
   * Evaluates the given formula with the given actors data. Uses FoundryVTT's Roll
   * to make this evaluation.
   * @param {string|number} formula The rollable formula to evaluate.
   * @param {object} actor The actor used for variables.
   * @return {number} The result of the formula.
   */
  static withActorData(formula, actor) {
    //console.log('rollFormula', formula);
    let dataObject = actor.getRollData();
    dataObject.flags = actor.flags;
    const r = new Roll(formula.toString(), dataObject);
    r.evaluateSync({ async: false });
    return r.total;
  }

  static getManaPointsItem(actor) {
    let items = foundry.utils.getProperty(actor, "collections.items");//  filter(u => u.isGM);

    const item_id = ManaPoints.getActorFlagManaPointItem(actor);
    if (items[item_id])
      return items[item_id];
    let features = items.filter(i => i.type == 'feature');
    // get the item with source custom label = Mana Points
    let sp = features.filter(s => this.isManaPointsItem(s));

    if (typeof sp == 'undefined') {
      return false;
    }
    return sp[0];
  }


  /**
   * The function checks if the actor has enough spell points to cast the spell
   * @param item - the Item being used
   * @param consume - resource consumption
   * @param actor - The actor that is being updated.
   * @returns The update object.
   */

  static castSpell(item, consume, options) {
    console.log('MANA CAST SPELL', item, consume, options);

    if (!consume.consume.manaPoints) {
      return [item, consume, options];
    }

    const actor = item.actor;
    /** do nothing if module is not active **/
    if (!ManaPoints.isModuleActive())
      return [item, consume, options];

    let manaPointItem = ManaPoints.getManaPointsItem(actor);
    const moduleSettings = this.settings
    let settings = moduleSettings;

    settings = manaPointItem.flags?.manapoints?.config ? manaPointItem.flags?.manapoints.config : settings;

    /** check if this is a spell casting **/
    if (!item.isSpell || !item.requiresSpellSlot) {
      return [item, consume, options];
    }

    if (consume.consume.spellSlot) {
      consume.consume.manaPoints = false;
      return [item, consume, options];
    }

    if (consume.consume.manaPoints) {
      consume.consume.spellSlot = false;
    }

    /** not found any resource for manapoints ? **/
    if (!manaPointItem) {
        actorNoSP_message = game.i18n.format(`${MODULE_NAME}.mana.actorNoManaPoints`, { ActorName: actor.name, ManaPoints: moduleSettings.spResource });
        createNewResource_message = game.i18n.format(`${MODULE_NAME}.mana.createManaPointsResource`, { ManaPoints: moduleSettings.spResource });
      ChatMessage.create({
        content: "<i style='color:red;'>" + actorNoSP_message + "</i>",
        speaker: ChatMessage.getSpeaker({ alias: actor.name })
      });
      ui.notifications.error(createNewResource_message);
      return false;
    }

    /** find the spell level just cast */
    const spellLvl = item.item.system.circle.value ??= item.item.system.circle.base;

    let actualManaPoints = manaPointItem.system.uses.value;

    /* get spell cost in manapoints */
    const manaPointCost = this.withActorData(settings.spellManaCosts[spellLvl], actor);

    /** check if message should be visible to all or just player+gm */
    let speakTo;
    if (moduleSettings.chatMessagePrivate == "GM") {
      speakTo = game.users.filter(u => u.isGM);
    } else if (moduleSettings.chatMessagePrivate == "All") {
      speakTo = [];
    }

    let updateItem = {
      'system': {
        'uses': {}
      }
    };

    /** update manapoints **/
    if (actualManaPoints - manaPointCost < 0) {
      if (speakTo !== undefined) {
        ChatMessage.create({
          content: "<i style='color:red;'>" + game.i18n.format(`${MODULE_NAME}.mana.notEnoughMana`, { ActorName: actor.name, ManaPoints: moduleSettings.spResource }) + "</i>",
          speaker: ChatMessage.getSpeaker({ alias: actor.name }),
          isContentVisible: false,
          isAuthor: true,
          whisper: speakTo
        });
      }
      consume.consumeSpellSlot = false;
      consume.consumeSpellLevel = false;
      consume.createMeasuredTemplate = false;
      options.createMessage = false;
      delete options.flags;
      ui.notifications.error("Not Enough Mana");
      return false;
    }

    /* character has enough manapoints */
    consume.consumeSpellLevel = false;
    consume.consumeSpellSlot = false;
    let newManaPointUses = manaPointItem.system.uses.value - manaPointCost;
    updateItem.system.uses = { value: newManaPointUses, spent: manaPointItem.system.uses.max - newManaPointUses };
    manaPointItem.update(updateItem);


    if (speakTo !== undefined) {
      ChatMessage.create({
        content: "<i style='color:green;'>" + game.i18n.format(`${MODULE_NAME}.mana.spellUsingManaPoints`,
          {
            ActorName: actor.name,
            ManaPoints: moduleSettings.spResource,
            manaPointUsed: manaPointCost,
            remainingPoints: manaPointItem.system.uses.value
          }) + "</i>",
        speaker: ChatMessage.getSpeaker({ alias: actor.name }),
        isContentVisible: false,
        isAuthor: true,
        whisper: speakTo
      });
    }

    return [item, consume, options];
  }

  /**
   * It checks if the spell is being cast by a player character, and if so, it replaces the spell slot
   * dropdown with a list of spell point costs, and adds a button to the dialog that will cast the
   * spell if the spell point cost is available
   * @param dialog - The dialog object.
   * @param html - The HTML element of the dialog.
   * @param formData - The data that was submitted by the user.
   * @returns the value of the variable `level`
   */
  static async checkDialogManaPoints(dialog, html, formData) {
    if (!ManaPoints.isModuleActive())
      return;

    /** check if actor is a player character **/
    let actor = foundry.utils.getProperty(dialog, "activity.item.actor");

    // Declare settings as a separate variable because jQuery overrides `this` when in an each() block
    let settings = this.settings;

    /** check if this is a spell **/
    if (foundry.utils.getProperty(dialog, "activity.item.type") !== "spell")
      return;

    html.addClass('manapoints-cast');

    const spell = dialog.activity.item.system;

    // spell level can change later if casting it with a greater slot, baseSpellLvl is the default
    const baseSpellLvl = spell.circle.base;

    /** get manapoints **/
    let manaPointItem = ManaPoints.getManaPointsItem(actor);
    if (manaPointItem && manaPointItem.flags?.manapoints?.override) {
      settings = isset(manaPointItem.flags?.manapoints?.config) ? manaPointItem.flags?.manapoints?.config : settings;
    }

    if (!manaPointItem) {
      // this actor has no spell point resource what to do?
      /*let messageCreate;
      messageCreate = game.i18n.format("dnd5e-manapoints.pleaseCreateV3", { ManaPoints: this.settings.spResource });
      $('#ability-use-form', html).append('<div class="spError">' + messageCreate + '</div>'); */
      return;
    }

    let level = 'none';
    let cost = 0;

    /** Replace list of spell slots with list of spell point costs **/
    $('select[name="spell.slot"] option', html).each(function () {
      let selectValue = $(this).val();

      level = selectValue.replace('circle-', '');
      //console.log('LEVEL', level);
      cost = ManaPoints.withActorData(ManaPoints.settings.spellManaCosts[level], actor);

      let costTextLookup = game.i18n.format(`${MODULE_NAME}.mana.spellCost`, { amount: cost, ManaPoints: manaPointItem.name });
      let newText = `${CONFIG.BlackFlag.spellCircles()[level]} (${costTextLookup})`;
      $(this).text(newText);
    })

    const consumeString = game.i18n.format(`${MODULE_NAME}.mana.consumeSpellSlotInput`, { ManaPoints: manaPointItem.name });
    let consumeInput = $('input[name="consume.spellSlot"]', html).parents('fieldset');
    consumeInput.append('<label class="full-checkbox"><span>' + consumeString + '</span><input type="checkbox" name="consume.manaPoints"></label>');
    /** TODO shouldn't have to do this, instead hook into the activity config directly, replacing this whole hook 
     *   set consume.manaPoints to true on undefined because after this is when it first shows up in the config, so
     *   rerenders now have the value **/
    if (dialog.config.consume?.manaPoints == undefined) {
      $('input[name="consume.spellSlot"]', html).attr('checked', false);
    }
    if (dialog.config.consume?.manaPoints == undefined || dialog.config.consume?.manaPoints == true) {
      $('input[name="consume.manaPoints"]', html).attr('checked', true);
    }
    /** shouldn't have to do this, instead hook into the activity config directly **/

    if (level == 'none')
      return;

    /** Calculate spell point cost and warn user if they have none left */
    let manaPointCost = 0;
    let actualManaPoints = manaPointItem.system.uses.max - manaPointItem.system.uses.spent;

    manaPointCost = ManaPoints.withActorData(ManaPoints.settings.spellManaCosts[baseSpellLvl], actor);
    const missing_points = (typeof actualManaPoints === 'undefined' || actualManaPoints - manaPointCost < 0);
    if (missing_points) {
      const messageNotEnough = game.i18n.format(`{MODULE_NAME}.mana.youNotEnough`, { ManaPoints: manaPointItem.name });
      $('#ability-use-form', html).append('<div class="spError">' + messageNotEnough + '</div>');
    }

    // FIXME this doesn't seem to be needed in ToTV like was needed in 5e?
      // Also really should see about moving all of this logic into the dialog box
      // configuration instead of the activity rendering
    //let copyButton = $('.dialog-button', html).clone();
    //$('.dialog-button', html).addClass('original').hide();
    //copyButton.addClass('copy').removeClass('use').attr('data-button', '');
    //$('.dialog-buttons', html).append(copyButton);

    //html.on('click', '.dialog-button.copy', function (e) {
    //  e.preventDefault();
    //  /** if not consumeSlot we ignore cost, go on and cast **/
    //  if (!$('input[name="consume.manaPoints"]', html).prop('checked')) {
    //    $('.dialog-button.original', html).trigger("click");
    //  } else if ($('select[name="spell.slot"]', html).length > 0) {
    //    if (missing_points) {
    //      ui.notifications.error(messageNotEnough);
    //      dialog.close();
    //    } else {
    //      $('.dialog-button.original', html).trigger("click");
    //    }
    //  }
    //})
  }

  /**
   * Calculates the maximum spell points for an actor based on custom formulas.
   * @param {object} actor The actor used for variables.
   * @param {object} settings configuration from module or item ovveride
   * @return {number} The calculated maximum spell points.
   */
  static _calculateManaPointsCustom(actor, settings) {
    let ManaPointsMax = ManaPoints.withActorData(settings.spCustomFormulaBase, actor);

    let hasSpellSlots = false;
    let manaPointsFromSlots = 0;
    for (let [slotLvlTxt, slot] of Object.entries(actor.system.spells)) {
      let slotLvl;
      if (slotLvlTxt == 'pact') {
        slotLvl = slot.level;
      } else {
        slotLvl = parseInt(slotLvlTxt.replace(/\D/g, ''));
      }

      if (!slotLvl || slotLvl == 0) {
        continue;
      }

      manaPointsFromSlots += slot.max * ManaPoints.withActorData(settings.manaPointsCosts[slotLvl], actor);
      if (slot.max > 0) {
        hasSpellSlots = true;
      }
    }

    if (!hasSpellSlots) {
      return 0;
    }

    ManaPointsMax += manaPointsFromSlots * ManaPoints.withActorData(settings.spCustomFormulaSlotMultiplier, actor);

    return ManaPointsMax;
  }

  /**
   * Calculates the maximum spell points for an actor based on a fixed map of
   * spellcasting level to maximum spell points. Builds up a total spellcasting
   * level based on the level of each spellcasting class according to
   * Multiclassing rules.
   * @param {object} item The class item of the actor.
   * @param {object} updates The details of how the class item was udpated.
   * @param {object} actor The actor used for variables.
   * @return {number} The calculated maximum spell points.
   */
  static _calculateManaPointsFixed(item, updates, actor, settings) {
    /* not an update? **/
    let changedClassLevel = null;
    let changedClassID = null;
    let levelUpdated = false;
    const leveledProgression = settings.spUseLeveled;

    if (foundry.utils.getProperty(updates.system, 'levels')) {
      changedClassLevel = foundry.utils.getProperty(updates.system, 'levels');
      changedClassID = foundry.utils.getProperty(item, '_id');
      levelUpdated = true;
    }
    // check for multiclasses
    const actorClasses = actor.items.filter(i => i.type === "class");

    let spellcastingClassCount = 0;
    const spellcastingLevels = {
      full: [],
      half: [],
      artificer: [],
      third: [],
      pact: [],
    }

    for (let c of actorClasses) {
      /* spellcasting: pact; full; half; third; artificier; none; **/
      let spellcasting = c.system.spellcasting.progression;
      if (spellcasting == 'none') {
        // check subclasses
        let subclass = c.subclass;
        spellcasting = subclass.system.spellcasting.progression;
      }

      let level = c.system.levels;

      // get updated class new level
      if (levelUpdated && c._id == changedClassID)
        level = changedClassLevel;

      if (spellcastingLevels[spellcasting] != undefined) {
        spellcastingLevels[spellcasting].push(level);
        spellcastingClassCount++;
      }

    }


    let totalSpellcastingLevel = 0
    totalSpellcastingLevel += spellcastingLevels['full'].reduce((sum, level) => sum + level, 0);
    totalSpellcastingLevel += spellcastingLevels['pact'].reduce((sum, level) => sum + level, 0);
    totalSpellcastingLevel += spellcastingLevels['artificer'].reduce((sum, level) => sum + Math.ceil(level / 2), 0);
    // Half and third casters only round up if they do not multiclass into other spellcasting classes and if they
    // have enough levels to obtain the spellcasting feature.
    if (spellcastingClassCount == 1 && (spellcastingLevels['half'][0] >= 2 || spellcastingLevels['third'][0] >= 3)) {
      totalSpellcastingLevel += spellcastingLevels['half'].reduce((sum, level) => sum + Math.ceil(level / 2), 0);
      totalSpellcastingLevel += spellcastingLevels['third'].reduce((sum, level) => sum + Math.ceil(level / 3), 0);
    } else {
      totalSpellcastingLevel += spellcastingLevels['half'].reduce((sum, level) => sum + Math.floor(level / 2), 0);
      totalSpellcastingLevel += spellcastingLevels['third'].reduce((sum, level) => sum + Math.floor(level / 3), 0);
    }

    if (totalSpellcastingLevel == 0)
      return 0;

    if (leveledProgression) {
      return parseInt(this.withActorData(settings.leveledProgressionFormula[totalSpellcastingLevel], actor)) || 0;
    }

    return parseInt(settings.manaPointsByLevel[totalSpellcastingLevel]) || 0
  }

  /**
   * ** on updateItem hook applied only if changing a class item **
   * If the module is active, the actor is a character, and the actor has a spell point resource, then
   * update the spell point resource's maximum value
   * @param item - The item that was updated.
   * @param updates - The updates that are being applied to the item.
   */
  static calculateManaPoints(item, updates, id) {
    const actor = item.parent;

    if (!ManaPoints.isModuleActive())
      return [item, updates, id];

    if (!ManaPoints.settings.spAutoManapoints) {
      return [item, updates, id];
    }

    /* updating or dropping a class item */

    if (item.type !== 'class') {
      // check if is the spell point feature being dropped.
      return [item, updates, id];
    }

    if (!foundry.utils.getProperty(updates.system, 'levels'))
      return [item, updates, id];

    ManaPoints.updateManaPointsMax(item, updates, actor, false);
    return [item, updates, id];
  }

  static processFirstDrop(item) {
    if (ManaPoints.getActorFlagManaPointItem(item.parent)) {
      // there is already a manapoints item here.
      ui.notifications.error(game.i18n.format("BlackFlag-AP.mana.alreadySpItemOwned"));
      item.update({
        'name': item.name + ' (' + game.i18n.format("BlackFlag-AP.mana.duplicated") + ')'
      });
      return;
    }

    const actor = item.parent;
    if (actor == null)
      return;

    let updateActor = {
      'flags': {
        'manapoints': {
          'item': item._id
        }
      }
    };
    actor.update(updateActor);
    ManaPoints.updateManaPointsMax({}, {}, actor, item)
  }

  static calculateManaPointsCreate(item, updates, id) {
    if (item.type == 'feature' && ManaPoints.isManaPointsItem(item)) {
      ManaPoints.processFirstDrop(item);
      return true;
    }
  }

  static updateManaPointsMax(classItem, updates, actor, createdItem) {
    const actorName = actor.name;
    let manaPointsItem;
    if (createdItem)
      manaPointsItem = createdItem;
    else
      manaPointsItem = ManaPoints.getManaPointsItem(actor);
    if (!manaPointsItem) {
      // spell points item not found?
      return;
    }

    let settings;
    if (manaPointsItem.flags?.manapoints?.override) {
      settings = foundry.utils.mergeObject(ManaPoints.settings, manaPointsItem.flags.manapoints.config, { overwrite: true, recursive: true });
    } else {
      settings = ManaPoints.settings;
    }

    if (!settings.spAutoManapoints) {
      return true;
    }

    const isCustom = settings.isCustom;
    const spUseLeveled = settings.spUseLeveled;
    const ManaPointsMax = isCustom && !spUseLeveled ? ManaPoints._calculateManaPointsCustom(actor, settings) : ManaPoints._calculateManaPointsFixed(classItem, updates, actor, settings)

    if (ManaPointsMax > 0) {
      manaPointsItem.update({
        [`system.uses.max`]: ManaPointsMax,
      });

      let speakTo = game.users.filter(u => u.isGM);
      let message = game.i18n.format("dnd5e-manapoints.manaPointsFound", { ManaPoints: (dndV3 ? manaPointsItem.name : ManaPoints.settings.spResource), Actor: actorName })
      ChatMessage.create({
        content: "<i style='color:green;'>" + message + "</i>",
        speaker: ChatMessage.getSpeaker({ alias: actorName }),
        isContentVisible: false,
        isAuthor: true,
        whisper: speakTo
      });
    }
    return manaPointsItem;
  }

  /** hook computeLeveledProgression  */
  static levelProgression(slots, actor, classItem, progression) {

  }

  /** preDeleteItem */
  static removeItemFlag(item, dialog, id) {
    let actor = item.parent;
    if (item._id == ManaPoints.getActorFlagManaPointItem(actor)) {
      actor.update({ [`flags.manapoints.item`]: '' });
    }
  }

  /** pre update item */
  /** check if max uses is less than value */
  static checkManaPointsValues(item, update, difference, id) {
    if (ManaPoints.isManaPointsItem(item)) {
      let max, value;
      let changed_uses = false;
      // check if changed the item uses prevent value exceed max
      if (update.system?.uses?.max) {
        max = update.system.uses.max;
        changed_uses = true;
      } else {
        max = item.system.uses.max
      }

      if (update.system?.uses?.value) {
        value = update.system.uses.value;
        changed_uses = true;
      } else {
        value = item.system.uses.value
      }

      if (changed_uses) {
        if (value > max) {
          update.system.uses.value = max
        }
      }

      //get global module settings for defaults
      const def = ManaPoints.settings;
      // store current item configuration
      let conf = isset(item.flags?.manapoints?.config) ? item.flags?.manapoints?.config : {};

      conf = foundry.utils.mergeObject(conf, def, { recursive: true, insertKeys: true, insertValues: false, overwrite: false })

      conf.isCustom = true;

      if (!isset(item.flags?.manapoints?.config)) {
        update.flags.manapoints = {
          [`config`]: item.flags?.manapoints?.override ? conf : {},
          [`override`]: item.flags?.manapoints?.override
        };
      }

      return [item, update, difference, id];
    }
  }

  /**
   * It adds a checkbox to the character sheet that allows the user to enable/disable spell points for
   * the character
   * @param app - The application object.
   * @param html - The HTML of the Actor sheet.
   * @param data - The data object passed to the sheet.
   * @returns The return value is the html_checkbox variable.
   */
  static async alterCharacterSheet(app, html, data, type) {
    if (!this.isModuleActive() || data.actor.type != "character") {
      return;
    }
    const actor = data.actor;
    const ManaPointsItem = this.getManaPointsItem(actor);
    if (ManaPointsItem) {
      const value = ManaPointsItem.system.uses.value;
      const max = ManaPointsItem.system.uses.max;
      let percent = value / max * 100 > 100 ? 100 : value / max * 100;
      const template_data = {
        'editable': data.editable,
        'name': ManaPointsItem.name,
        '_id': ManaPointsItem._id,
        'max': max,
        'value': value,
        'percent': percent,
      }
      const template_file = "modules/dnd5e-manapoints/templates/spell-points-sheet-tracker.hbs";
      const rendered_html = await renderTemplate(template_file, template_data);

      $('.sidebar .stats', html).append(rendered_html);

      $('.config-button.manaPoints').off('click').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        let config = new ActorManaPointsConfig(ManaPointsItem);
        config?.render(true);
      });
    }
  }

  static async renderManaPointsItem(app, html, data) {
    const item = data?.item;
    if (this.isModuleActive() && ManaPoints.isManaPointsItem(item)) {
      // this option make the app a little more usable, we keep submit on close and submit on change for checkboxes and select
      app.options.submitOnChange = false;

      $('.item-properties', html).hide();
      if (data.editable && (game.user.isGM || ManaPoints.settings?.spGmOnly == false)) {
        let template_item = item; // data object to pass to the template
        //get global module settings for defaults
        const def = ManaPoints.settings;
        const formulas = ManaPoints.formulas;
        // store current item configuration
        let conf = isset(template_item.flags?.manapoints?.config) ? template_item.flags?.manapoints?.config : {};

        conf = foundry.utils.mergeObject(conf, def, { recursive: true, insertKeys: true, insertValues: false, overwrite: false })

        //conf.spFormula = isset(conf?.spFormula) ? conf?.spFormula : def.spFormula;
        const preset = conf.spFormula;

        conf.isCustom = isset(conf?.spFormula) ? formulas[preset].isCustom : def.isCustom;
        /*conf.spAutoManapoints = isset(conf?.spAutoManapoints) ? conf?.spAutoManapoints : def.spAutoManapoints;
        conf.spCustomFormulaBase = isset(conf?.spCustomFormulaBase) ? conf?.spCustomFormulaBase : def.spCustomFormulaBase;
        conf.spCustomFormulaSlotMultiplier = isset(conf?.spCustomFormulaSlotMultiplier) ? conf?.spCustomFormulaSlotMultiplier : def.spCustomFormulaSlotMultiplier;
        conf.spEnableVariant = isset(conf?.spEnableVariant) ? conf?.spEnableVariant : def.spEnableVariant;
        conf.manaPointsCosts = isset(conf?.manaPointsCosts) ? conf?.manaPointsCosts : def.manaPointsCosts;
        conf.manaPointsByLevel = isset(conf?.manaPointsByLevel) ? conf?.manaPointsByLevel : def.manaPointsByLevel;
        conf.spUseLeveled = isset(conf?.spUseLeveled) ? conf?.spUseLeveled : def.spUseLeveled;
        conf.leveledProgressionFormula = isset(conf?.leveledProgressionFormula) ? conf?.leveledProgressionFormula : def.leveledProgressionFormula;
        conf.spLifeCost = isset(conf?.spLifeCost) ? conf?.spLifeCost : def.spLifeCost;*/

        if (isset(conf?.previousFormula) && conf?.previousFormula != preset) {
          // changed formula preset, update manapoints default
          conf = foundry.utils.mergeObject(conf, formulas[preset], { recursive: true, overwrite: true });
          conf.previousFormula = preset;
        }

        if (!isset(template_item.flags?.manapoints?.config)) {
          template_item.flags.manapoints = {
            [`config`]: template_item.flags?.manapoints?.override ? conf : {},
            [`override`]: template_item.flags?.manapoints?.override
          };
        }

        template_item.flags.manapoints.spFormulas = Object.fromEntries(Object.keys(ManaPoints.formulas).map(formula_key => [formula_key, game.i18n.localize(`dnd5e-manapoints.${formula_key}`)]));
        const template_file = "modules/dnd5e-manapoints/templates/spell-points-item.hbs"; // file path for the template file, from Data directory
        const rendered_html = await renderTemplate(template_file, template_item);

        $('.sheet-body .tab[data-tab="description"] .item-description', html).prepend(rendered_html);
        $('.tab.active', html).scrollTop(app.options?.prevScroll);

        $('input[type="checkbox"], select', html).on('change', function () {
          let scroll = $('.tab.active', html).scrollTop();
          app.options.prevScroll = scroll;
          app.submit();
        });
      }
      return (app, html, data);
    }
  }



} /** END ManaPoint Class **/
