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
of the mana pool for a character is configurable.
Many thanks to [LuMaster](https://foundryvtt.com/community/misthero) for his amazing [Advanced Magic - Spell Points
System 5e](https://foundryvtt.com/packages/dnd5e-spellpoints) 5e module that was the basis for all the mana code

### (TODO) NPC recharge timing
I think an NPC should roll recharge at the end of its turn so the GM can narratively describe the recharge taking place.
This gives PCs a bit more strategy, ex. They "see" the dragon preparing to unleash a deadly fire breath again and can do
things about it which seems more tactically, and cinematically, appropriate.

### (TODO?) Exhaustion system
This uses the 5e24 exhaustion as inspiration and tweaks it to be easier to apply to PCs without repercussions
- Exhaustion for a character has 12 levels.
- All checks (d20 / 2d10 rolls) have a penalty equal to your current Exhaustion level.
- For every 2 exhaustion your speed is reduced by 5ft.
- At 12 exhaustion, you become unconscious and will die unless someone nurses you back to health.

### (TODO?) Updated Rest system
This will change resting to be a 3 rest system instead of a 2 rest system. This will generally increase the "gritty"
feel of gameplay and slow things down. The planned rests are as follows:
- Short rest - No mechanical change. Suggested to limit to 1 short rest per day for extra challenge.
- Medium rest - New rest option that happens over 8 hours of rest and sleep similar to how a long rest normally
  functions. 
  - If you don't sleep for the night, gain 2 exhaustion
  - Recover 1 exhaustion level
  - Recover half number of HD - Requires a ration to be consumed
  - Gain the benefits of a short rest
- Long rest - This functions as a slightly stronger normal long rest but with an increased time of resting
  - Takes 24 hours of downtime (2 Medium rests with simple or routine tasks for the entire day between).
  - Must be attempted in a safe place, like an inn or maybe a very good camp area
  - Restores all hit dice and recovers all Exhaustion

### (TODO?) Food system
This would require a calendar module. Every day 1 ration is consumed from PC automatically. If a ration can't be
consumed then the hungry condition (stacking) is applied. On every medium or long rest with hungry make a
CON save DC 8 + (3 * hunger) or suffer 1 exhaustion per hunger stack. Eating a ration or food reduces hunger by 1


## DEV NOTE!
windows to wsl sym link for foundryvtt development
New-Item -ItemType SymbolicLink -Path "F:/FoundryVTT/Data/modules/BlackFlag-AST" -Target "\\wsl$\Ubuntu22.04\home\<user>/git/FoundryVTT-BlackFlag-AST"


# How to use this Template to create a versioned Release

1. Open your repository's releases page.

![Where to click to open repository releases.](https://user-images.githubusercontent.com/7644614/93409301-9fd25080-f864-11ea-9e0c-bdd09e4418e4.png)

2. Click "Draft a new release"

![Draft a new release button.](https://user-images.githubusercontent.com/7644614/93409364-c1333c80-f864-11ea-89f1-abfcb18a8d9f.png)

3. Fill out the release version as the tag name.

If you want to add details at this stage you can, or you can always come back later and edit them.

![Release Creation Form](https://user-images.githubusercontent.com/7644614/93409543-225b1000-f865-11ea-9a19-f1906a724421.png)

4. Hit submit.

5. Wait a few minutes.

A Github Action will run to populate the `module.json` and `module.zip` with the correct urls that you can then use to distribute this release. You can check on its status in the "Actions" tab.

![Actions Tab](https://user-images.githubusercontent.com/7644614/93409820-c1800780-f865-11ea-8c6b-c3792e35e0c8.png)

6. Grab the module.json url from the release's details page.

![image](https://user-images.githubusercontent.com/7644614/93409960-10c63800-f866-11ea-83f6-270cc5d10b71.png)

This `module.json` will only ever point at this release's `module.zip`, making it useful for sharing a specific version for compatibility purposes.

7. You can use the url `https://github.com/<user>/<repo>/releases/latest/download/module.json` to refer to the manifest.

This is the url you want to use to install the module typically, as it will get updated automatically.

# How to List Your Releases on Package Admin

To request a package listing for your first release, go to the [Package Submission Form](https://foundryvtt.com/packages/submit) (accessible via a link at the bottom of the "[Systems and Modules](https://foundryvtt.com/packages/)" page on the Foundry website).

Fill in the form. "Package Name" must match the name in the module manifest.  Package Title will be the display name for the package.  Package URL should be your repo URL.
![image](https://user-images.githubusercontent.com/36359784/120664263-b49e5500-c482-11eb-9126-af7006389903.png)


One of the Foundry staff will typically get back to you with an approval or any further questions within a few days, and give you access to the package admin pages.

Once you have access to the [module admin page](https://foundryvtt.com/admin/packages/package/), you can release a new version by going into the page for your module, scrolling to the bottom, and filling in a new Package Version.

When listing a new version, Version should be the version number you set above, and the Manifest URL should be the manifest __for that specific version__ (do not use /latest/ here).
![image](https://user-images.githubusercontent.com/36359784/120664346-c4b63480-c482-11eb-9d8b-731b50d70939.png)

> ### :warning: Important :warning:
> 
> It is very important that you use the specific release manifest url, and not the `/latest` url here. For more details about why this is important and how Foundry Installs/Updates packages, read [this wiki article](https://foundryvtt.wiki/en/development/guides/releases-and-history).

Clicking "Save" in the bottom right will save the new version, which means that anyone installing your module from within Foundry will get that version, and a post will be generated in the #release-announcements channel on the official Foundry VTT Discord.
