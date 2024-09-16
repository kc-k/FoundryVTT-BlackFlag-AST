import { MODULE_NAME } from "./lib.js";

export const ITEM_ID = 'TpcB4d7o34UOWenr';
export const COMPENDIUM_SOURCE_ID = `Compendium.${MODULE_NAME}.blackflag-ap-items.Item.${ITEM_ID}`;
const SPELL_PROG_LOC = "CONFIG.BlackFlag.spellcastingTypes.leveled.progression";

function manaSettings () {
  game.settings.register(MODULE_NAME, `enableMana`, {
    name: game.i18n.format(`${MODULE_NAME}.mana.enableModule`),
    hint: game.i18n.format(`${MODULE_NAME}.mana.enableModuleHint`),
    scope: "world",
    config: true,
    requiresReload: true,
    default: true,
    type: Boolean
  });
  game.settings.register(MODULE_NAME, `chatMessagePrivate`, {
    name: game.i18n.format(`${MODULE_NAME}.mana.enableChatMessage`),
    hint: game.i18n.format(`${MODULE_NAME}.mana.enableChatMessageHint`),
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
    Hooks.on("renderActivityActivationDialog", async (dialog, html, formData) => {
      ManaPoints.checkDialogManaPoints(dialog, html, formData);  // spell launch dialog
    })

    Hooks.on("updateItem", ManaPoints.calculateManaPoints);
    Hooks.on("createItem", ManaPoints.calculateManaPointsCreate);  // add item reference to actor and calculate uses
    Hooks.on("preDeleteItem", ManaPoints.removeItemFlag);  // remove item reference from actor

    Hooks.on("blackFlag.computeLeveledProgression", ManaPoints.calculateManaPoints);  // update uses on level up

    Hooks.on("blackFlag.preActivityConsumption", (item, consume, options, update) => {
      return ManaPoints.castSpell(item, consume, options, update);  // actually use uses on spell cast
    })

    Hooks.on("renderItemSheet", async (app, html, data) => {
      ManaPoints.renderManaPointsItem(app, html, data);
    })
  }
}

function isset(variable) {  // helper function
  return (typeof variable !== 'undefined');
}

export class ManaPoints {
  static settings(manaItem) {
    let _itemSettings = isset(manaItem.flags?.manapoints) ? manaItem.flags?.manapoints : {}
    return foundry.utils.mergeObject(_itemSettings, this.defaultSettings,
        { recursive: true, insertKeys: true, insertValues: true, overwrite: false, inplace: false}
    );
  }

  static get defaultSettings() {
    return {
      manaResource: 'Mana',
      autoLevelManaPoints: true,
      spellManaCosts: { 1: "2", 2: "3", 3: "5", 4: "6", 5: "7", 6: "9", 7: "10", 8: "11", 9: "13" },
      leveledProgressionFormula: { 1: "4", 2: "7", 3: "10", 4: "13", 5: "17", 6: "21", 7: "25", 8: "29", 9: "34", 10: "39", 11: "44", 12: "49", 13: "55", 14: "61", 15: "67", 16: "73", 17: "80", 18: "87", 19: "94", 20: "101" },
      leveledProgressionExtraTerms: "",
    };
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
    let settings = ManaPoints.settings(manaPointItem);

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
      actorNoMana_message = game.i18n.format(`${MODULE_NAME}.mana.actorNoManaPoints`,
          { ActorName: actor.name, ManaPoints: this.defaultSettings.manaResource, ManaItem: COMPENDIUM_SOURCE_ID }
      );
      ChatMessage.create({
        content: "<i style='color:red;'>" + actorNoMana_message + "</i>",
        speaker: ChatMessage.getSpeaker({ alias: actor.name })
      });
      ui.notifications.error(game.i18n.format(`${MODULE_NAME}.mana.pleaseCreate`, 
          { ManaPoints: this.defaultSettings.manaResource, ManaItem: COMPENDIUM_SOURCE_ID })
      );
      return false;
    }

    /** find the spell level just cast */
    const spellLvl = item.item.system.circle.value ??= item.item.system.circle.base;

    let actualManaPoints = manaPointItem.system.uses.value;

    /* get spell cost in manapoints */
    const manaPointCost = this.withActorData(settings.spellManaCosts[spellLvl], actor);

    /** update manapoints **/
    if (actualManaPoints - manaPointCost < 0) {
      ManaPoints.speakTo(actor,
          "<i style='color:red;'>" + game.i18n.format(`${MODULE_NAME}.mana.notEnoughMana`,
              { ActorName: actor.name, ManaPoints: this.settings(manaPointItem).manaResource }) + "</i>",
      );
      consume.consumeSpellSlot = false;
      consume.consumeSpellLevel = false;
      consume.createMeasuredTemplate = false;
      options.createMessage = false;
      delete options.flags;
      ui.notifications.error("Not Enough Mana");
      return false;
    }

    /* character has enough manapoints */
    let updateItem = {
      'system': {
        'uses': {}
      }
    };
    consume.consumeSpellLevel = false;
    consume.consumeSpellSlot = false;
    let newManaPointUses = manaPointItem.system.uses.value - manaPointCost;
    updateItem.system.uses = { value: newManaPointUses, spent: manaPointItem.system.uses.max - newManaPointUses };
    manaPointItem.update(updateItem);


    ManaPoints.speakTo(actor,
        "<i style='color:purple;'>" + game.i18n.format(`${MODULE_NAME}.mana.spellUsingManaPoints`,
          {
            ActorName: actor.name,
            ManaPoints: this.settings(manaPointItem).manaResource,
            manaPointUsed: manaPointCost,
            remainingPoints: manaPointItem.system.uses.value - manaPointCost
          }) + "</i>",
    );

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
    // FIXME Really should see about moving all of this logic into the dialog box configuration instead of the activity rendering
    if (!ManaPoints.isModuleActive())
      return;

    /** check if actor is a player character **/
    let actor = foundry.utils.getProperty(dialog, "activity.item.actor");

    /** check if this is a spell **/
    if (foundry.utils.getProperty(dialog, "activity.item.type") !== "spell")
      return;

    html.addClass('manapoints-cast');

    const spell = dialog.activity.item.system;

    // spell level can change later if casting it with a greater slot, baseSpellLvl is the default
    const baseSpellLvl = spell.circle.base;

    /** get manapoints **/
    let manaPointItem = ManaPoints.getManaPointsItem(actor);
    let settings = this.settings(manaPointItem);

    if (!manaPointItem) {
      ui.notifications.error(game.i18n.format(`${MODULE_NAME}.mana.pleaseCreate`, { ManaPoints: manaPointItem.name, ManaItem: COMPENDIUM_SOURCE_ID }));
      return;
    }

    let level = 'none';
    let cost = 0;
    let availableManaPoints = manaPointItem.system.uses.max - manaPointItem.system.uses.spent;


    /** Replace list of spell slots with list of spell point costs **/
    $('select[name="spell.slot"] option', html).each(function () {
      let selectValue = $(this).val();

      level = selectValue.replace('circle-', '');
      //console.log('LEVEL', level);
      cost = ManaPoints.withActorData(settings.spellManaCosts[level], actor);

      let costTextLookup = game.i18n.format(`${MODULE_NAME}.mana.spellCost`, { amount: cost, available: availableManaPoints, ManaPoints: manaPointItem.name });
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
    // override the activity use dialog to handle the new option (FIXME)
    if (html[0].offsetParent.className.includes('manapoints-cast')) {
      html[0].offsetParent.style.height = '255px'
    } else if (html[0].className.includes('manapoints-cast')) {
      html[0].style.height = '255px'
    }
    /** shouldn't have to do this, instead hook into the activity config directly **/

    if (level == 'none')
      return;

    /** Calculate spell point cost and warn user if they have none left */
    let manaPointCost = 0;
    manaPointCost = ManaPoints.withActorData(settings.spellManaCosts[baseSpellLvl], actor);
    const missing_points = (typeof availableManaPoints === 'undefined' || availableManaPoints - manaPointCost < 0);
    if (missing_points) {
      const messageNotEnough = game.i18n.format(`{MODULE_NAME}.mana.youNotEnough`, { ManaPoints: manaPointItem.name });
      $('#ability-use-form', html).append('<div class="spError">' + messageNotEnough + '</div>');
    }
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
   * If the module is active, the actor is a character, and the actor has a spell point resource, then
   * update the spell point resource's maximum value
   * @param item - The item that was updated.
   * @param updates - The updates that are being applied to the item.
   */
  static calculateManaPoints(progression, item, updates) {
    const actor = item.parent;
    let settings = ManaPoints.settings(item);

    if (!ManaPoints.isModuleActive())
      return [progression, item, updates];

    if (!settings.autoLevelManaPoints) {
      return [progression, item, updates];
    }

    /* updating or dropping a class item */

    if (item.type !== 'class') {
      // check if is the spell point feature being dropped.
      return [progression, item, updates];
    }

    if (!updates?.spellcasting?.type == 'leveled') {
      return [progression, item, updates];
    }

    ManaPoints.updateManaPointsMax(item, updates, actor, false);
    return [progression, item, updates];
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

    if (!item.flags?.manapoints) {
      let updateItem = { 'flags': { 'manapoints': { } } };
      item.update(updateItem);
    }

    const actor = item.parent;
    if (actor == null) {
      return;
    }

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
    let manaPointsItem;
    if (createdItem)
      manaPointsItem = createdItem;
    else
      manaPointsItem = ManaPoints.getManaPointsItem(actor);
    if (!manaPointsItem) {
      // mana points item not found?
      console.log("mana points item missing during mana point value update???");
      ui.notifications.error(game.i18n.format(`${MODULE_NAME}.mana.pleaseCreate`, { ManaPoints: manaPointItem.name, ManaItem: COMPENDIUM_SOURCE_ID }));
      return;
    }

    let settings = ManaPoints.settings(manaPointsItem);

    if (!settings.autoLevelManaPoints) {
      return true;
    }

    const ManaPointsMax = ManaPoints._calculateManaPointsFixed(classItem, updates, actor, settings)

    if (ManaPointsMax > 0 && ManaPointsMax != manaPointsItem.system.uses.max) {
      let message = game.i18n.format(`${MODULE_NAME}.mana.manaPointsUpdated`,
          { ManaPoints: manaPointsItem.name, Actor: actor.name, PrevManaPoints: manaPointsItem.system.uses.max, NewManaPoints: ManaPointsMax }
      )
      manaPointsItem.update({ [`system.uses.max`]: ManaPointsMax, });
      // the update gets called twice so we need to set the value on the item immediately to avoid double posting our message
      manaPointsItem.system.uses.max = ManaPointsMax;
      ManaPoints.speakTo(actor, "<i style='color:purple;'>" + message + "</i>");
    }
    return manaPointsItem;
  }

  /** preDeleteItem */
  static removeItemFlag(item, dialog, id) {
    let actor = item.parent;
    if (item._id == ManaPoints.getActorFlagManaPointItem(actor)) {
      actor.update({ [`flags.manapoints.item`]: '' });
    }
  }

  static async renderManaPointsItem(app, html, data) {
    const item = data?.item;
    if (this.isModuleActive() && ManaPoints.isManaPointsItem(item)) {
      // this option make the app a little more usable, we keep submit on close and submit on change for checkboxes and select
      app.options.submitOnChange = false;

      $('.item-properties', html).hide();
      if (data.editable && game.user.isGM) {
        item.flags.manapoints = ManaPoints.settings(item);

        const template_file = `modules/${MODULE_NAME}/templates/mana-points/mana-points-item.hbs`; // file path for the template file, from Data directory
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
        item.flags.manapoints = foundry.utils.diffObject(this.defaultSettings, item.flags?.manapoints);

      }
      return (app, html, data);
    }
  }



} /** END ManaPoint Class **/
