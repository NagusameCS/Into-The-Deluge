/**
 * Class Definitions - All playable character classes
 * Each class has unique stats, abilities, weapons, and movement styles
 */

export const ClassDefinitions = {
    // ============ WARRIOR CLASSES ============
    
    knight: {
        name: 'Knight',
        description: 'A stalwart defender clad in heavy armor. Excels at tanking damage and protecting allies.',
        color: '#7899c4',
        
        // Default melee attack with improved range
        defaultAttackType: 'melee',
        defaultAttackRange: 180, // Large melee strike radius
        defaultAttackElement: 'physical',
        
        baseStats: {
            strength: 14,
            agility: 8,
            intelligence: 6,
            vitality: 16,
            luck: 6
        },
        
        statGrowth: {
            strength: 2,
            agility: 1,
            intelligence: 0.5,
            vitality: 3,
            luck: 0.5
        },
        
        baseSpeed: 120,
        sprintMultiplier: 1.3,
        canSprint: true,
        canDash: false,
        
        weaponTypes: ['sword', 'lance', 'mace', 'shield'],
        armorTypes: ['heavy'],
        
        abilities: [
            {
                name: 'Shield Bash',
                description: 'Bash enemy with shield, stunning them',
                damage: 15,
                staminaCost: 20,
                cooldown: 3,
                range: 40,
                type: 'melee',
                effects: [{ type: 'stun', duration: 1 }]
            },
            {
                name: 'Defensive Stance',
                description: 'Reduce incoming damage by 50% for 5 seconds',
                staminaCost: 30,
                cooldown: 15,
                type: 'buff',
                effects: [{ type: 'defense_up', value: 0.5, duration: 5 }]
            },
            {
                name: 'Provoke',
                description: 'Taunt nearby enemies to attack you',
                cooldown: 10,
                range: 150,
                type: 'taunt',
                duration: 5
            }
        ],
        
        passives: [
            { name: 'Heavy Armor Mastery', effect: 'Reduces armor speed penalty by 50%' },
            { name: 'Last Stand', effect: 'Gain 30% damage reduction when below 25% health' }
        ]
    },
    
    viking: {
        name: 'Viking',
        description: 'A fierce berserker from the north. Gains power as health decreases.',
        color: '#8b4513',
        
        // Default melee attack with improved range
        defaultAttackType: 'melee',
        defaultAttackRange: 170, // Large melee strike radius
        defaultAttackElement: 'physical',
        
        baseStats: {
            strength: 18,
            agility: 10,
            intelligence: 4,
            vitality: 14,
            luck: 4
        },
        
        statGrowth: {
            strength: 3,
            agility: 1.5,
            intelligence: 0.3,
            vitality: 2,
            luck: 0.3
        },
        
        baseSpeed: 140,
        sprintMultiplier: 1.4,
        canSprint: true,
        canDash: false,
        
        weaponTypes: ['axe', 'hammer', 'sword'],
        armorTypes: ['medium', 'light'],
        
        abilities: [
            {
                name: 'Berserker Rage',
                description: 'Enter a rage, gaining attack speed and damage but losing defense',
                duration: 10,
                cooldown: 30,
                type: 'buff',
                effects: [
                    { type: 'damage_up', value: 0.5 },
                    { type: 'attack_speed_up', value: 0.3 },
                    { type: 'defense_down', value: 0.3 }
                ]
            },
            {
                name: 'Whirlwind',
                description: 'Spin and damage all nearby enemies',
                damage: 25,
                staminaCost: 35,
                cooldown: 5,
                range: 60,
                type: 'aoe'
            },
            {
                name: 'War Cry',
                description: 'Intimidate enemies, reducing their damage',
                cooldown: 20,
                range: 200,
                type: 'debuff',
                effects: [{ type: 'damage_down', value: 0.2, duration: 8 }]
            }
        ],
        
        passives: [
            { name: 'Bloodlust', effect: 'Gain 2% damage for each 10% missing health' },
            { name: 'Viking Resilience', effect: 'Cannot be slowed below 70% base speed' }
        ]
    },
    
    samurai: {
        name: 'Samurai',
        description: 'A disciplined warrior focused on precise, devastating strikes.',
        color: '#dc143c',
        
        // Default melee attack with extended katana reach
        defaultAttackType: 'melee',
        defaultAttackRange: 190, // Long katana reach
        defaultAttackElement: 'physical',
        
        baseStats: {
            strength: 15,
            agility: 14,
            intelligence: 8,
            vitality: 10,
            luck: 8
        },
        
        statGrowth: {
            strength: 2.5,
            agility: 2,
            intelligence: 1,
            vitality: 1.5,
            luck: 1
        },
        
        baseSpeed: 160,
        sprintMultiplier: 1.4,
        canSprint: true,
        canDash: true,
        dashDistance: 150,
        dashCooldown: 2,
        
        weaponTypes: ['katana', 'naginata'],
        armorTypes: ['medium', 'light'],
        
        abilities: [
            {
                name: 'Iaijutsu',
                description: 'Quick-draw attack with very high critical chance',
                damage: 40,
                staminaCost: 25,
                cooldown: 6,
                range: 80,
                type: 'melee',
                critBonus: 50
            },
            {
                name: 'Blade Dance',
                description: 'Perform a series of rapid slashes',
                damage: 12,
                hits: 5,
                staminaCost: 40,
                cooldown: 8,
                range: 50,
                type: 'melee'
            },
            {
                name: 'Focus',
                description: 'Enter a focused state, guaranteeing next attack crits',
                duration: 5,
                cooldown: 20,
                type: 'buff',
                effects: [{ type: 'guaranteed_crit', duration: 5 }]
            }
        ],
        
        passives: [
            { name: 'Way of the Blade', effect: 'Katanas deal 25% more damage' },
            { name: 'Honorable Death', effect: 'Deal 50% more damage to enemies with full health' }
        ]
    },
    
    // ============ ROGUE CLASSES ============
    
    assassin: {
        name: 'Assassin',
        description: 'A deadly shadow that strikes from the darkness. Masters of critical hits and evasion.',
        color: '#2f2f2f',
        
        // Default attack is poison-infused melee
        defaultAttackType: 'melee',
        defaultAttackRange: 150, // Extended dagger reach
        defaultAttackElement: 'poison',
        
        baseStats: {
            strength: 10,
            agility: 18,
            intelligence: 8,
            vitality: 6,
            luck: 12
        },
        
        statGrowth: {
            strength: 1.5,
            agility: 3,
            intelligence: 1,
            vitality: 0.5,
            luck: 2
        },
        
        baseSpeed: 200,
        sprintMultiplier: 1.6,
        canSprint: true,
        canDash: true,
        dashDistance: 180,
        dashCooldown: 0, // No cooldown on dash for assassin
        dashInvulnerable: true,
        
        weaponTypes: ['dagger', 'short_sword', 'throwing_knife'],
        armorTypes: ['light'],
        
        abilities: [
            {
                name: 'Backstab',
                description: 'Deal massive damage from behind',
                damage: 60,
                staminaCost: 30,
                cooldown: 4,
                range: 40,
                type: 'melee',
                requiresPosition: 'behind',
                critBonus: 100
            },
            {
                name: 'Smoke Bomb',
                description: 'Create a smoke cloud and become invisible',
                cooldown: 15,
                type: 'utility',
                effects: [
                    { type: 'invisible', duration: 4 },
                    { type: 'smoke_cloud', duration: 6, radius: 80 }
                ]
            },
            {
                name: 'Poison Blade',
                description: 'Coat weapon in poison for next few attacks',
                cooldown: 12,
                type: 'buff',
                effects: [{ type: 'poison_attacks', stacks: 5, poisonDamage: 5, poisonDuration: 4 }]
            },
            {
                name: 'Shadow Step',
                description: 'Teleport behind target enemy',
                manaCost: 20,
                cooldown: 8,
                range: 200,
                type: 'teleport'
            }
        ],
        
        passives: [
            { name: 'Deadly Precision', effect: '+20% critical hit chance' },
            { name: 'Opportunist', effect: 'Deal 30% more damage to enemies attacking others' }
        ]
    },
    
    ninja: {
        name: 'Ninja',
        description: 'A versatile shadow warrior using both martial arts and ninjutsu techniques.',
        color: '#1a1a2e',
        
        // Default attack is kunai melee
        defaultAttackType: 'melee',
        defaultAttackRange: 160, // Extended kunai reach
        defaultAttackElement: 'physical',
        
        baseStats: {
            strength: 12,
            agility: 16,
            intelligence: 10,
            vitality: 8,
            luck: 10
        },
        
        statGrowth: {
            strength: 1.5,
            agility: 2.5,
            intelligence: 1.5,
            vitality: 1,
            luck: 1.5
        },
        
        baseSpeed: 190,
        sprintMultiplier: 1.5,
        canSprint: true,
        canDash: true,
        dashDistance: 150,
        dashCooldown: 0, // No cooldown on dash for ninja
        canWallJump: true,
        
        weaponTypes: ['kunai', 'shuriken', 'ninjato', 'kusarigama'],
        armorTypes: ['light'],
        
        abilities: [
            {
                name: 'Shuriken Barrage',
                description: 'Throw multiple shuriken at enemies',
                damage: 8,
                projectiles: 5,
                staminaCost: 25,
                cooldown: 4,
                range: 200,
                type: 'projectile'
            },
            {
                name: 'Shadow Clone',
                description: 'Create a decoy that distracts enemies',
                manaCost: 30,
                cooldown: 20,
                duration: 8,
                type: 'summon'
            },
            {
                name: 'Fire Jutsu',
                description: 'Breathe fire in a cone',
                damage: 35,
                manaCost: 25,
                cooldown: 6,
                range: 100,
                angle: 45,
                type: 'cone'
            },
            {
                name: 'Vanish',
                description: 'Become invisible and gain movement speed',
                manaCost: 20,
                cooldown: 12,
                type: 'buff',
                effects: [
                    { type: 'invisible', duration: 3 },
                    { type: 'speed_up', value: 0.5, duration: 3 }
                ]
            }
        ],
        
        passives: [
            { name: 'Swift as Shadow', effect: 'Movement abilities cost 30% less stamina' },
            { name: 'Ambush', effect: 'First attack from stealth deals 50% more damage' }
        ]
    },
    
    archer: {
        name: 'Archer',
        description: 'A master of ranged combat with deadly accuracy.',
        color: '#228b22',
        
        // Default attack is a ranged arrow shot
        defaultAttackType: 'arrow',
        defaultAttackRange: 350,
        defaultAttackElement: 'physical',
        defaultAttackSpeed: 550,
        
        baseStats: {
            strength: 8,
            agility: 16,
            intelligence: 8,
            vitality: 8,
            luck: 14
        },
        
        statGrowth: {
            strength: 1,
            agility: 2.5,
            intelligence: 1,
            vitality: 1,
            luck: 2
        },
        
        baseSpeed: 165,
        sprintMultiplier: 1.4,
        canSprint: true,
        canDash: true,
        dashDistance: 130,
        dashCooldown: 2.5,
        
        weaponTypes: ['bow', 'crossbow'],
        armorTypes: ['light', 'medium'],
        
        abilities: [
            {
                name: 'Power Shot',
                description: 'Charged shot that pierces enemies',
                damage: 45,
                staminaCost: 20,
                cooldown: 4,
                chargeTime: 1,
                range: 400,
                type: 'projectile',
                piercing: true
            },
            {
                name: 'Multi Shot',
                description: 'Fire three arrows in a spread',
                damage: 20,
                projectiles: 3,
                staminaCost: 25,
                cooldown: 5,
                range: 250,
                type: 'projectile'
            },
            {
                name: 'Rain of Arrows',
                description: 'Call down arrows in an area',
                damage: 10,
                hits: 8,
                staminaCost: 40,
                cooldown: 15,
                range: 300,
                radius: 100,
                type: 'aoe'
            },
            {
                name: 'Evasive Roll',
                description: 'Roll to evade attacks and reposition',
                staminaCost: 15,
                cooldown: 3,
                distance: 100,
                type: 'movement',
                invulnerable: true
            }
        ],
        
        passives: [
            { name: 'Eagle Eye', effect: 'Projectiles deal 20% more damage at max range' },
            { name: 'Quick Draw', effect: '15% faster attack speed with bows' }
        ]
    },
    
    musketeer: {
        name: 'Musketeer',
        description: 'A dashing swashbuckler combining swordplay with firearm expertise.',
        color: '#4169e1',
        
        // Default attack is a ranged musket shot
        defaultAttackType: 'musketShot',
        defaultAttackRange: 320,
        defaultAttackElement: 'physical',
        defaultAttackSpeed: 650,
        defaultAttackSound: 'musketShot',
        
        baseStats: {
            strength: 12,
            agility: 14,
            intelligence: 10,
            vitality: 10,
            luck: 10
        },
        
        statGrowth: {
            strength: 1.5,
            agility: 2,
            intelligence: 1.5,
            vitality: 1.5,
            luck: 1.5
        },
        
        baseSpeed: 170,
        sprintMultiplier: 1.4,
        canSprint: true,
        canDash: true,
        dashDistance: 140,
        dashCooldown: 2,
        
        weaponTypes: ['rapier', 'musket', 'pistol'],
        armorTypes: ['light', 'medium'],
        
        abilities: [
            {
                name: 'Gunshot',
                description: 'Fire a powerful shot that must be reloaded',
                damage: 55,
                cooldown: 4,
                range: 300,
                type: 'projectile',
                reloadTime: 2
            },
            {
                name: 'Riposte',
                description: 'Parry next attack and counter',
                staminaCost: 20,
                cooldown: 6,
                duration: 1,
                type: 'counter',
                counterDamage: 40
            },
            {
                name: 'En Garde',
                description: 'Rapid series of rapier thrusts',
                damage: 12,
                hits: 4,
                staminaCost: 30,
                cooldown: 5,
                range: 50,
                type: 'melee'
            },
            {
                name: 'Flashbang',
                description: 'Fire a blinding shot',
                cooldown: 18,
                range: 150,
                radius: 80,
                type: 'utility',
                effects: [{ type: 'blind', duration: 3 }]
            }
        ],
        
        passives: [
            { name: 'Duelist', effect: 'Deal 25% more damage in 1v1 combat' },
            { name: 'Quick Reload', effect: 'Firearms reload 40% faster' }
        ]
    },
    
    // ============ MAGE CLASSES ============
    
    mage: {
        name: 'Mage',
        description: 'A wielder of elemental magic with devastating area attacks.',
        color: '#9370db',
        
        // Default attack is a magic projectile, not melee
        defaultAttackType: 'projectile',
        defaultAttackRange: 250,
        defaultAttackElement: 'arcane',
        defaultAttackSpeed: 450,
        
        baseStats: {
            strength: 4,
            agility: 8,
            intelligence: 18,
            vitality: 6,
            luck: 10
        },
        
        statGrowth: {
            strength: 0.3,
            agility: 1,
            intelligence: 3,
            vitality: 0.5,
            luck: 1.5
        },
        
        baseSpeed: 130,
        sprintMultiplier: 1.2,
        canSprint: true,
        canDash: false,
        canTeleport: true,
        teleportDistance: 150,
        teleportCooldown: 5,
        
        weaponTypes: ['staff', 'wand', 'tome'],
        armorTypes: ['cloth'],
        
        abilities: [
            {
                name: 'Fireball',
                description: 'Launch an explosive fireball',
                damage: 40,
                manaCost: 20,
                cooldown: 2,
                range: 300,
                radius: 50,
                type: 'projectile',
                element: 'fire'
            },
            {
                name: 'Ice Lance',
                description: 'Piercing ice projectile that slows',
                damage: 30,
                manaCost: 15,
                cooldown: 1.5,
                range: 350,
                type: 'projectile',
                element: 'ice',
                effects: [{ type: 'slow', value: 0.5, duration: 3 }]
            },
            {
                name: 'Lightning Bolt',
                description: 'Instant lightning strike',
                damage: 50,
                manaCost: 30,
                cooldown: 4,
                range: 250,
                type: 'instant',
                element: 'lightning',
                chainTargets: 2
            },
            {
                name: 'Mana Shield',
                description: 'Create a shield that absorbs damage using mana',
                manaCost: 40,
                cooldown: 20,
                duration: 8,
                type: 'buff',
                absorb: 100
            }
        ],
        
        passives: [
            { name: 'Arcane Mastery', effect: '+20% spell damage' },
            { name: 'Mana Flow', effect: '+30% mana regeneration' }
        ]
    },
    
    arcmage: {
        name: 'Arcmage',
        description: 'A master of pure arcane energy with reality-bending powers.',
        color: '#da70d6',
        
        // Default attack is arcane missiles
        defaultAttackType: 'projectile',
        defaultAttackRange: 300,
        defaultAttackElement: 'arcane',
        defaultAttackSpeed: 500,
        defaultAttackHoming: true,
        
        baseStats: {
            strength: 3,
            agility: 6,
            intelligence: 22,
            vitality: 5,
            luck: 12
        },
        
        statGrowth: {
            strength: 0.2,
            agility: 0.5,
            intelligence: 4,
            vitality: 0.3,
            luck: 2
        },
        
        baseSpeed: 120,
        sprintMultiplier: 1.1,
        canSprint: true,
        canDash: false,
        canTeleport: true,
        teleportDistance: 200,
        teleportCooldown: 4,
        
        weaponTypes: ['staff', 'orb'],
        armorTypes: ['cloth'],
        
        abilities: [
            {
                name: 'Arcane Missiles',
                description: 'Fire homing arcane projectiles',
                damage: 15,
                projectiles: 4,
                manaCost: 25,
                cooldown: 3,
                range: 300,
                type: 'projectile',
                homing: true
            },
            {
                name: 'Time Stop',
                description: 'Freeze all enemies in an area',
                manaCost: 60,
                cooldown: 30,
                range: 200,
                radius: 150,
                duration: 3,
                type: 'control'
            },
            {
                name: 'Gravity Well',
                description: 'Create a gravity field pulling enemies in',
                damage: 10,
                manaCost: 45,
                cooldown: 15,
                range: 250,
                radius: 100,
                duration: 5,
                type: 'dot',
                pullStrength: 100
            },
            {
                name: 'Dimensional Rift',
                description: 'Open a rift dealing continuous damage',
                damage: 20,
                manaCost: 50,
                cooldown: 12,
                range: 200,
                radius: 80,
                duration: 4,
                type: 'zone'
            }
        ],
        
        passives: [
            { name: 'Arcane Brilliance', effect: '+30% spell damage, spells cost 10% more mana' },
            { name: 'Reality Warp', effect: 'Critical spells reduce all cooldowns by 1 second' }
        ]
    },
    
    darkMage: {
        name: 'Dark Mage',
        description: 'A practitioner of forbidden shadow magic.',
        color: '#4a0080',
        
        // Default attack is shadow bolt
        defaultAttackType: 'projectile',
        defaultAttackRange: 280,
        defaultAttackElement: 'dark',
        defaultAttackSpeed: 400,
        
        baseStats: {
            strength: 5,
            agility: 8,
            intelligence: 16,
            vitality: 8,
            luck: 8
        },
        
        statGrowth: {
            strength: 0.5,
            agility: 1,
            intelligence: 3,
            vitality: 1,
            luck: 1
        },
        
        baseSpeed: 135,
        sprintMultiplier: 1.2,
        canSprint: true,
        canDash: false,
        canTeleport: true,
        teleportDistance: 120,
        teleportCooldown: 6,
        
        weaponTypes: ['staff', 'tome', 'orb'],
        armorTypes: ['cloth'],
        
        abilities: [
            {
                name: 'Shadow Bolt',
                description: 'Fire a bolt of dark energy',
                damage: 35,
                manaCost: 15,
                cooldown: 1.5,
                range: 280,
                type: 'projectile',
                element: 'dark'
            },
            {
                name: 'Life Drain',
                description: 'Drain health from an enemy',
                damage: 25,
                heal: 20,
                manaCost: 25,
                cooldown: 5,
                range: 150,
                type: 'beam',
                duration: 2
            },
            {
                name: 'Curse',
                description: 'Curse enemies, increasing damage they take',
                manaCost: 30,
                cooldown: 12,
                range: 200,
                radius: 100,
                type: 'debuff',
                effects: [{ type: 'vulnerability', value: 0.25, duration: 8 }]
            },
            {
                name: 'Shadow Form',
                description: 'Become incorporeal, immune to physical damage',
                manaCost: 50,
                cooldown: 25,
                duration: 4,
                type: 'buff',
                effects: [{ type: 'physical_immunity', duration: 4 }]
            }
        ],
        
        passives: [
            { name: 'Dark Pact', effect: 'Spells cost 20% health instead of mana when mana is empty' },
            { name: 'Soul Harvest', effect: 'Killing enemies restores 10% max mana' }
        ]
    },
    
    necromancer: {
        name: 'Necromancer',
        description: 'A master of death magic who commands undead minions.',
        color: '#2d5a27',
        
        // Default attack is BONE SPEAR - piercing bone projectile
        defaultAttackType: 'boneSpear',
        defaultAttackRange: 280,
        defaultAttackElement: 'dark',
        defaultAttackSpeed: 400,
        
        baseStats: {
            strength: 4,
            agility: 6,
            intelligence: 16,
            vitality: 10,
            luck: 10
        },
        
        statGrowth: {
            strength: 0.3,
            agility: 0.5,
            intelligence: 2.5,
            vitality: 1.5,
            luck: 1.5
        },
        
        baseSpeed: 125,
        sprintMultiplier: 1.2,
        canSprint: true,
        canDash: false,
        canTeleport: false,
        maxMinions: 5,
        
        weaponTypes: ['staff', 'scythe', 'tome'],
        armorTypes: ['cloth', 'light'],
        
        abilities: [
            {
                name: 'Raise Dead',
                description: 'Raise a skeletal warrior from the ground to fight for you',
                manaCost: 25,
                cooldown: 6,
                type: 'summon',
                minionType: 'skeleton',
                minionStats: { health: 60, damage: 18, duration: 30 }
            },
            {
                name: 'Dark Pulse',
                description: 'Release an expanding ring of dark energy',
                damage: 35,
                manaCost: 20,
                cooldown: 3,
                radius: 100,
                type: 'aoe'
            },
            {
                name: 'Corpse Explosion',
                description: 'Detonate corpses dealing area damage',
                damage: 60,
                manaCost: 25,
                cooldown: 5,
                radius: 80,
                type: 'aoe',
                requiresCorpse: true
            },
            {
                name: 'Army of the Dead',
                description: 'Summon a horde of temporary undead',
                manaCost: 80,
                cooldown: 60,
                duration: 15,
                type: 'summon',
                minionCount: 8,
                minionType: 'ghoul'
            }
        ],
        
        passives: [
            { name: 'Death\'s Command', effect: 'Minions deal 20% more damage' },
            { name: 'Grave Robber', effect: 'Enemies have 20% chance to leave a corpse on death' }
        ]
    },
    
    priest: {
        name: 'Priest',
        description: 'A holy servant blessed with healing and protective magic.',
        color: '#f0e68c',
        
        // Default attack is holy smite
        defaultAttackType: 'projectile',
        defaultAttackRange: 220,
        defaultAttackElement: 'holy',
        defaultAttackSpeed: 380,
        
        baseStats: {
            strength: 4,
            agility: 6,
            intelligence: 16,
            vitality: 12,
            luck: 12
        },
        
        statGrowth: {
            strength: 0.3,
            agility: 0.5,
            intelligence: 2.5,
            vitality: 2,
            luck: 2
        },
        
        baseSpeed: 130,
        sprintMultiplier: 1.2,
        canSprint: true,
        canDash: false,
        canTeleport: false,
        
        weaponTypes: ['staff', 'mace', 'tome'],
        armorTypes: ['cloth', 'light'],
        
        abilities: [
            {
                name: 'Holy Purge',
                description: 'Unleash a purifying wave of holy energy at target location',
                damage: 50,
                manaCost: 30,
                cooldown: 4,
                range: 280,
                radius: 100,
                type: 'holyPurge',
                element: 'holy',
                targetType: 'cursor'
            },
            {
                name: 'Holy Light',
                description: 'Heal an ally or damage undead',
                healAmount: 40,
                damage: 45,
                manaCost: 20,
                cooldown: 2,
                range: 200,
                type: 'targeted',
                element: 'holy'
            },
            {
                name: 'Divine Shield',
                description: 'Shield an ally from damage',
                absorb: 80,
                manaCost: 30,
                cooldown: 10,
                range: 200,
                duration: 6,
                type: 'buff'
            },
            {
                name: 'Resurrection',
                description: 'Revive a fallen ally with half health',
                manaCost: 100,
                cooldown: 120,
                range: 100,
                type: 'revive'
            }
        ],
        
        passives: [
            { name: 'Divine Grace', effect: 'Healing spells are 25% more effective' },
            { name: 'Holy Fervor', effect: 'Dealing damage to undead restores mana' }
        ]
    },
    
    magicalKnight: {
        name: 'Magical Knight',
        description: 'A warrior who combines martial prowess with arcane magic.',
        color: '#6b8e23',
        
        baseStats: {
            strength: 10, // Reduced from 12
            agility: 9,   // Reduced from 10
            intelligence: 10, // Reduced from 12
            vitality: 11, // Reduced from 12
            luck: 8
        },
        
        statGrowth: {
            strength: 1.6,  // Reduced from 2
            agility: 1.3,   // Reduced from 1.5
            intelligence: 1.6, // Reduced from 2
            vitality: 1.3,  // Reduced from 1.5
            luck: 1
        },
        
        baseSpeed: 135, // Reduced from 145
        sprintMultiplier: 1.25, // Reduced from 1.3
        canSprint: true,
        canDash: true,
        dashDistance: 110, // Reduced from 130
        dashCooldown: 4, // Increased from 3
        
        weaponTypes: ['enchanted_sword', 'magic_lance', 'runic_axe'],
        armorTypes: ['medium', 'heavy'],
        
        abilities: [
            {
                name: 'Arcane Blade',
                description: 'Enchant weapon with arcane energy',
                bonusDamage: 15, // Reduced from 25
                duration: 8, // Reduced from 10
                manaCost: 30, // Increased from 25
                cooldown: 18, // Increased from 15
                type: 'buff',
                element: 'arcane'
            },
            {
                name: 'Spell Shield',
                description: 'Create a barrier blocking magic damage',
                absorb: 60, // Reduced from 100
                manaCost: 40, // Increased from 35
                cooldown: 15, // Increased from 12
                duration: 4, // Reduced from 5
                type: 'buff',
                blockType: 'magic'
            },
            {
                name: 'Elemental Strike',
                description: 'Charged attack infused with elemental power',
                damage: 35, // Reduced from 50
                staminaCost: 25, // Increased from 20
                manaCost: 20, // Increased from 15
                cooldown: 7, // Increased from 5
                range: 55, // Reduced from 60
                type: 'melee',
                elementCycle: ['fire', 'ice', 'lightning']
            },
            {
                name: 'Runic Explosion',
                description: 'Detonate runes placed on enemies',
                damage: 25, // Reduced from 35
                manaCost: 35, // Increased from 30
                cooldown: 10, // Increased from 8
                radius: 80, // Reduced from 100
                type: 'aoe',
                requiresRune: true
            }
        ],
        
        passives: [
            { name: 'Battlemage', effect: 'Melee attacks restore 3 mana' }, // Reduced from 5
            { name: 'Spell Warrior', effect: '+10% physical and magic damage' } // Reduced from 15%
        ]
    }
};

// Helper function to create a character of a specific class
export function createCharacter(className, x = 0, y = 0) {
    const classData = ClassDefinitions[className];
    if (!classData) {
        throw new Error(`Unknown class: ${className}`);
    }
    
    // Use dynamic import to avoid circular dependency
    return { classData, x, y };
}

// Get all class names
export function getAllClassNames() {
    return Object.keys(ClassDefinitions);
}

// Get classes by category
export function getClassesByCategory() {
    return {
        warrior: ['knight', 'viking', 'samurai'],
        rogue: ['assassin', 'ninja', 'archer', 'musketeer'],
        mage: ['mage', 'arcmage', 'darkMage', 'necromancer', 'priest', 'magicalKnight']
    };
}

export default ClassDefinitions;
