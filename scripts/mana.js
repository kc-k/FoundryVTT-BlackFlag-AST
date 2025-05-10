import { MODULE_NAME } from "./lib.js";
import { MODULE_SHORT } from "./lib.js";

export const ITEM_ID = 'bSiYtPANAZmtnVWZ';
export const COMPENDIUM_SOURCE_ID = `Compendium.${MODULE_NAME}.blackflag-ast-items.Item.${ITEM_ID}`;

function manaSettings () {
  game.settings.register(MODULE_NAME, `enableMana`, {
    name: game.i18n.format(`${MODULE_SHORT}.settings.mana.enableModule.label`),
    hint: game.i18n.format(`${MODULE_SHORT}.settings.mana.enableModule.hint`),
    scope: "world",
    config: true,
    requiresReload: true,
    default: true,
    type: Boolean
  });
  game.settings.register(MODULE_NAME, `replaceSpellSlotOption`, {
    name: game.i18n.format(`${MODULE_SHORT}.settings.mana.replaceSpellSlotOption.label`),
    hint: game.i18n.format(`${MODULE_SHORT}.settings.mana.replaceSpellSlotOption.hint`),
    scope: "world",
    config: true,
    requiresReload: false,
    default: true,
    type: Boolean
  });
  game.settings.register(MODULE_NAME, `chatMessagePrivate`, {
    name: game.i18n.format(`${MODULE_SHORT}.settings.mana.enableChatMessage.label`),
    hint: game.i18n.format(`${MODULE_SHORT}.settings.mana.enableChatMessage.hint`),
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
    Hooks.on("blackFlag.preActivateActivity", async (activity, activationConfig, messageConfig, dialogConfig) => {
      ManaItem.updateActivityManaItem(activity, activationConfig, messageConfig, dialogConfig);  // set default resource consumption to mana
    })

    Hooks.on("renderActivityActivationDialog", async (dialog, html, formData) => {
      ManaItem.updateDialogManaItem(dialog, html, formData);  // spell launch dialog
    })

    Hooks.on("createItem", ManaItem.calculateManaItemCreate);  // add item reference to actor and calculate uses
    Hooks.on("preDeleteItem", ManaItem.removeItemFlag);  // remove item reference from actor

    Hooks.on("blackFlag.computeLeveledProgression", ManaItem.calculateManaItem);  // update uses on level up
    Hooks.on("blackFlag.computePactProgression", ManaItem.calculateManaItem);  // warlocks use this hook instead

    Hooks.on("blackFlag.preActivityConsumption", (item, consume, options, update) => {
      return ManaItem.castSpell(item, consume, options, update);  // actually use uses on spell cast
    })

    Hooks.on("renderItemSheet", async (app, html, data) => {
      ManaItem.renderManaItem(app, html, data);
    })
  }
}

function isset(variable) {  // helper function
  return (typeof variable !== 'undefined');
}

export class ManaItem {
  static settings(manaItem) {
    let _itemSettings = manaItem.getFlag("blackflag-ast", "mana") || {}
    return foundry.utils.mergeObject(_itemSettings, this.defaultSettings,
        { recursive: true, insertKeys: true, insertValues: true, overwrite: false, inplace: false}
    );
  }

  static get defaultSettings() {
    return {
      manaResource: 'Mana',
      autoLevelManaItem: true,
      spellManaCosts: { 1: "2", 2: "3", 3: "5", 4: "6", 5: "7", 6: "9", 7: "10", 8: "11", 9: "13" },
      leveledProgressionFormula: { 1: "4", 2: "7", 3: "10", 4: "13", 5: "17", 6: "21", 7: "25", 8: "29", 9: "34", 10: "39", 11: "44", 12: "49", 13: "55", 14: "61", 15: "67", 16: "73", 17: "80", 18: "87", 19: "94", 20: "101" },
      leveledProgressionExtraTerms: "",
    };
  }

  static isModuleActive() {
    return game.settings.get(MODULE_NAME, 'enableMana');
  }

  static getActorFlagManaItem(actor) {
    const item_id = actor.getFlag("blackflag-ast", "manaItem");
    return typeof item_id === 'string' && item_id.trim().length > 0 ? item_id : false;
  }

  static isManaItem(item) {
    return item.type === "feature" &&
      (item._stats?.compendiumSource === COMPENDIUM_SOURCE_ID || isset(item.getFlag("blackflag-ast", "mana")));
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

  static getManaItem(actor) {
    let items = foundry.utils.getProperty(actor, "collections.items");//  filter(u => u.isGM);

    const item_id = ManaItem.getActorFlagManaItem(actor);
    if (items[item_id])
      return items[item_id];
    let features = items.filter(i => i.type == 'feature');
    // get the item with source custom label = Mana
    let sp = features.filter(s => this.isManaItem(s));

    if (typeof sp == 'undefined' || typeof sp[0] == 'undefined') {
      return false;
    }

    // if our link to this item on the actor is missing add it. This happens if a
    // duplicate item was added to the actor and then the original was deleted
    if (!actor.getFlag("blackflag-ast", "manaItem")) {
      actor.update({ ['flags.blackflag-ast.manaItem']: sp[0]._id });
    }

    return sp[0];
  }

  /**
   * The function checks if the actor has enough mana to cast the spell
   * @param actor - The actor that is being updated.
   * @param content - The message's content
   * @returns null
   */
  static speakTo(actor, content) {
    /** check if message should be visible to all or just player+gm */
    let speakToSetting = game.settings.get(MODULE_NAME, 'chatMessagePrivate');
    let speakToUsers;
    if (speakToSetting == "GM") {
      speakToUsers = game.users.filter(u => u.isGM);
    } else if (speakToSetting == "All") {
      speakToUsers = [];
    }
    if (speakToUsers !== undefined) {
      ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ alias: actor.name }),
        isContentVisible: false,
        isAuthor: true,
        whisper: speakToUsers
      });
    }
  }


  /**
   * The function checks if the actor has enough mana to cast the spell
   * @param item - the Item being used
   * @param consume - resource consumption
   * @param actor - The actor that is being updated.
   * @returns The update object.
   */
  static castSpell(item, consume, options) {
    //console.log('MANA CAST SPELL', item, consume, options);

    if (!consume.consume.mana) {
      return [item, consume, options];
    }

    const actor = item.actor;
    /** do nothing if module is not active **/
    if (!ManaItem.isModuleActive())
      return [item, consume, options];

    let manaItem = ManaItem.getManaItem(actor);
    let settings = ManaItem.settings(manaItem);

    /** check if this is a spell casting **/
    if (!item.isSpell || !item.spellSlotConsumption) {
      return [item, consume, options];
    }

    if (consume.consume.mana) {
      consume.consume.spellSlot = false;
    }

    if (consume.consume.spellSlot) {
      consume.consume.mana = false;
      return [item, consume, options];
    }

    /** not found any resource for mana? **/
    if (!manaItem) {
      actorNoMana_message = game.i18n.format(`${MODULE_SHORT}.mana.actor.noManaItemMessage`,
          { ActorName: actor.name, ManaName: this.defaultSettings.manaResource, ManaItem: COMPENDIUM_SOURCE_ID }
      );
      ChatMessage.create({
        content: "<i style='color:red;'>" + actorNoMana_message + "</i>",
        speaker: ChatMessage.getSpeaker({ alias: actor.name })
      });
      ui.notifications.error(game.i18n.format(`${MODULE_SHORT}.mana.pleaseCreateManaItem`, 
          { ManaName: this.defaultSettings.manaResource, ManaItem: COMPENDIUM_SOURCE_ID })
      );
      return false;
    }

    /** find the spell level just cast */
    const spellLvl = item.item.system.circle.value ??= item.item.system.circle.base;

    let actualManaItem = manaItem.system.uses.value;

    /* get spell cost in mana*/
    const manaCost = this.withActorData(settings.spellManaCosts[spellLvl], actor);

    /** update mana**/
    if (actualManaItem - manaCost < 0) {
      ManaItem.speakTo(actor,
          "<i style='color:red;'>" + game.i18n.format(`${MODULE_SHORT}.mana.actor.notEnoughMana`,
              { ActorName: actor.name, ManaName: this.settings(manaItem).manaResource }) + "</i>",
      );
      consume.consumeSpellSlot = false;
      consume.consumeSpellLevel = false;
      consume.createMeasuredTemplate = false;
      options.createMessage = false;
      delete options.flags;
      ui.notifications.error("Not Enough Mana");
      return false;
    }

    /* character has enough mana*/
    let updateItem = {
      'system': {
        'uses': {}
      }
    };
    consume.consumeSpellLevel = false;
    consume.consumeSpellSlot = false;
    let newManaItemUses = manaItem.system.uses.value - manaCost;
    updateItem.system.uses = { value: newManaItemUses, spent: manaItem.system.uses.max - newManaItemUses };
    manaItem.update(updateItem);


    ManaItem.speakTo(actor,
        "<i style='color:purple;'>" + game.i18n.format(`${MODULE_SHORT}.mana.actor.spellUsingManaMessage`,
          {
            ActorName: actor.name,
            ManaItem: this.settings(manaItem).manaResource,
            manaItemUsed: manaCost,
            remainingPoints: manaItem.system.uses.value - manaCost
          }) + "</i>",
    );

    return [item, consume, options];
  }

  /**
   * It checks if the spell is being cast by a player character, and if so, it replaces the spell slot
   * dropdown with a list of spell mana costs, and adds a button to the dialog that will cast the
   * spell if the spell mana cost is available
   * @param dialog - The dialog object.
   * @param html - The HTML element of the dialog.
   * @param formData - The data that was submitted by the user.
   * @returns the value of the variable `level`
   */
  static async updateActivityManaItem(activity, activationConfig, messageConfig, dialogConfig) {
    if (!ManaItem.isModuleActive())
      return;

    /** check if actor is a player character **/
    let actor = foundry.utils.getProperty(activity, "item.actor");

    /** check if this is a spell **/
    if (foundry.utils.getProperty(activity, "item.type") !== "spell")
      return;

    /** get mana**/
    let manaItem = ManaItem.getManaItem(actor);

    if (!manaItem) {
      return;
    }

    activationConfig.consume.spellSlot = false;
    activationConfig.consume.mana = true;
    return;
  }

  /**
   * It checks if the spell is being cast by a player character, and if so, it replaces the spell slot
   * dropdown with a list of spell mana costs, and adds a button to the dialog that will cast the
   * spell if the spell mana cost is available
   * @param dialog - The dialog object.
   * @param html - The HTML element of the dialog.
   * @param formData - The data that was submitted by the user.
   * @returns the value of the variable `level`
   */
  static async updateDialogManaItem(dialog, html, formData) {
    if (!ManaItem.isModuleActive())
      return;

    /** check if actor is a player character **/
    let actor = foundry.utils.getProperty(dialog, "activity.item.actor");

    /** check if this is a spell **/
    if (foundry.utils.getProperty(dialog, "activity.item.type") !== "spell")
      return;

    const spell = dialog.activity.item.system;

    // spell level can change later if casting it with a greater slot, baseSpellLvl is the default
    const baseSpellLvl = spell.circle.base;

    /** get mana **/
    let manaItem = ManaItem.getManaItem(actor);
    let settings = this.settings(manaItem);

    if (!manaItem) {
      return;
    }

    let level = 'none';
    let cost = 0;
    let availableMana = manaItem.system.uses.max - manaItem.system.uses.spent;
    let usingPactSlots = false;


    /** Replace list of spell slots with list of spell mana costs (only if mana isn't selected) **/
    $('select[name="spell.slot"] option', html).each(function () {
        let selectValue = $(this).val();
        if (selectValue == "pact") {  // leave warlock pact slots alone
            // show the right checkbox for consuming resources (if pact is selected allow consuming spell slot instead of mana)
            usingPactSlots = this.defaultSelected;
        } else if (!dialog.config.consume.spellSlot ) {
            level = selectValue.replace('circle-', '');
            //console.log('LEVEL', level);
            cost = ManaItem.withActorData(settings.spellManaCosts[level], actor);

            let costTextLookup = game.i18n.format(`${MODULE_SHORT}.mana.actor.spellCost`, { amount: cost, available: availableMana, ManaName: settings.manaResource });
            let newText = `${CONFIG.BlackFlag.spellCircles()[level]} (${costTextLookup})`;
            $(this).text(newText);
        }
    })

    let useManaChecked = dialog.config.consume.mana == true ? "checked" : ""
    const consumeString = game.i18n.format(`${MODULE_SHORT}.mana.actor.consumeManaInput`, { ManaName: settings.manaResource });
    let consumeSpellSlotOption = $('input[name="consume.spellSlot"]', html).parents('div.form-group');
    let consumeInputForm = consumeSpellSlotOption.parent();
    consumeInputForm.append(
        `<div class="form-group"><label>${consumeString}</label><div class="form-fields"><input type="checkbox" name="consume.mana" ${useManaChecked}></div></div>`
    );
    let consumeManaOption = $('input[name="consume.mana"]', html).parents('div.form-group');
    let consumeInputs = consumeInputForm[0].getElementsByTagName('input');

    if (usingPactSlots) {
        if (dialog.config.consume.mana) {
            dialog.config.consume.spellSlot = true;
            consumeInputs["consume.spellSlot"].checked = true;
            dialog.config.consume.mana = false;
            consumeInputs["consume.mana"].checked = false;
        }
    }

    if (game.settings.get(MODULE_NAME, 'replaceSpellSlotOption')) {
        if (!usingPactSlots) {
            consumeInputs["consume.spellSlot"].checked = false;
            consumeSpellSlotOption.hide();
        } else {
            consumeInputs["consume.mana"].checked = false;
            consumeManaOption.hide();
        }

    }

    if (level == 'none')
      return;

    /** Calculate mana cost and warn user if they have none left */
    let manaCost = 0;
    manaCost = ManaItem.withActorData(settings.spellManaCosts[baseSpellLvl], actor);
    const missing_points = (typeof availableMana === 'undefined' || availableMana - manaCost < 0);
    if (missing_points) {
      const messageNotEnough = game.i18n.format(`{MODULE_SHORT}.mana.actor.notEnoughManaMessage`, { ManaName: settings.name });
      $('#ability-use-form', html).append('<div class="spError">' + messageNotEnough + '</div>');
    }
  }

  /**
   * Calculates the maximum mana for an actor based on a fixed map of
   * spellcasting level to maximum mana. Builds up a total spellcasting
   * level based on the level of each spellcasting class according to
   * Multiclassing rules.
   * @param {object} item The class item of the actor.
   * @param {object} updates The details of how the class item was udpated.
   * @param {object} actor The actor used for variables.
   * @return {number} The calculated maximum mana.
   */
  static _calculateManaItemFixed(item, updates, actor, settings) {
    /* not an update? **/
    let changedClassLevel = null;
    let changedClassID = null;
    let levelUpdated = false;

    if (foundry.utils.getProperty(updates.system, 'levels')) {
      changedClassLevel = foundry.utils.getProperty(updates.system, 'levels');
      changedClassID = foundry.utils.getProperty(item, '_id');
      levelUpdated = true;
    }
    // check for multiclasses
    const actorClassAndSubclasses = actor.items.filter(i => (i.type == "class" || i.type == "subclass") && i.system?.spellcasting)

    let spellcastingClassCount = 0;
    const spellcastingLevels = {
      full: [],
      half: [],
      artificer: [],
      third: [],
    }

    for (let c of actorClassAndSubclasses) {
      /* spellcasting: full; half; third; artificier; none; (pact are treated as half casters) **/
      let spellcasting = c.system?.spellcasting?.progression;
      let level = c.system.levels;

      // get updated class new level
      if (levelUpdated && c._id == changedClassID) {
        level = changedClassLevel;
      }

      spellcasting = spellcasting == "pact" ? "half" : spellcasting  // make pact casters the same as half casters
      if (spellcastingLevels[spellcasting] != undefined) {
        spellcastingLevels[spellcasting].push(level);
        spellcastingClassCount++;
      }

    }


    let totalSpellcastingLevel = 0
    totalSpellcastingLevel += spellcastingLevels['full'].reduce((sum, level) => sum + level, 0);
    totalSpellcastingLevel += spellcastingLevels['artificer'].reduce((sum, level) => sum + Math.ceil(level / 2), 0);
    // Half and third casters only round up if they do not multiclass into other spellcasting classes and if they
    // have enough levels to obtain the spellcasting feature. pact casters are essentially treated as half casters
    if (spellcastingClassCount == 1 && (spellcastingLevels['half'][0] >= 2 || spellcastingLevels['third'][0] >= 3)) {
      totalSpellcastingLevel += spellcastingLevels['half'].reduce((sum, level) => sum + Math.ceil(level / 2), 0);
      totalSpellcastingLevel += spellcastingLevels['third'].reduce((sum, level) => sum + Math.ceil(level / 3), 0);
    } else {
      totalSpellcastingLevel += spellcastingLevels['half'].reduce((sum, level) => sum + Math.floor(level / 2), 0);
      totalSpellcastingLevel += spellcastingLevels['third'].reduce((sum, level) => sum + Math.floor(level / 3), 0);
    }

    if (totalSpellcastingLevel == 0)
      return 0;

    let levelFormula = `(${settings.leveledProgressionFormula[totalSpellcastingLevel]}) ${settings.leveledProgressionExtraTerms}`
    const levelFormulaRegex = /ATLEVEL\[\%(.+?)\%\]/g  // essentially get value between [% and %]
    let _withActorData = this.withActorData;  // can't use "this" in a lambda function
    levelFormula = levelFormula.replace(levelFormulaRegex, function(match, level, offset, string) {
        let levelInt = parseInt(_withActorData(level, actor));
        return settings.leveledProgressionFormula[levelInt]
    })
    return parseInt(this.withActorData(levelFormula, actor)) || 0;
  }

  /**
   * ** on updateItem hook applied only if changing a class item **
   * If the module is active, the actor is a character, and the actor has a mana resource, then
   * update the mana resource's maximum value
   * @param item - The item that was updated.
   * @param updates - The updates that are being applied to the item.
   */
  static calculateManaItem(progression, item, updates) {
    if (!ManaItem.isModuleActive())
      return [progression, item, updates];

    if (!ManaItem.settings(item).autoLevelManaItem) {
      return [progression, item, updates];
    }

    /* updating or dropping a class item */

    if (item.type !== 'class') {
      // check if is the mana item being dropped.
      return [progression, item, updates];
    }

    if (!updates?.spellcasting?.type == 'leveled') {
      return [progression, item, updates];
    }

    const actor = item.parent;
    if (!ManaItem.getManaItem(actor)) {
      return [progression, item, updates];
    }

    ManaItem.updateManaItemMax(item, updates, actor, false);
    return [progression, item, updates];
  }

  static processFirstDrop(item) {
    let item_id = ManaItem.getActorFlagManaItem(item.parent);
    if (item_id) {
      if (item_id == item._id){
        return;  // the item is just being updated, its what we already have as our mana item on the actor
      }
      // there is already a mana item here.
      ui.notifications.error(game.i18n.format("BF-AST.mana.actor.alreadyManaItemOwned"));
      item.update({
        'name': item.name + ' (' + game.i18n.format("BF-AST.mana.actor.duplicated") + ')'
      });
      return false;
    }

    if (!item.getFlag("blackflag-ast", "mana")) {
      item.update({ ['flags.blackflag-ast.mana']: {} });
    }

    const actor = item.parent;
    if (actor == null) {
      return;
    }

    actor.update({ ['flags.blackflag-ast.manaItem']: item._id });
  }

  static calculateManaItemCreate(item, updates, id) {
    if (item.type == 'feature' && ManaItem.isManaItem(item)) {
      ManaItem.processFirstDrop(item);
      return true;
    }
  }

  static updateManaItemMax(classItem, updates, actor, createdItem) {
    let manaItem = createdItem || ManaItem.getManaItem(actor);

    let settings = ManaItem.settings(manaItem);

    if (!settings.autoLevelManaItem) {
      return true;
    }

    const ManaItemMax = ManaItem._calculateManaItemFixed(classItem, updates, actor, settings)

    if (ManaItemMax > 0 && ManaItemMax != manaItem.system.uses.max) {
      let message = game.i18n.format(`${MODULE_SHORT}.mana.actor.manaItemUpdated`,
          { ManaItem: manaItem.name, Actor: actor.name, PrevManaItem: manaItem.system.uses.max, NewManaItem: ManaItemMax }
      )
      manaItem.update({ [`system.uses.max`]: ManaItemMax, });
      // the update gets called twice so we need to set the value on the item immediately to avoid double posting our message
      manaItem.system.uses.max = ManaItemMax;
      ManaItem.speakTo(actor, "<i style='color:purple;'>" + message + "</i>");
    }
    return manaItem;
  }

  /** preDeleteItem */
  static removeItemFlag(item, dialog, id) {
    let actor = item.parent;
    if (item._id == ManaItem.getActorFlagManaItem(actor)) {
      actor.update({ [`flags.blackflag-ast.manaItem`]: '' });
    }
  }

  static async renderManaItem(app, html, data) {
    const item = data?.item;
    if (this.isModuleActive() && ManaItem.isManaItem(item)) {
      // this option make the app a little more usable, we keep submit on close and submit on change for checkboxes and select
      app.options.submitOnChange = false;

      $('.item-properties', html).hide();
      if (data.editable && game.user.isGM) {
        item.setFlag("blackflag-ast", "mana", ManaItem.settings(item));

        const template_file = `modules/${MODULE_NAME}/templates/mana/mana-item.hbs`; // file path for the template file, from Data directory
        const rendered_html = await renderTemplate(template_file, item);

        $('.sheet-body .tab[data-tab="description"] .description-area', html).before(rendered_html);
        $('.tab.active', html).scrollTop(app.options?.prevScroll);

        $('.accordion-heading', html).on('click', function () {
          $('.accordion-content').toggle(500)
        });

        $('input[type="checkbox"], select', html).on('change', function () {
          let scroll = $('.tab.active', html).scrollTop();
          app.options.prevScroll = scroll;
          app.submit();
        });

        // only keep config on item that is different from the default
        item.setFlag("blackflag-ast", "mana", foundry.utils.diffObject(this.defaultSettings, item.getFlag("blackflag-ast", "mana")));

      }
      return (app, html, data);
    }
  }



} /** END Mana Class **/
