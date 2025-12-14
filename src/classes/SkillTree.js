/**
 * Skill Tree System
 * Each class has a unique skill tree with unlockable abilities and passive bonuses
 */

export class SkillTree {
    constructor(classData) {
        this.className = classData.name;
        this.skills = new Map();
        this.tiers = [];
        
        this.initializeSkillTree(classData);
    }
    
    initializeSkillTree(classData) {
        // Generate skill tree based on class
        const treeData = SkillTreeDefinitions[this.className.toLowerCase().replace(' ', '')];
        if (treeData) {
            for (const skill of treeData) {
                this.skills.set(skill.id, skill);
            }
            this.organizeTiers();
        }
    }
    
    organizeTiers() {
        // Group skills by tier
        const tierMap = new Map();
        
        for (const skill of this.skills.values()) {
            const tier = skill.tier || 0;
            if (!tierMap.has(tier)) {
                tierMap.set(tier, []);
            }
            tierMap.get(tier).push(skill);
        }
        
        // Sort tiers
        const sortedTiers = Array.from(tierMap.keys()).sort((a, b) => a - b);
        this.tiers = sortedTiers.map(tier => tierMap.get(tier));
    }
    
    getSkill(skillId) {
        return this.skills.get(skillId);
    }
    
    canUnlock(skillId, unlockedSkills, level, skillPoints) {
        const skill = this.skills.get(skillId);
        if (!skill) return false;
        if (unlockedSkills.has(skillId)) return false;
        if (skillPoints <= 0) return false;
        if (skill.levelRequired && level < skill.levelRequired) return false;
        
        // Check prerequisites
        if (skill.requires) {
            for (const req of skill.requires) {
                if (!unlockedSkills.has(req)) return false;
            }
        }
        
        return true;
    }
    
    getAvailableSkills(unlockedSkills, level) {
        const available = [];
        
        for (const skill of this.skills.values()) {
            if (!unlockedSkills.has(skill.id)) {
                const meetsLevel = !skill.levelRequired || level >= skill.levelRequired;
                const meetsReqs = !skill.requires || skill.requires.every(req => unlockedSkills.has(req));
                
                if (meetsLevel && meetsReqs) {
                    available.push(skill);
                }
            }
        }
        
        return available;
    }
}

