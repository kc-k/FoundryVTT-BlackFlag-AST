![](https://img.shields.io/badge/Foundry-v10-informational)
<!--- Downloads @ Latest Badge -->
<!--- replace <user>/<repo> with your username/repository -->
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/<user>/<repo>/latest/module.zip) -->

<!--- Forge Bazaar Install % Badge -->
<!--- replace <your-module-name> with the `name` in your manifest -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2F<your-module-name>&colorB=4aa94a) -->


# FoundryVTT Module

## BlackFlag: Advanced System Tweaks
This is a collection of system modifications for the BlackFlag system. The changes are mostly configurable, so you can
drop in the pieces you want to use for your game, with modifications ranging from minor tweaks to extensive play changes.

## Available Additions

### Initiative
Initiative is now DEX + WIS across the board. You may need to adjust some monster's initiative slightly to compensate

### 2d10 gameplay system
Replaces standard d20 rolls with 2d10. This has wide ranging impacts to gameplay and balance assumptions. There are more
details [here](linksomeday) with what kind of impact you can expect and options for how to adjust certain checks / DCs
to account for the changes.
- Crits happen on >=18 or <=4 (in foundry the result number will be green or red)
- Super crit on 20 or 2

### Mana system
This adds an optional (and can be used in conjunction with spell slots) mana pool system. The cost for spells and size
of the mana pool for a character is configurable. To use mana for a character, simply add the "Mana" item from the module
compendium to the PCs features.

Many thanks to [LuMaster](https://foundryvtt.com/community/misthero) for his amazing [Advanced Magic - Spell Points
System 5e](https://foundryvtt.com/packages/dnd5e-spellpoints) 5e module that was the basis for all the mana code

===

#### misc
[possible future features](documentation/dev/future-features-readme.md)

#### dev notes
[version release creation notes](documentation/dev/creatingreleases.md)
