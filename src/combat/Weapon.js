/**
 * Weapon System - All weapons available in the game
 */

export const WeaponTypes = {
    // Melee Weapons
    sword: {
        name: 'Sword',
        type: 'melee',
        range: 50,
        attackSpeed: 1.0,
        damageType: 'physical',
        twoHanded: false
    },
    katana: {
        name: 'Katana',
        type: 'melee',
        range: 55,
        attackSpeed: 1.2,
        damageType: 'physical',
        critBonus: 10,
        twoHanded: true
    },
    dagger: {
        name: 'Dagger',
        type: 'melee',
        range: 30,
        attackSpeed: 1.8,
        damageType: 'physical',
        critBonus: 15,
        twoHanded: false
    },
    axe: {
        name: 'Axe',
        type: 'melee',
        range: 45,
        attackSpeed: 0.8,
        damageType: 'physical',
        cleave: true,
        twoHanded: false
    },
    hammer: {
        name: 'Hammer',
        type: 'melee',
        range: 40,
        attackSpeed: 0.6,
        damageType: 'physical',
        stun: true,
        twoHanded: true
    },
    mace: {
        name: 'Mace',
        type: 'melee',
        range: 40,
        attackSpeed: 0.9,
        damageType: 'physical',
        armorPierce: 0.2,
        twoHanded: false
    },
    lance: {
        name: 'Lance',
        type: 'melee',
        range: 80,
        attackSpeed: 0.7,
        damageType: 'physical',
        chargeBonus: 2.0,
        twoHanded: true
    },
    rapier: {
        name: 'Rapier',
        type: 'melee',
        range: 55,
        attackSpeed: 1.4,
        damageType: 'physical',
        critBonus: 5,
        twoHanded: false
    },
    scythe: {
        name: 'Scythe',
        type: 'melee',
        range: 70,
        attackSpeed: 0.7,
        damageType: 'physical',
        lifeSteal: 0.1,
        twoHanded: true
    },
    naginata: {
        name: 'Naginata',
        type: 'melee',
        range: 75,
        attackSpeed: 0.85,
        damageType: 'physical',
        sweep: true,
        twoHanded: true
    },
    kusarigama: {
        name: 'Kusarigama',
        type: 'melee',
        range: 60,
        attackSpeed: 1.1,
        damageType: 'physical',
        pullEnemy: true,
        twoHanded: true
    },
    
    // Ranged Weapons
    bow: {
        name: 'Bow',
        type: 'ranged',
        range: 300,
        attackSpeed: 1.0,
        damageType: 'physical',
        projectileSpeed: 500,
        twoHanded: true
    },
    crossbow: {
        name: 'Crossbow',
        type: 'ranged',
        range: 350,
        attackSpeed: 0.5,
        damageType: 'physical',
        projectileSpeed: 600,
        armorPierce: 0.3,
        twoHanded: true
    },
    musket: {
        name: 'Musket',
        type: 'ranged',
        range: 400,
        attackSpeed: 0.3,
        damageType: 'physical',
        projectileSpeed: 800,
        reloadTime: 2.0,
        twoHanded: true
    },
    pistol: {
        name: 'Pistol',
        type: 'ranged',
        range: 200,
        attackSpeed: 0.5,
        damageType: 'physical',
        projectileSpeed: 700,
        reloadTime: 1.0,
        twoHanded: false
    },
    shuriken: {
        name: 'Shuriken',
        type: 'ranged',
        range: 150,
        attackSpeed: 2.0,
        damageType: 'physical',
        projectileSpeed: 400,
        multiThrow: 3,
        twoHanded: false
    },
    throwing_knife: {
        name: 'Throwing Knife',
        type: 'ranged',
        range: 180,
        attackSpeed: 1.5,
        damageType: 'physical',
        projectileSpeed: 450,
        critBonus: 10,
        twoHanded: false
    },
    kunai: {
        name: 'Kunai',
        type: 'ranged',
        range: 160,
        attackSpeed: 1.8,
        damageType: 'physical',
        projectileSpeed: 420,
        twoHanded: false
    },
    
    // Magic Weapons
    staff: {
        name: 'Staff',
        type: 'magic',
        range: 250,
        attackSpeed: 0.8,
        damageType: 'magic',
        manaRegen: 2,
        twoHanded: true
    },
    wand: {
        name: 'Wand',
        type: 'magic',
        range: 200,
        attackSpeed: 1.2,
        damageType: 'magic',
        castSpeedBonus: 0.1,
        twoHanded: false
    },
    tome: {
        name: 'Tome',
        type: 'magic',
        range: 220,
        attackSpeed: 0.6,
        damageType: 'magic',
        spellPower: 0.15,
        twoHanded: false
    },
    orb: {
        name: 'Orb',
        type: 'magic',
        range: 180,
        attackSpeed: 1.0,
        damageType: 'magic',
        manaRegen: 3,
        twoHanded: false
    },
    
    // Shields
    shield: {
        name: 'Shield',
        type: 'shield',
        blockChance: 0.3,
        blockAmount: 0.5,
        twoHanded: false
    }
};

// Weapon rarity tiers
export const WeaponRarities = {
    common: { color: '#ffffff', statMultiplier: 1.0, dropChance: 0.6 },
    uncommon: { color: '#1eff00', statMultiplier: 1.2, dropChance: 0.25 },
    rare: { color: '#0070dd', statMultiplier: 1.5, dropChance: 0.1 },
    epic: { color: '#a335ee', statMultiplier: 2.0, dropChance: 0.04 },
    legendary: { color: '#ff8000', statMultiplier: 3.0, dropChance: 0.01 }
};