// Skill tree definitions for each class
export const SkillTreeDefinitions = {
    // ============ KNIGHT SKILL TREE ============
    knight: [
        // Tier 1
        {
            id: 'knight_heavy_swing',
            name: 'Heavy Swing',
            description: 'Basic attacks deal 15% more damage',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { damageBonus: 15 }
        },
        {
            id: 'knight_iron_skin',
            name: 'Iron Skin',
            description: 'Increase defense by 10',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { defenseBonus: 10 }
        },
        {
            id: 'knight_shield_mastery',
            name: 'Shield Mastery',
            description: 'Shield abilities cost 20% less stamina',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { shieldStaminaReduction: 0.2 }
        },
        // Tier 2
        {
            id: 'knight_rallying_cry',
            name: 'Rallying Cry',
            description: 'Ability: Buff nearby allies with increased damage',
            tier: 2,
            levelRequired: 5,
            requires: ['knight_heavy_swing'],
            type: 'ability',
            grantsAbility: {
                name: 'Rallying Cry',
                description: 'Increase nearby allies damage by 20%',
                cooldown: 30,
                duration: 10,
                range: 150,
                type: 'buff'
            }
        },
        {
            id: 'knight_fortify',
            name: 'Fortify',
            description: 'Increase max health by 50',
            tier: 2,
            levelRequired: 5,
            requires: ['knight_iron_skin'],
            type: 'passive',
            passive: { healthBonus: 50 }
        },
        {
            id: 'knight_counter_attack',
            name: 'Counter Attack',
            description: '20% chance to counter melee attacks',
            tier: 2,
            levelRequired: 5,
            requires: ['knight_shield_mastery'],
            type: 'passive',
            passive: { counterChance: 0.2 }
        },
        // Tier 3
        {
            id: 'knight_charge',
            name: 'Charge',
            description: 'Ability: Rush forward, knocking back enemies',
            tier: 3,
            levelRequired: 10,
            requires: ['knight_rallying_cry'],
            type: 'ability',
            grantsAbility: {
                name: 'Charge',
                description: 'Charge forward dealing damage',
                damage: 30,
                staminaCost: 40,
                cooldown: 10,
                range: 200,
                type: 'dash'
            }
        },
        {
            id: 'knight_unbreakable',
            name: 'Unbreakable',
            description: 'Cannot be killed for 3 seconds when taking fatal damage (once per fight)',
            tier: 3,
            levelRequired: 10,
            requires: ['knight_fortify'],
            type: 'passive',
            passive: { deathSave: true }
        },
        {
            id: 'knight_perfect_block',
            name: 'Perfect Block',
            description: 'Blocking at the right moment negates all damage',
            tier: 3,
            levelRequired: 10,
            requires: ['knight_counter_attack'],
            type: 'passive',
            passive: { perfectBlockWindow: 0.3 }
        },
        // Tier 4 (Ultimate)
        {
            id: 'knight_bulwark',
            name: 'Bulwark',
            description: 'Ultimate: Become immune to damage for 5 seconds',
            tier: 4,
            levelRequired: 20,
            requires: ['knight_unbreakable', 'knight_perfect_block'],
            type: 'ability',
            grantsAbility: {
                name: 'Bulwark',
                description: 'Total immunity for 5 seconds',
                cooldown: 90,
                duration: 5,
                type: 'ultimate'
            }
        },
        // Tier 5 (Legendary)
        {
            id: 'knight_champion',
            name: 'Champion of Light',
            description: 'Permanent +50% defense, allies near you take 25% less damage',
            tier: 5,
            levelRequired: 30,
            requires: ['knight_bulwark'],
            type: 'passive',
            passive: { defenseMultiplier: 1.5, allyDamageReduction: 0.25, championAura: true }
        }
    ],
    
    // ============ MAGE SKILL TREE ============
    mage: [
        // Tier 1
        {
            id: 'mage_fire_mastery',
            name: 'Fire Mastery',
            description: 'Fire spells deal 20% more damage',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { fireDamageBonus: 0.2 }
        },
        {
            id: 'mage_ice_mastery',
            name: 'Ice Mastery',
            description: 'Ice spells slow enemies by an additional 15%',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { iceSlowBonus: 0.15 }
        },
        {
            id: 'mage_mana_efficiency',
            name: 'Mana Efficiency',
            description: 'Spells cost 10% less mana',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { manaCostReduction: 0.1 }
        },
        // Tier 2
        {
            id: 'mage_meteor',
            name: 'Meteor',
            description: 'Ability: Call down a devastating meteor',
            tier: 2,
            levelRequired: 5,
            requires: ['mage_fire_mastery'],
            type: 'ability',
            grantsAbility: {
                name: 'Meteor',
                description: 'Call down a meteor for massive AOE damage',
                damage: 100,
                manaCost: 60,
                cooldown: 20,
                range: 300,
                radius: 120,
                type: 'aoe'
            }
        },
        {
            id: 'mage_blizzard',
            name: 'Blizzard',
            description: 'Ability: Create a blizzard that damages and slows',
            tier: 2,
            levelRequired: 5,
            requires: ['mage_ice_mastery'],
            type: 'ability',
            grantsAbility: {
                name: 'Blizzard',
                description: 'Sustained AOE damage and slow',
                damage: 15,
                manaCost: 50,
                cooldown: 15,
                duration: 6,
                radius: 150,
                type: 'zone'
            }
        },
        {
            id: 'mage_arcane_focus',
            name: 'Arcane Focus',
            description: 'Increase max mana by 50',
            tier: 2,
            levelRequired: 5,
            requires: ['mage_mana_efficiency'],
            type: 'passive',
            passive: { manaBonus: 50 }
        },
        // Tier 3
        {
            id: 'mage_combustion',
            name: 'Combustion',
            description: 'Fire spells have 20% chance to explode for bonus damage',
            tier: 3,
            levelRequired: 10,
            requires: ['mage_meteor'],
            type: 'passive',
            passive: { fireExplosionChance: 0.2 }
        },
        {
            id: 'mage_frost_armor',
            name: 'Frost Armor',
            description: 'Passive armor that damages melee attackers',
            tier: 3,
            levelRequired: 10,
            requires: ['mage_blizzard'],
            type: 'passive',
            passive: { frostArmor: true, frostArmorDamage: 10 }
        },
        {
            id: 'mage_spell_echo',
            name: 'Spell Echo',
            description: '15% chance to cast spells twice',
            tier: 3,
            levelRequired: 10,
            requires: ['mage_arcane_focus'],
            type: 'passive',
            passive: { spellEchoChance: 0.15 }
        },
        // Tier 4
        {
            id: 'mage_elemental_mastery',
            name: 'Elemental Mastery',
            description: 'Ultimate: Unleash all elements at once',
            tier: 4,
            levelRequired: 20,
            requires: ['mage_combustion', 'mage_frost_armor'],
            type: 'ability',
            grantsAbility: {
                name: 'Elemental Storm',
                description: 'Combined fire, ice, and lightning storm',
                damage: 150,
                manaCost: 100,
                cooldown: 60,
                radius: 200,
                type: 'ultimate'
            }
        },
        // Tier 5 (Legendary)
        {
            id: 'mage_archmage',
            name: 'Grand Archmage',
            description: 'All spell costs reduced by 50%, spells have 30% chance to reset cooldown',
            tier: 5,
            levelRequired: 30,
            requires: ['mage_elemental_mastery', 'mage_spell_echo'],
            type: 'passive',
            passive: { spellCostReduction: 0.5, cooldownResetChance: 0.3, archmageAura: true }
        }
    ],
    
    // ============ ASSASSIN SKILL TREE ============
    assassin: [
        // Tier 1
        {
            id: 'assassin_blade_dance',
            name: 'Blade Dance',
            description: 'Attack speed increased by 15%',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { attackSpeedBonus: 0.15 }
        },
        {
            id: 'assassin_shadow_walk',
            name: 'Shadow Walk',
            description: 'Move 10% faster while not in combat',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { outOfCombatSpeed: 0.1 }
        },
        {
            id: 'assassin_vital_strike',
            name: 'Vital Strike',
            description: 'Critical hits deal 25% more damage',
            tier: 1,
            levelRequired: 1,
            type: 'passive',
            passive: { critDamageBonus: 0.25 }
        },
        // Tier 2
        {
            id: 'assassin_fan_of_knives',
            name: 'Fan of Knives',
            description: 'Ability: Throw knives in all directions',
            tier: 2,
            levelRequired: 5,
            requires: ['assassin_blade_dance'],
            type: 'ability',
            grantsAbility: {
                name: 'Fan of Knives',
                description: 'Throw 8 knives in all directions',
                damage: 20,
                staminaCost: 35,
                cooldown: 8,
                projectiles: 8,
                type: 'projectile'
            }
        },
        {
            id: 'assassin_cloak_of_shadows',
            name: 'Cloak of Shadows',
            description: 'Stealth lasts 2 seconds longer',
            tier: 2,
            levelRequired: 5,
            requires: ['assassin_shadow_walk'],
            type: 'passive',
            passive: { stealthDurationBonus: 2 }
        },
        {
            id: 'assassin_marked_for_death',
            name: 'Marked for Death',
            description: 'Ability: Mark target to take increased damage',
            tier: 2,
            levelRequired: 5,
            requires: ['assassin_vital_strike'],
            type: 'ability',
            grantsAbility: {
                name: 'Marked for Death',
                description: 'Target takes 30% more damage',
                cooldown: 20,
                duration: 10,
                range: 200,
                type: 'debuff'
            }
        },
        // Tier 3
        {
            id: 'assassin_flurry',
            name: 'Flurry',
            description: 'Ability: Rapid series of attacks',
            tier: 3,
            levelRequired: 10,
            requires: ['assassin_fan_of_knives'],
            type: 'ability',
            grantsAbility: {
                name: 'Flurry',
                description: '6 rapid attacks in quick succession',
                damage: 15,
                hits: 6,
                staminaCost: 50,
                cooldown: 12,
                type: 'melee'
            }
        },
        {
            id: 'assassin_shadow_step_upgrade',
            name: 'Shadow Step Mastery',
            description: 'Shadow Step has 2 charges',
            tier: 3,
            levelRequired: 10,
            requires: ['assassin_cloak_of_shadows'],
            type: 'passive',
            passive: { shadowStepCharges: 2 }
        },
        {
            id: 'assassin_execute',
            name: 'Execute',
            description: 'Ability: Instantly kill enemies below 15% health',
            tier: 3,
            levelRequired: 10,
            requires: ['assassin_marked_for_death'],
            type: 'ability',
            grantsAbility: {
                name: 'Execute',
                description: 'Kill targets below 15% health',
                cooldown: 20,
                range: 50,
                threshold: 0.15,
                type: 'execute'
            }
        },
        // Tier 4
        {
            id: 'assassin_death_from_above',
            name: 'Death From Above',
            description: 'Ultimate: Vanish and strike all nearby enemies',
            tier: 4,
            levelRequired: 20,
            requires: ['assassin_flurry', 'assassin_execute'],
            type: 'ability',
            grantsAbility: {
                name: 'Death From Above',
                description: 'Teleport and attack all enemies in range',
                damage: 80,
                cooldown: 60,
                radius: 150,
                type: 'ultimate'
            }
        },
        // Tier 5 (Legendary)
        {
            id: 'assassin_shadow_lord',
            name: 'Shadow Lord',
            description: 'Permanent stealth when not attacking, all crits deal triple damage',
            tier: 5,
            levelRequired: 30,
            requires: ['assassin_death_from_above', 'assassin_shadow_step_upgrade'],
            type: 'passive',
            passive: { passiveStealth: true, critMultiplier: 3.0, shadowLord: true }
        }
    ],
    
    // ============ ARCHER SKILL TREE ============
    archer: [
        // Tier 1
        { id: 'archer_steady_aim', name: 'Steady Aim', description: '+10% projectile damage', tier: 1, levelRequired: 1, type: 'passive', passive: { projectileDamageBonus: 0.1 } },
        { id: 'archer_quick_draw', name: 'Quick Draw', description: '+15% attack speed', tier: 1, levelRequired: 1, type: 'passive', passive: { attackSpeedBonus: 0.15 } },
        { id: 'archer_hunters_mark', name: "Hunter's Mark", description: 'Marked targets take 15% more damage from you', tier: 1, levelRequired: 1, type: 'passive', passive: { hunterMarkDamage: 0.15 } },
        // Tier 2
        { id: 'archer_explosive_arrow', name: 'Explosive Arrow', description: 'Arrows have 10% chance to explode', tier: 2, levelRequired: 5, requires: ['archer_steady_aim'], type: 'passive', passive: { explosiveChance: 0.1 } },
        { id: 'archer_rapid_fire', name: 'Rapid Fire', description: 'Ability: Fire 5 arrows rapidly', tier: 2, levelRequired: 5, requires: ['archer_quick_draw'], type: 'ability', grantsAbility: { name: 'Rapid Fire', damage: 15, projectiles: 5, staminaCost: 40, cooldown: 10, type: 'projectile' } },
        { id: 'archer_evasion', name: 'Evasive Roll', description: '+20% dodge chance while moving', tier: 2, levelRequired: 5, requires: ['archer_hunters_mark'], type: 'passive', passive: { dodgeChance: 0.2 } },
        // Tier 3
        { id: 'archer_sniper', name: 'Sniper', description: '+50% damage to distant enemies', tier: 3, levelRequired: 10, requires: ['archer_explosive_arrow'], type: 'passive', passive: { sniper: true } },
        { id: 'archer_multi_shot', name: 'Multi-Shot', description: 'Ability: Fire 3 arrows in a spread', tier: 3, levelRequired: 10, requires: ['archer_rapid_fire'], type: 'ability', grantsAbility: { name: 'Multi-Shot', damage: 25, projectiles: 3, spread: 30, cooldown: 6, type: 'projectile' } },
        { id: 'archer_trap', name: 'Trap Mastery', description: 'Ability: Place slowing traps', tier: 3, levelRequired: 10, requires: ['archer_evasion'], type: 'ability', grantsAbility: { name: 'Trap', slowAmount: 0.5, duration: 5, cooldown: 12, type: 'trap' } },
        // Tier 4
        { id: 'archer_arrow_storm', name: 'Arrow Storm', description: 'Ultimate: Rain of arrows on large area', tier: 4, levelRequired: 20, requires: ['archer_sniper', 'archer_multi_shot'], type: 'ability', grantsAbility: { name: 'Arrow Storm', damage: 10, hits: 20, cooldown: 45, radius: 200, type: 'ultimate' } },
        { id: 'archer_piercing_shot', name: 'Piercing Shot', description: 'Arrows pierce through enemies', tier: 4, levelRequired: 20, requires: ['archer_trap'], type: 'passive', passive: { piercing: true } },
        // Tier 5
        { id: 'archer_legendary_hunter', name: 'Legendary Hunter', description: 'All arrow abilities have +50% damage and reduced cooldown', tier: 5, levelRequired: 30, requires: ['archer_arrow_storm', 'archer_piercing_shot'], type: 'passive', passive: { arrowMastery: true, cooldownReduction: 0.25, damageBonus: 0.5 } }
    ],
    
    // ============ NINJA SKILL TREE ============
    ninja: [
        // Tier 1
        { id: 'ninja_swift_strike', name: 'Swift Strike', description: '+20% movement speed', tier: 1, levelRequired: 1, type: 'passive', passive: { speedBonus: 20 } },
        { id: 'ninja_ninjutsu', name: 'Ninjutsu Training', description: '+15% ability damage', tier: 1, levelRequired: 1, type: 'passive', passive: { abilityDamageBonus: 0.15 } },
        { id: 'ninja_stealth', name: 'Stealth Mastery', description: 'Reduced detection range', tier: 1, levelRequired: 1, type: 'passive', passive: { detectionReduction: 0.3 } },
        // Tier 2
        { id: 'ninja_shadow_clone_upgrade', name: 'Advanced Clones', description: 'Shadow clones can attack', tier: 2, levelRequired: 5, requires: ['ninja_swift_strike'], type: 'passive', passive: { attackingClones: true } },
        { id: 'ninja_elemental_jutsu', name: 'Elemental Jutsu', description: 'Unlock additional jutsu elements', tier: 2, levelRequired: 5, requires: ['ninja_ninjutsu'], type: 'passive', passive: { unlocksElements: ['water', 'earth'] } },
        { id: 'ninja_smoke_bomb', name: 'Smoke Bomb', description: 'Ability: Blind nearby enemies', tier: 2, levelRequired: 5, requires: ['ninja_stealth'], type: 'ability', grantsAbility: { name: 'Smoke Bomb', radius: 100, duration: 3, cooldown: 15, type: 'control' } },
        // Tier 3
        { id: 'ninja_substitution', name: 'Substitution Jutsu', description: 'Ability: Escape fatal damage', tier: 3, levelRequired: 10, requires: ['ninja_shadow_clone_upgrade'], type: 'ability', grantsAbility: { name: 'Substitution', cooldown: 30, type: 'escape' } },
        { id: 'ninja_kunai_barrage', name: 'Kunai Barrage', description: 'Ability: Throw 6 kunai in a fan', tier: 3, levelRequired: 10, requires: ['ninja_elemental_jutsu'], type: 'ability', grantsAbility: { name: 'Kunai Barrage', damage: 18, projectiles: 6, cooldown: 8, type: 'projectile' } },
        { id: 'ninja_assassinate', name: 'Assassinate', description: '+100% crit damage from stealth', tier: 3, levelRequired: 10, requires: ['ninja_smoke_bomb'], type: 'passive', passive: { stealthCritBonus: 1.0 } },
        // Tier 4
        { id: 'ninja_ultimate_jutsu', name: 'Forbidden Jutsu', description: 'Ultimate: Massive elemental devastation', tier: 4, levelRequired: 20, requires: ['ninja_substitution', 'ninja_kunai_barrage'], type: 'ability', grantsAbility: { name: 'Forbidden Jutsu', damage: 200, manaCost: 80, cooldown: 60, radius: 250, type: 'ultimate' } },
        { id: 'ninja_shadow_walk', name: 'Shadow Walk', description: 'Ability: Brief invisibility', tier: 4, levelRequired: 20, requires: ['ninja_assassinate'], type: 'ability', grantsAbility: { name: 'Shadow Walk', duration: 4, cooldown: 20, type: 'stealth' } },
        // Tier 5
        { id: 'ninja_grandmaster', name: 'Grandmaster Ninja', description: 'All abilities cost 30% less, clones last twice as long', tier: 5, levelRequired: 30, requires: ['ninja_ultimate_jutsu', 'ninja_shadow_walk'], type: 'passive', passive: { costReduction: 0.3, cloneDuration: 2.0 } }
    ],
    
    // ============ SAMURAI SKILL TREE ============
    samurai: [
        // Tier 1
        { id: 'samurai_way_of_blade', name: 'Way of the Blade', description: '+20% katana damage', tier: 1, levelRequired: 1, type: 'passive', passive: { katanaDamageBonus: 0.2 } },
        { id: 'samurai_bushido', name: 'Bushido', description: '+10% crit chance', tier: 1, levelRequired: 1, type: 'passive', passive: { critChanceBonus: 10 } },
        { id: 'samurai_focus', name: 'Focus', description: 'Stand still to gain damage', tier: 1, levelRequired: 1, type: 'passive', passive: { focusDamageBonus: 0.3 } },
        // Tier 2
        { id: 'samurai_quick_sheath', name: 'Quick Sheath', description: 'Iaijutsu cooldown reduced by 2s', tier: 2, levelRequired: 5, requires: ['samurai_way_of_blade'], type: 'passive', passive: { iaijutsuCDR: 2 } },
        { id: 'samurai_honor', name: 'Honor', description: '+25% damage when above 80% health', tier: 2, levelRequired: 5, requires: ['samurai_bushido'], type: 'passive', passive: { honorDamage: 0.25 } },
        { id: 'samurai_parry', name: 'Parry', description: 'Ability: Perfect block window', tier: 2, levelRequired: 5, requires: ['samurai_focus'], type: 'ability', grantsAbility: { name: 'Parry', window: 0.5, cooldown: 4, type: 'defense' } },
        // Tier 3
        { id: 'samurai_thousand_cuts', name: 'Thousand Cuts', description: 'Ability: Extremely rapid slashes', tier: 3, levelRequired: 10, requires: ['samurai_quick_sheath'], type: 'ability', grantsAbility: { name: 'Thousand Cuts', damage: 8, hits: 15, staminaCost: 60, cooldown: 15, type: 'melee' } },
        { id: 'samurai_unshakeable', name: 'Unshakeable', description: 'Cannot be knocked back', tier: 3, levelRequired: 10, requires: ['samurai_honor'], type: 'passive', passive: { knockbackImmune: true } },
        { id: 'samurai_counter', name: 'Counter Strike', description: 'Successful parry deals 200% damage', tier: 3, levelRequired: 10, requires: ['samurai_parry'], type: 'passive', passive: { counterDamage: 2.0 } },
        // Tier 4
        { id: 'samurai_final_strike', name: 'Final Strike', description: 'Ultimate: One devastating blow', tier: 4, levelRequired: 20, requires: ['samurai_thousand_cuts', 'samurai_unshakeable'], type: 'ability', grantsAbility: { name: 'Final Strike', damage: 300, staminaCost: 80, cooldown: 45, type: 'ultimate' } },
        // Tier 5
        { id: 'samurai_kensei', name: 'Kensei', description: 'Sword Saint: All attacks can crit, +30% crit damage', tier: 5, levelRequired: 30, requires: ['samurai_final_strike', 'samurai_counter'], type: 'passive', passive: { swordSaint: true, critDamageBonus: 0.3 } }
    ],
    
    // ============ VIKING SKILL TREE ============
    viking: [
        // Tier 1
        { id: 'viking_rage', name: 'Rage', description: '+5% damage per 10% missing health', tier: 1, levelRequired: 1, type: 'passive', passive: { rageDamage: 0.05 } },
        { id: 'viking_thick_skin', name: 'Thick Skin', description: '+15% max health', tier: 1, levelRequired: 1, type: 'passive', passive: { healthBonus: 0.15 } },
        { id: 'viking_battle_cry', name: 'Battle Cry', description: 'Intimidate nearby enemies', tier: 1, levelRequired: 1, type: 'passive', passive: { intimidate: true } },
        // Tier 2
        { id: 'viking_bloodbath', name: 'Bloodbath', description: 'Heal 10% of damage dealt', tier: 2, levelRequired: 5, requires: ['viking_rage'], type: 'passive', passive: { lifesteal: 0.1 } },
        { id: 'viking_war_paint', name: 'War Paint', description: '+20% damage reduction while raging', tier: 2, levelRequired: 5, requires: ['viking_thick_skin'], type: 'passive', passive: { rageDR: 0.2 } },
        { id: 'viking_axe_throw', name: 'Axe Throw', description: 'Ability: Throw axe at range', tier: 2, levelRequired: 5, requires: ['viking_battle_cry'], type: 'ability', grantsAbility: { name: 'Axe Throw', damage: 45, cooldown: 6, range: 200, type: 'projectile' } },
        // Tier 3
        { id: 'viking_dual_wield', name: 'Dual Wield', description: 'Wield two weapons', tier: 3, levelRequired: 10, requires: ['viking_bloodbath'], type: 'passive', passive: { dualWield: true } },
        { id: 'viking_berserker', name: 'Berserker', description: 'Ability: Enter berserk state', tier: 3, levelRequired: 10, requires: ['viking_war_paint'], type: 'ability', grantsAbility: { name: 'Berserker', duration: 10, damageBonus: 0.5, cooldown: 30, type: 'buff' } },
        { id: 'viking_whirlwind', name: 'Whirlwind', description: 'Ability: Spinning attack', tier: 3, levelRequired: 10, requires: ['viking_axe_throw'], type: 'ability', grantsAbility: { name: 'Whirlwind', damage: 30, hits: 4, radius: 80, cooldown: 10, type: 'melee' } },
        // Tier 4
        { id: 'viking_ragnarok', name: 'Ragnarok', description: 'Ultimate: Devastating AOE slam', tier: 4, levelRequired: 20, requires: ['viking_dual_wield', 'viking_berserker'], type: 'ability', grantsAbility: { name: 'Ragnarok', damage: 150, staminaCost: 100, cooldown: 50, radius: 180, type: 'ultimate' } },
        // Tier 5
        { id: 'viking_warlord', name: 'Warlord', description: 'Berserk now heals, +50% lifesteal while raging', tier: 5, levelRequired: 30, requires: ['viking_ragnarok', 'viking_whirlwind'], type: 'passive', passive: { berserkHeal: true, rageLifesteal: 0.5 } }
    ],
    
    // ============ NECROMANCER SKILL TREE ============
    necromancer: [
        // Tier 1
        { id: 'necro_bone_armor', name: 'Bone Armor', description: 'Passive bone shield absorbs damage', tier: 1, levelRequired: 1, type: 'passive', passive: { boneArmor: 30 } },
        { id: 'necro_minion_mastery', name: 'Minion Mastery', description: '+2 max minions', tier: 1, levelRequired: 1, type: 'passive', passive: { maxMinionBonus: 2 } },
        { id: 'necro_dark_pact', name: 'Dark Pact', description: 'Sacrifice health for power', tier: 1, levelRequired: 1, type: 'passive', passive: { darkPact: true } },
        // Tier 2
        { id: 'necro_life_tap', name: 'Life Tap', description: 'Minions heal you on hit', tier: 2, levelRequired: 5, requires: ['necro_minion_mastery'], type: 'passive', passive: { minionLifesteal: 0.05 } },
        { id: 'necro_skeleton_mage', name: 'Raise Skeleton Mage', description: 'Ability: Summon ranged skeleton', tier: 2, levelRequired: 5, requires: ['necro_bone_armor'], type: 'ability', grantsAbility: { name: 'Raise Skeleton Mage', manaCost: 40, cooldown: 12, type: 'summon', minionType: 'skeleton_mage' } },
        { id: 'necro_corpse_explosion', name: 'Corpse Explosion', description: 'Ability: Explode dead enemies', tier: 2, levelRequired: 5, requires: ['necro_dark_pact'], type: 'ability', grantsAbility: { name: 'Corpse Explosion', damage: 60, radius: 80, cooldown: 8, type: 'aoe' } },
        // Tier 3
        { id: 'necro_army_upgrade', name: 'Undying Army', description: 'Army of Dead summons more units', tier: 3, levelRequired: 10, requires: ['necro_life_tap'], type: 'passive', passive: { armyBonus: 4 } },
        { id: 'necro_bone_wall', name: 'Bone Wall', description: 'Ability: Create barrier of bones', tier: 3, levelRequired: 10, requires: ['necro_skeleton_mage'], type: 'ability', grantsAbility: { name: 'Bone Wall', duration: 6, cooldown: 15, type: 'defense' } },
        { id: 'necro_death_touch', name: 'Death Touch', description: 'Attacks apply decay damage', tier: 3, levelRequired: 10, requires: ['necro_corpse_explosion'], type: 'passive', passive: { decayDamage: 10 } },
        // Tier 4
        { id: 'necro_lich', name: 'Lich Form', description: 'Ultimate: Transform into a Lich', tier: 4, levelRequired: 20, requires: ['necro_army_upgrade', 'necro_bone_wall'], type: 'ability', grantsAbility: { name: 'Lich Form', duration: 20, cooldown: 90, type: 'ultimate' } },
        // Tier 5
        { id: 'necro_death_lord', name: 'Death Lord', description: 'Minions become permanent, +100% minion damage', tier: 5, levelRequired: 30, requires: ['necro_lich', 'necro_death_touch'], type: 'passive', passive: { permanentMinions: true, minionDamageBonus: 1.0 } }
    ],
    
    // ============ PRIEST SKILL TREE ============
    priest: [
        // Tier 1
        { id: 'priest_divine_light', name: 'Divine Light', description: '+25% healing effectiveness', tier: 1, levelRequired: 1, type: 'passive', passive: { healingBonus: 0.25 } },
        { id: 'priest_holy_fire', name: 'Holy Fire', description: '+20% damage to undead/demons', tier: 1, levelRequired: 1, type: 'passive', passive: { holyDamage: 0.2 } },
        { id: 'priest_blessing', name: 'Blessing', description: 'Start combat with a shield', tier: 1, levelRequired: 1, type: 'passive', passive: { combatShield: 50 } },
        // Tier 2
        { id: 'priest_sanctuary', name: 'Sanctuary', description: 'Ability: Create healing zone', tier: 2, levelRequired: 5, requires: ['priest_divine_light'], type: 'ability', grantsAbility: { name: 'Sanctuary', healPerSecond: 15, manaCost: 40, cooldown: 20, duration: 8, radius: 100, type: 'zone' } },
        { id: 'priest_smite_upgrade', name: 'Greater Smite', description: 'Smite chains to additional targets', tier: 2, levelRequired: 5, requires: ['priest_holy_fire'], type: 'passive', passive: { smiteChain: 2 } },
        { id: 'priest_purity', name: 'Purity', description: 'Ability: Remove debuffs', tier: 2, levelRequired: 5, requires: ['priest_blessing'], type: 'ability', grantsAbility: { name: 'Purity', cooldown: 12, type: 'cleanse' } },
        // Tier 3
        { id: 'priest_mass_heal', name: 'Mass Heal', description: 'Ability: Heal all nearby allies', tier: 3, levelRequired: 10, requires: ['priest_sanctuary'], type: 'ability', grantsAbility: { name: 'Mass Heal', healAmount: 60, manaCost: 60, cooldown: 25, radius: 200, type: 'heal' } },
        { id: 'priest_holy_nova', name: 'Holy Nova', description: 'Ability: Damage enemies, heal allies', tier: 3, levelRequired: 10, requires: ['priest_smite_upgrade'], type: 'ability', grantsAbility: { name: 'Holy Nova', damage: 40, healAmount: 30, cooldown: 15, radius: 120, type: 'aoe' } },
        { id: 'priest_guardian_angel', name: 'Guardian Angel', description: 'Survive fatal blow once per room', tier: 3, levelRequired: 10, requires: ['priest_purity'], type: 'passive', passive: { guardianAngel: true } },
        // Tier 4
        { id: 'priest_divine_intervention', name: 'Divine Intervention', description: 'Ultimate: Prevent all deaths for 5s', tier: 4, levelRequired: 20, requires: ['priest_mass_heal', 'priest_holy_nova'], type: 'ability', grantsAbility: { name: 'Divine Intervention', duration: 5, cooldown: 120, radius: 300, type: 'ultimate' } },
        // Tier 5
        { id: 'priest_avatar_of_light', name: 'Avatar of Light', description: 'Permanent healing aura, +50% holy damage', tier: 5, levelRequired: 30, requires: ['priest_divine_intervention', 'priest_guardian_angel'], type: 'passive', passive: { healingAura: true, holyDamageBonus: 0.5 } }
    ],
    
    // ============ DARK MAGE SKILL TREE ============
    darkmage: [
        // Tier 1
        { id: 'dark_corruption', name: 'Corruption', description: 'Dark spells apply DOT', tier: 1, levelRequired: 1, type: 'passive', passive: { darkDOT: 5 } },
        { id: 'dark_soul_siphon', name: 'Soul Siphon', description: '+15% life drain effectiveness', tier: 1, levelRequired: 1, type: 'passive', passive: { drainBonus: 0.15 } },
        { id: 'dark_shadow_bolt', name: 'Shadow Bolt Mastery', description: '+25% shadow bolt damage', tier: 1, levelRequired: 1, type: 'passive', passive: { shadowBoltDamage: 0.25 } },
        // Tier 2
        { id: 'dark_fear', name: 'Fear', description: 'Ability: Terrify enemies', tier: 2, levelRequired: 5, requires: ['dark_corruption'], type: 'ability', grantsAbility: { name: 'Fear', manaCost: 30, cooldown: 15, duration: 3, radius: 120, type: 'control' } },
        { id: 'dark_sacrifice', name: 'Dark Sacrifice', description: 'Spend health to restore mana', tier: 2, levelRequired: 5, requires: ['dark_soul_siphon'], type: 'passive', passive: { sacrifice: true } },
        { id: 'dark_curse', name: 'Curse', description: 'Ability: Weaken enemy defenses', tier: 2, levelRequired: 5, requires: ['dark_shadow_bolt'], type: 'ability', grantsAbility: { name: 'Curse', defenseReduction: 0.3, duration: 10, cooldown: 12, type: 'debuff' } },
        // Tier 3
        { id: 'dark_soul_rend', name: 'Soul Rend', description: 'Ability: Rip soul dealing massive damage', tier: 3, levelRequired: 10, requires: ['dark_fear', 'dark_sacrifice'], type: 'ability', grantsAbility: { name: 'Soul Rend', damage: 100, manaCost: 50, cooldown: 12, range: 150, type: 'single' } },
        { id: 'dark_shadow_step', name: 'Shadow Step', description: 'Ability: Teleport through shadows', tier: 3, levelRequired: 10, requires: ['dark_curse'], type: 'ability', grantsAbility: { name: 'Shadow Step', cooldown: 8, distance: 200, type: 'teleport' } },
        // Tier 4
        { id: 'dark_apocalypse', name: 'Apocalypse', description: 'Ultimate: Rain of dark destruction', tier: 4, levelRequired: 20, requires: ['dark_soul_rend', 'dark_shadow_step'], type: 'ability', grantsAbility: { name: 'Apocalypse', damage: 200, manaCost: 100, cooldown: 60, radius: 300, type: 'ultimate' } },
        // Tier 5
        { id: 'dark_void_lord', name: 'Void Lord', description: 'All dark damage doubled, enemies flee in terror', tier: 5, levelRequired: 30, requires: ['dark_apocalypse'], type: 'passive', passive: { darkDamageMultiplier: 2.0, terrorAura: true } }
    ],
    
    // ============ ARCMAGE SKILL TREE ============
    arcmage: [
        // Tier 1
        { id: 'arc_pure_arcane', name: 'Pure Arcane', description: '+25% arcane damage', tier: 1, levelRequired: 1, type: 'passive', passive: { arcaneDamageBonus: 0.25 } },
        { id: 'arc_mana_surge', name: 'Mana Surge', description: '+50 max mana', tier: 1, levelRequired: 1, type: 'passive', passive: { manaBonus: 50 } },
        { id: 'arc_arcane_missiles', name: 'Arcane Missiles', description: '+3 arcane missile projectiles', tier: 1, levelRequired: 1, type: 'passive', passive: { missileBonus: 3 } },
        // Tier 2
        { id: 'arc_reality_tear', name: 'Reality Tear', description: 'Ability: Create damaging rift', tier: 2, levelRequired: 5, requires: ['arc_pure_arcane'], type: 'ability', grantsAbility: { name: 'Reality Tear', damage: 50, manaCost: 40, cooldown: 10, duration: 4, type: 'zone' } },
        { id: 'arc_mana_shield', name: 'Arcane Barrier', description: 'Passive shield using mana', tier: 2, levelRequired: 5, requires: ['arc_mana_surge'], type: 'passive', passive: { manaShield: 0.3 } },
        { id: 'arc_mirror_image', name: 'Mirror Image', description: 'Ability: Create arcane decoys', tier: 2, levelRequired: 5, requires: ['arc_arcane_missiles'], type: 'ability', grantsAbility: { name: 'Mirror Image', copies: 3, duration: 8, cooldown: 20, type: 'summon' } },
        // Tier 3
        { id: 'arc_blink', name: 'Blink Mastery', description: 'Teleport distance +50%', tier: 3, levelRequired: 10, requires: ['arc_reality_tear'], type: 'passive', passive: { teleportBonus: 0.5 } },
        { id: 'arc_arcane_orb', name: 'Arcane Orb', description: 'Ability: Slow-moving devastating orb', tier: 3, levelRequired: 10, requires: ['arc_mana_shield', 'arc_mirror_image'], type: 'ability', grantsAbility: { name: 'Arcane Orb', damage: 80, piercing: true, cooldown: 12, type: 'projectile' } },
        // Tier 4
        { id: 'arc_black_hole', name: 'Black Hole', description: 'Ultimate: Create a black hole', tier: 4, levelRequired: 20, requires: ['arc_blink', 'arc_arcane_orb'], type: 'ability', grantsAbility: { name: 'Black Hole', damage: 20, manaCost: 100, cooldown: 60, duration: 6, radius: 200, type: 'ultimate' } },
        // Tier 5
        { id: 'arc_archmage', name: 'Archmage Ascension', description: 'All spells can be cast while moving, +75% mana', tier: 5, levelRequired: 30, requires: ['arc_black_hole'], type: 'passive', passive: { mobileCasting: true, manaMultiplier: 1.75 } }
    ],
    
    // ============ MAGICAL KNIGHT SKILL TREE ============
    magicalknight: [
        // Tier 1
        { id: 'mk_runic_blade', name: 'Runic Blade', description: 'Attacks apply runes', tier: 1, levelRequired: 1, type: 'passive', passive: { runicAttacks: true } },
        { id: 'mk_spell_armor', name: 'Spell Armor', description: '+20% magic resistance', tier: 1, levelRequired: 1, type: 'passive', passive: { magicResist: 0.2 } },
        { id: 'mk_enchant', name: 'Enchant Weapon', description: '+15 magic damage to attacks', tier: 1, levelRequired: 1, type: 'passive', passive: { magicDamageOnHit: 15 } },
        // Tier 2
        { id: 'mk_arcane_charge', name: 'Arcane Charge', description: 'Ability: Dash with magic trail', tier: 2, levelRequired: 5, requires: ['mk_runic_blade'], type: 'ability', grantsAbility: { name: 'Arcane Charge', damage: 40, manaCost: 25, cooldown: 8, distance: 150, type: 'dash' } },
        { id: 'mk_mana_strike', name: 'Mana Strike', description: 'Attacks restore mana', tier: 2, levelRequired: 5, requires: ['mk_spell_armor'], type: 'passive', passive: { manaOnHit: 5 } },
        { id: 'mk_spellblade', name: 'Spellblade', description: 'Ability: Ranged magic slash', tier: 2, levelRequired: 5, requires: ['mk_enchant'], type: 'ability', grantsAbility: { name: 'Spellblade', damage: 35, range: 200, cooldown: 5, type: 'projectile' } },
        // Tier 3
        { id: 'mk_rune_mastery', name: 'Rune Mastery', description: 'Rune explosion damage +50%', tier: 3, levelRequired: 10, requires: ['mk_arcane_charge', 'mk_mana_strike'], type: 'passive', passive: { runeDamageBonus: 0.5 } },
        { id: 'mk_aegis', name: 'Aegis Shield', description: 'Ability: Magic damage immunity', tier: 3, levelRequired: 10, requires: ['mk_spellblade'], type: 'ability', grantsAbility: { name: 'Aegis Shield', duration: 4, cooldown: 20, type: 'defense' } },
        // Tier 4
        { id: 'mk_avatar', name: 'Avatar of Magic', description: 'Ultimate: Transform into magic avatar', tier: 4, levelRequired: 20, requires: ['mk_rune_mastery', 'mk_aegis'], type: 'ability', grantsAbility: { name: 'Avatar of Magic', duration: 15, cooldown: 90, type: 'ultimate' } },
        // Tier 5
        { id: 'mk_arcane_lord', name: 'Arcane Lord', description: 'Permanent rune aura damages nearby enemies', tier: 5, levelRequired: 30, requires: ['mk_avatar'], type: 'passive', passive: { runeAura: true, auraDamage: 20 } }
    ],
    
    // ============ MUSKETEER SKILL TREE ============
    musketeer: [
        // Tier 1
        { id: 'musk_gunslinger', name: 'Gunslinger', description: '+20% firearm damage', tier: 1, levelRequired: 1, type: 'passive', passive: { firearmDamage: 0.2 } },
        { id: 'musk_fencer', name: 'Fencer', description: '+15% rapier attack speed', tier: 1, levelRequired: 1, type: 'passive', passive: { rapierSpeed: 0.15 } },
        { id: 'musk_riposte', name: 'Riposte', description: 'Counter after successful dodge', tier: 1, levelRequired: 1, type: 'passive', passive: { riposte: true } },
        // Tier 2
        { id: 'musk_double_shot', name: 'Double Shot', description: 'Ability: Fire two shots', tier: 2, levelRequired: 5, requires: ['musk_gunslinger'], type: 'ability', grantsAbility: { name: 'Double Shot', damage: 40, cooldown: 6, type: 'projectile', projectiles: 2 } },
        { id: 'musk_lunge', name: 'Lunge', description: 'Ability: Dashing thrust attack', tier: 2, levelRequired: 5, requires: ['musk_fencer'], type: 'ability', grantsAbility: { name: 'Lunge', damage: 35, staminaCost: 25, cooldown: 5, distance: 100, type: 'dash' } },
        { id: 'musk_flourish', name: 'Flourish', description: 'Ability: Flashy multi-hit combo', tier: 2, levelRequired: 5, requires: ['musk_riposte'], type: 'ability', grantsAbility: { name: 'Flourish', damage: 15, hits: 4, cooldown: 8, type: 'melee' } },
        // Tier 3
        { id: 'musk_all_for_one', name: 'All For One', description: 'Ability: Powerful combo attack', tier: 3, levelRequired: 10, requires: ['musk_double_shot', 'musk_lunge'], type: 'ability', grantsAbility: { name: 'All For One', damage: 80, cooldown: 15, type: 'combo' } },
        { id: 'musk_en_garde', name: 'En Garde', description: 'Perfect parry window extended', tier: 3, levelRequired: 10, requires: ['musk_flourish'], type: 'passive', passive: { parryWindow: 0.4 } },
        // Tier 4
        { id: 'musk_honor_duel', name: 'Honor Duel', description: 'Ultimate: Challenge boss to duel', tier: 4, levelRequired: 20, requires: ['musk_all_for_one', 'musk_en_garde'], type: 'ability', grantsAbility: { name: 'Honor Duel', duration: 20, cooldown: 90, type: 'ultimate' } },
        // Tier 5
        { id: 'musk_legendary_duelist', name: 'Legendary Duelist', description: '+100% crit chance during duels, riposte always crits', tier: 5, levelRequired: 30, requires: ['musk_honor_duel'], type: 'passive', passive: { duelMastery: true, riposteCrit: true } }
    ]
};

export default SkillTree;