// Weapon class for actual weapon instances
export class Weapon {
    constructor(type, rarity = 'common', level = 1) {
        const baseWeapon = WeaponTypes[type];
        const rarityData = WeaponRarities[rarity];
        
        if (!baseWeapon) {
            throw new Error(`Unknown weapon type: ${type}`);
        }
        
        this.type = type;
        this.weaponType = baseWeapon.type;
        this.name = this.generateName(baseWeapon.name, rarity);
        this.rarity = rarity;
        this.level = level;
        this.slot = 'weapon';
        
        // Base stats scaled by level and rarity
        this.damage = Math.floor((10 + level * 3) * rarityData.statMultiplier);
        this.range = baseWeapon.range;
        this.attackSpeed = baseWeapon.attackSpeed;
        this.damageType = baseWeapon.damageType;
        this.twoHanded = baseWeapon.twoHanded;
        
        // Copy special properties
        this.critBonus = baseWeapon.critBonus || 0;
        this.armorPierce = baseWeapon.armorPierce || 0;
        this.lifeSteal = baseWeapon.lifeSteal || 0;
        this.manaRegen = baseWeapon.manaRegen || 0;
        this.spellPower = baseWeapon.spellPower || 0;
        this.cleave = baseWeapon.cleave || false;
        this.stun = baseWeapon.stun || false;
        this.sweep = baseWeapon.sweep || false;
        this.projectileSpeed = baseWeapon.projectileSpeed || 0;
        this.reloadTime = baseWeapon.reloadTime || 0;
        this.blockChance = baseWeapon.blockChance || 0;
        this.blockAmount = baseWeapon.blockAmount || 0;
        
        // Random bonus stats for higher rarities
        this.stats = {};
        if (rarity !== 'common') {
            this.generateBonusStats(rarity);
        }
        
        // Visual
        this.color = rarityData.color;
    }
    
    generateName(baseName, rarity) {
        const prefixes = {
            common: [''],
            uncommon: ['Fine', 'Quality', 'Sharp'],
            rare: ['Superior', 'Masterwork', 'Enchanted'],
            epic: ['Magnificent', 'Arcane', 'Blessed'],
            legendary: ['Legendary', 'Mythical', 'Divine']
        };
        
        const prefix = prefixes[rarity][Math.floor(Math.random() * prefixes[rarity].length)];
        return prefix ? `${prefix} ${baseName}` : baseName;
    }
    
    generateBonusStats(rarity) {
        const numBonuses = {
            uncommon: 1,
            rare: 2,
            epic: 3,
            legendary: 4
        }[rarity] || 0;
        
        const possibleStats = [
            { stat: 'strength', min: 1, max: 5 },
            { stat: 'agility', min: 1, max: 5 },
            { stat: 'intelligence', min: 1, max: 5 },
            { stat: 'vitality', min: 1, max: 5 },
            { stat: 'luck', min: 1, max: 3 }
        ];
        
        for (let i = 0; i < numBonuses; i++) {
            const stat = possibleStats[Math.floor(Math.random() * possibleStats.length)];
            const value = Math.floor(Math.random() * (stat.max - stat.min + 1)) + stat.min;
            this.stats[stat.stat] = (this.stats[stat.stat] || 0) + value * this.level * 0.5;
        }
    }
    
    getTooltip() {
        let tooltip = `${this.name}\n`;
        tooltip += `Level ${this.level} ${this.type}\n`;
        tooltip += `Damage: ${this.damage}\n`;
        tooltip += `Attack Speed: ${this.attackSpeed.toFixed(1)}\n`;
        tooltip += `Range: ${this.range}\n`;
        
        if (this.critBonus) tooltip += `+${this.critBonus}% Crit Chance\n`;
        if (this.armorPierce) tooltip += `${(this.armorPierce * 100).toFixed(0)}% Armor Pierce\n`;
        if (this.lifeSteal) tooltip += `${(this.lifeSteal * 100).toFixed(0)}% Life Steal\n`;
        
        for (const [stat, value] of Object.entries(this.stats)) {
            tooltip += `+${Math.floor(value)} ${stat}\n`;
        }
        
        return tooltip;
    }
}

// Generate random weapon drop
export function generateWeaponDrop(level, luckOrType = 10, explicitType = null) {
    let luck = 10;
    let forcedType = null;
    
    // Handle different call signatures
    if (typeof luckOrType === 'string') {
        // Called as generateWeaponDrop(level, weaponType)
        forcedType = luckOrType;
    } else if (typeof luckOrType === 'number') {
        // Called as generateWeaponDrop(level, luck)
        luck = luckOrType;
        forcedType = explicitType;
    }
    
    // Determine rarity based on luck
    const roll = Math.random() * 100;
    const luckBonus = luck * 0.5;
    
    let rarity = 'common';
    if (roll < 1 + luckBonus * 0.1) rarity = 'legendary';
    else if (roll < 5 + luckBonus * 0.2) rarity = 'epic';
    else if (roll < 15 + luckBonus * 0.3) rarity = 'rare';
    else if (roll < 35 + luckBonus * 0.4) rarity = 'uncommon';
    
    // Pick weapon type
    let type;
    if (forcedType && WeaponTypes[forcedType]) {
        type = forcedType;
    } else {
        const types = Object.keys(WeaponTypes).filter(t => WeaponTypes[t].type !== 'shield');
        type = types[Math.floor(Math.random() * types.length)];
    }
    
    return new Weapon(type, rarity, level);
}

export default Weapon;
