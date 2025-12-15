/**
 * Market System - A safe zone between combat floors
 * Features: NPCs, shops, fortune teller, arena, guild, mercenaries, class-specific buildings
 */

import { Utils } from '../engine/core/Utils.js';
import { ClassDefinitions } from '../classes/ClassDefinitions.js';

// Market building types
export const BUILDING_TYPES = {
    GENERAL_STORE: 'general_store',
    BLACKSMITH: 'blacksmith',
    ALCHEMIST: 'alchemist',
    FORTUNE_TELLER: 'fortune_teller',
    ARENA: 'arena',
    GUILD: 'guild',
    MERCENARY_CAMP: 'mercenary_camp',
    CLASS_HALL: 'class_hall',
    INN: 'inn'
};

// NPC types
export const NPC_TYPES = {
    MERCHANT: 'merchant',
    WANDERER: 'wanderer',
    GUARD: 'guard',
    FORTUNE_TELLER: 'fortune_teller',
    ARENA_MASTER: 'arena_master',
    GUILD_MASTER: 'guild_master',
    MERCENARY: 'mercenary',
    CLASS_TRAINER: 'class_trainer',
    INNKEEPER: 'innkeeper'
};

// Tarot cards for fortune teller
export const TAROT_CARDS = [
    { name: 'The Fool', meaning: 'new beginnings', positive: true, statMod: 'luck' },
    { name: 'The Magician', meaning: 'power and skill', positive: true, statMod: 'intelligence' },
    { name: 'The High Priestess', meaning: 'intuition', positive: true, statMod: 'wisdom' },
    { name: 'The Empress', meaning: 'abundance', positive: true, statMod: 'vitality' },
    { name: 'The Emperor', meaning: 'authority', positive: true, statMod: 'strength' },
    { name: 'The Hierophant', meaning: 'tradition', positive: true, statMod: 'defense' },
    { name: 'The Lovers', meaning: 'harmony', positive: true, statMod: 'all' },
    { name: 'The Chariot', meaning: 'victory', positive: true, statMod: 'agility' },
    { name: 'Strength', meaning: 'courage', positive: true, statMod: 'strength' },
    { name: 'The Hermit', meaning: 'introspection', positive: false, statMod: 'wisdom' },
    { name: 'Wheel of Fortune', meaning: 'change', positive: null, statMod: 'luck' },
    { name: 'Justice', meaning: 'balance', positive: null, statMod: 'all' },
    { name: 'The Hanged Man', meaning: 'sacrifice', positive: false, statMod: 'health' },
    { name: 'Death', meaning: 'transformation', positive: false, statMod: 'danger' },
    { name: 'Temperance', meaning: 'patience', positive: true, statMod: 'mana' },
    { name: 'The Devil', meaning: 'bondage', positive: false, statMod: 'danger' },
    { name: 'The Tower', meaning: 'upheaval', positive: false, statMod: 'danger' },
    { name: 'The Star', meaning: 'hope', positive: true, statMod: 'luck' },
    { name: 'The Moon', meaning: 'illusion', positive: false, statMod: 'deception' },
    { name: 'The Sun', meaning: 'success', positive: true, statMod: 'all' },
    { name: 'Judgement', meaning: 'reckoning', positive: null, statMod: 'karma' },
    { name: 'The World', meaning: 'completion', positive: true, statMod: 'all' }
];

// Mercenary classes (different from player's class)
export const MERCENARY_CLASSES = ['knight', 'mage', 'assassin', 'viking', 'samurai', 'ninja', 'musketeer', 'necromancer'];

// Generic NPC dialogues
const WANDERER_DIALOGUES = [
    "The dungeon grows more dangerous with each floor...",
    "I once ventured deeper. I was the only survivor.",
    "Have you seen the fortune teller? She knows things...",
    "The guild offers good rewards for skilled adventurers.",
    "Stock up while you can. The next floor won't be easy.",
    "I've heard whispers of hidden rooms in the dungeon...",
    "The mercenaries here are expensive, but worth every coin.",
    "Some say there's a secret floor beyond the last...",
    "Be wary of the floor bosses. Each has a unique weakness.",
    "The class halls offer knowledge you won't find elsewhere."
];

const GUARD_DIALOGUES = [
    "Keep the peace, adventurer.",
    "No fighting in the market.",
    "The market is neutral ground.",
    "Stay out of trouble.",
    "Move along."
];

// Market layout definition
export class MarketLayout {
    constructor(theme, floor) {
        this.theme = theme;
        this.floor = floor;
        this.width = 60;
        this.height = 50;
        this.buildings = [];
        this.npcs = [];
        this.decorations = [];
        this.spawnPoint = { x: 30, y: 45 }; // Player spawn at bottom center
        this.exitPoint = { x: 30, y: 5 };   // Exit at top center
        
        this.generate();
    }
    
    generate() {
        // Create buildings based on layout
        const buildingLayout = [
            // Row 1 (top) - Exit area
            { type: BUILDING_TYPES.GUILD, x: 10, y: 8, w: 12, h: 10 },
            { type: BUILDING_TYPES.ARENA, x: 38, y: 8, w: 12, h: 10 },
            
            // Row 2 (middle) - Main shops
            { type: BUILDING_TYPES.BLACKSMITH, x: 5, y: 22, w: 10, h: 8 },
            { type: BUILDING_TYPES.GENERAL_STORE, x: 18, y: 22, w: 10, h: 8 },
            { type: BUILDING_TYPES.FORTUNE_TELLER, x: 32, y: 22, w: 10, h: 8 },
            { type: BUILDING_TYPES.ALCHEMIST, x: 45, y: 22, w: 10, h: 8 },
            
            // Row 3 (bottom) - Class hall and mercenaries
            { type: BUILDING_TYPES.CLASS_HALL, x: 8, y: 35, w: 12, h: 8 },
            { type: BUILDING_TYPES.MERCENARY_CAMP, x: 40, y: 35, w: 12, h: 8 },
            { type: BUILDING_TYPES.INN, x: 24, y: 35, w: 10, h: 8 }
        ];
        
        for (const b of buildingLayout) {
            this.buildings.push(new MarketBuilding(b.type, b.x, b.y, b.w, b.h, this.theme));
        }
        
        // Spawn wandering NPCs in the streets
        this.spawnWanderingNPCs();
    }
    
    spawnWanderingNPCs() {
        const wandererCount = 8 + Math.floor(Math.random() * 5);
        const guardCount = 4;
        
        // Wanderers
        for (let i = 0; i < wandererCount; i++) {
            const npc = new MarketNPC(
                NPC_TYPES.WANDERER,
                15 + Math.random() * 30,
                15 + Math.random() * 25,
                Math.random() > 0.5 ? 'male' : 'female'
            );
            npc.dialogue = WANDERER_DIALOGUES[Math.floor(Math.random() * WANDERER_DIALOGUES.length)];
            this.npcs.push(npc);
        }
        
        // Guards
        for (let i = 0; i < guardCount; i++) {
            const npc = new MarketNPC(
                NPC_TYPES.GUARD,
                5 + (i * 15),
                20 + Math.random() * 10,
                'male'
            );
            npc.dialogue = GUARD_DIALOGUES[Math.floor(Math.random() * GUARD_DIALOGUES.length)];
            this.npcs.push(npc);
        }
    }
}

// Market Building
export class MarketBuilding {
    constructor(type, x, y, width, height, theme) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.theme = theme;
        this.npc = null;
        this.inventory = [];
        this.isOpen = true;
        
        this.initializeBuilding();
    }
    
    initializeBuilding() {
        switch (this.type) {
            case BUILDING_TYPES.GENERAL_STORE:
                this.name = "General Store";
                this.npc = new MarketNPC(NPC_TYPES.MERCHANT, this.x + this.width/2, this.y + this.height - 2, 'male');
                this.npc.dialogue = "Welcome! I have supplies for every adventurer.";
                this.generateGeneralInventory();
                break;
                
            case BUILDING_TYPES.BLACKSMITH:
                this.name = "Blacksmith";
                this.npc = new MarketNPC(NPC_TYPES.MERCHANT, this.x + this.width/2, this.y + this.height - 2, 'male');
                this.npc.dialogue = "Finest weapons and armor, forged with skill!";
                this.generateBlacksmithInventory();
                break;
                
            case BUILDING_TYPES.ALCHEMIST:
                this.name = "Alchemist";
                this.npc = new MarketNPC(NPC_TYPES.MERCHANT, this.x + this.width/2, this.y + this.height - 2, 'female');
                this.npc.dialogue = "Potions, elixirs, and mystical concoctions...";
                this.generateAlchemistInventory();
                break;
                
            case BUILDING_TYPES.FORTUNE_TELLER:
                this.name = "Fortune Teller";
                this.npc = new MarketNPC(NPC_TYPES.FORTUNE_TELLER, this.x + this.width/2, this.y + this.height - 2, 'female');
                this.npc.dialogue = "The cards whisper secrets of your fate...";
                break;
                
            case BUILDING_TYPES.ARENA:
                this.name = "Arena";
                this.npc = new MarketNPC(NPC_TYPES.ARENA_MASTER, this.x + this.width/2, this.y + this.height - 2, 'male');
                this.npc.dialogue = "Test your might in the arena! Glory and gold await!";
                break;
                
            case BUILDING_TYPES.GUILD:
                this.name = "Adventurer's Guild";
                this.npc = new MarketNPC(NPC_TYPES.GUILD_MASTER, this.x + this.width/2, this.y + this.height - 2, 'female');
                this.npc.dialogue = "The guild has quests for brave adventurers.";
                break;
                
            case BUILDING_TYPES.MERCENARY_CAMP:
                this.name = "Mercenary Camp";
                this.npc = new MarketNPC(NPC_TYPES.MERCENARY, this.x + this.width/2, this.y + this.height - 2, 'male');
                this.npc.dialogue = "Looking for a sword for hire? You've come to the right place.";
                this.generateMercenaryRoster();
                break;
                
            case BUILDING_TYPES.CLASS_HALL:
                this.name = "Class Hall";
                this.npc = new MarketNPC(NPC_TYPES.CLASS_TRAINER, this.x + this.width/2, this.y + this.height - 2, 'male');
                this.npc.dialogue = "Welcome, fellow warrior. I can teach you much.";
                break;
                
            case BUILDING_TYPES.INN:
                this.name = "The Weary Traveler Inn";
                this.npc = new MarketNPC(NPC_TYPES.INNKEEPER, this.x + this.width/2, this.y + this.height - 2, 'female');
                this.npc.dialogue = "Rest your weary bones, adventurer. A warm meal awaits.";
                break;
        }
    }
    
    generateGeneralInventory() {
        this.inventory = [
            { type: 'consumable', name: 'Health Potion', price: 50, effect: 'heal', value: 50 },
            { type: 'consumable', name: 'Mana Potion', price: 40, effect: 'mana', value: 40 },
            { type: 'consumable', name: 'Antidote', price: 30, effect: 'cure_poison', value: 1 },
            { type: 'consumable', name: 'Torch', price: 15, effect: 'light', value: 1 },
            { type: 'consumable', name: 'Escape Rope', price: 100, effect: 'escape', value: 1 }
        ];
    }
    
    generateBlacksmithInventory() {
        // Generate weapons scaled to floor
        this.inventory = [
            { type: 'weapon', name: 'Iron Sword', price: 150, damage: 15, rarity: 'common' },
            { type: 'weapon', name: 'Steel Blade', price: 300, damage: 25, rarity: 'uncommon' },
            { type: 'armor', name: 'Chain Mail', price: 200, defense: 10, rarity: 'common' },
            { type: 'armor', name: 'Plate Armor', price: 400, defense: 20, rarity: 'uncommon' },
            { type: 'accessory', name: 'Iron Ring', price: 100, bonus: { strength: 2 }, rarity: 'common' }
        ];
    }
    
    generateAlchemistInventory() {
        this.inventory = [
            { type: 'consumable', name: 'Greater Health Potion', price: 100, effect: 'heal', value: 100 },
            { type: 'consumable', name: 'Greater Mana Potion', price: 80, effect: 'mana', value: 80 },
            { type: 'consumable', name: 'Elixir of Strength', price: 150, effect: 'buff_strength', value: 5, duration: 60 },
            { type: 'consumable', name: 'Elixir of Speed', price: 150, effect: 'buff_speed', value: 20, duration: 60 },
            { type: 'consumable', name: 'Invisibility Potion', price: 200, effect: 'invisibility', duration: 30 },
            { type: 'consumable', name: 'Fire Resistance Potion', price: 100, effect: 'resist_fire', duration: 120 }
        ];
    }
    
    generateMercenaryRoster() {
        // Generate 3 mercenaries of different classes
        this.mercenaries = [];
        const availableClasses = [...MERCENARY_CLASSES];
        
        for (let i = 0; i < 3; i++) {
            const classIndex = Math.floor(Math.random() * availableClasses.length);
            const mercClass = availableClasses.splice(classIndex, 1)[0];
            const names = ['Grok', 'Luna', 'Zephyr', 'Thorne', 'Iris', 'Rex', 'Maya', 'Draven'];
            
            this.mercenaries.push({
                name: names[Math.floor(Math.random() * names.length)],
                class: mercClass,
                level: Math.floor(Math.random() * 5) + 1,
                price: 500 + Math.floor(Math.random() * 500),
                dialogues: this.generateMercenaryDialogues(mercClass)
            });
        }
    }
    
    generateMercenaryDialogues(mercClass) {
        const classDialogues = {
            knight: [
                "My shield will protect you.",
                "For honor!",
                "I've faced worse odds.",
                "Stay behind me."
            ],
            mage: [
                "The arcane flows through me.",
                "Stand back, this could get explosive.",
                "Knowledge is the greatest weapon.",
                "Watch and learn."
            ],
            assassin: [
                "Quick and silent.",
                "They won't see me coming.",
                "Every shadow is my ally.",
                "Precision over power."
            ],
            viking: [
                "BLOOD AND THUNDER!",
                "Odin guides my axe!",
                "To Valhalla!",
                "I smell a good fight."
            ],
            samurai: [
                "The way of the blade is discipline.",
                "One strike is all I need.",
                "My katana thirsts.",
                "Honor in battle."
            ],
            ninja: [
                "...",
                "Swift as shadow.",
                "They will not hear death approach.",
                "Silence is my weapon."
            ],
            musketeer: [
                "One shot, one kill.",
                "Keep them at range.",
                "My aim is true.",
                "Steady... steady..."
            ],
            necromancer: [
                "The dead serve me.",
                "Death is but a doorway.",
                "Rise, my minions!",
                "Life... is temporary."
            ]
        };
        return classDialogues[mercClass] || ["Ready for battle."];
    }
    
    getColor() {
        const colors = {
            [BUILDING_TYPES.GENERAL_STORE]: '#8B7355',
            [BUILDING_TYPES.BLACKSMITH]: '#4A4A4A',
            [BUILDING_TYPES.ALCHEMIST]: '#6B4E71',
            [BUILDING_TYPES.FORTUNE_TELLER]: '#2E1A47',
            [BUILDING_TYPES.ARENA]: '#8B0000',
            [BUILDING_TYPES.GUILD]: '#1E4D2B',
            [BUILDING_TYPES.MERCENARY_CAMP]: '#5C4033',
            [BUILDING_TYPES.CLASS_HALL]: '#2B4E7D',
            [BUILDING_TYPES.INN]: '#CD853F'
        };
        return colors[this.type] || '#555555';
    }
}

// Market NPC
export class MarketNPC {
    constructor(type, x, y, gender = 'male') {
        this.type = type;
        this.x = x;
        this.y = y;
        this.gender = gender;
        this.dialogue = "";
        this.isTalking = false;
        this.talkTimer = 0;
        this.wanderTimer = 0;
        this.wanderTarget = null;
        this.velocity = { x: 0, y: 0 };
        this.speed = 30 + Math.random() * 20;
        
        // Random appearance
        this.color = this.getRandomColor();
        this.size = 28 + Math.random() * 8;
    }
    
    getRandomColor() {
        const colors = ['#8B4513', '#D2691E', '#F4A460', '#DEB887', '#D2B48C', '#BC8F8F'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    update(dt, bounds) {
        // Update talk timer
        if (this.isTalking) {
            this.talkTimer -= dt;
            if (this.talkTimer <= 0) {
                this.isTalking = false;
            }
        }
        
        // Wandering behavior for wanderer NPCs
        if (this.type === NPC_TYPES.WANDERER || this.type === NPC_TYPES.GUARD) {
            this.wanderTimer -= dt;
            
            if (this.wanderTimer <= 0) {
                // Pick new wander target
                if (bounds) {
                    this.wanderTarget = {
                        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY)
                    };
                }
                this.wanderTimer = 2 + Math.random() * 4;
            }
            
            if (this.wanderTarget) {
                const dx = this.wanderTarget.x - this.x;
                const dy = this.wanderTarget.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 5) {
                    this.velocity.x = (dx / dist) * this.speed;
                    this.velocity.y = (dy / dist) * this.speed;
                    this.x += this.velocity.x * dt;
                    this.y += this.velocity.y * dt;
                } else {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.wanderTarget = null;
                }
            }
        }
    }
    
    interact(player, soundManager) {
        this.isTalking = true;
        this.talkTimer = 3;
        
        // Play appropriate sound
        if (soundManager) {
            if (this.gender === 'female') {
                soundManager.playNPCFemale();
            } else {
                soundManager.playNPCMale();
            }
        }
        
        return this.dialogue;
    }
}

// Fortune Teller reading
export class FortuneReading {
    constructor(player, nextFloor) {
        this.player = player;
        this.nextFloor = nextFloor;
        this.cards = [];
        this.interpretation = "";
        this.successChance = 0;
        
        this.performReading();
    }
    
    performReading() {
        // Draw 3 cards
        const deck = [...TAROT_CARDS];
        for (let i = 0; i < 3; i++) {
            const index = Math.floor(Math.random() * deck.length);
            this.cards.push(deck.splice(index, 1)[0]);
        }
        
        // Calculate success chance based on player stats and cards
        this.calculateSuccessChance();
        this.generateInterpretation();
    }
    
    calculateSuccessChance() {
        const player = this.player;
        
        // Base chance from level vs floor
        let baseChance = 50 + (player.level - this.nextFloor * 5) * 5;
        
        // Stats contribution
        const totalStats = player.stats.strength + player.stats.agility + 
                          player.stats.intelligence + player.stats.vitality + player.stats.luck;
        baseChance += totalStats * 0.5;
        
        // Health factor
        const healthRatio = player.health / player.maxHealth;
        baseChance += (healthRatio - 0.5) * 20;
        
        // Equipment bonus (simplified)
        if (player.equipment) {
            const equippedCount = Object.values(player.equipment).filter(e => e).length;
            baseChance += equippedCount * 5;
        }
        
        // Card modifiers
        for (const card of this.cards) {
            if (card.positive === true) baseChance += 10;
            else if (card.positive === false) baseChance -= 10;
            
            if (card.statMod === 'danger') baseChance -= 15;
            if (card.statMod === 'luck' && player.stats.luck > 10) baseChance += 5;
        }
        
        // Clamp to reasonable range
        this.successChance = Math.max(5, Math.min(95, baseChance));
    }
    
    generateInterpretation() {
        const chance = this.successChance;
        let reading = `The cards reveal your path to floor ${this.nextFloor}...\n\n`;
        
        // Describe each card
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const position = ['Past', 'Present', 'Future'][i];
            reading += `${position}: ${card.name} - ${card.meaning}\n`;
        }
        
        reading += '\n';
        
        // Overall prediction
        if (chance >= 80) {
            reading += "The stars align in your favor. Victory is nearly assured!";
        } else if (chance >= 60) {
            reading += "Fortune smiles upon you. The path ahead looks promising.";
        } else if (chance >= 40) {
            reading += "The outcome is uncertain. Prepare well and stay vigilant.";
        } else if (chance >= 20) {
            reading += "Dark clouds gather. The next floor will test your limits.";
        } else {
            reading += "I see great peril ahead. Consider strengthening yourself first.";
        }
        
        reading += `\n\nEstimated success chance: ${Math.round(chance)}%`;
        
        this.interpretation = reading;
    }
}

// Mercenary companion
export class Mercenary {
    constructor(config, ownerClass) {
        this.name = config.name;
        this.className = config.class;
        this.level = config.level;
        this.dialogues = config.dialogues;
        
        // Get class data
        const classData = ClassDefinitions[this.className] || ClassDefinitions.knight;
        
        // Initialize stats based on class
        this.maxHealth = 80 + this.level * 20 + classData.baseStats.vitality * 3;
        this.health = this.maxHealth;
        this.damage = 10 + this.level * 5 + classData.baseStats.strength * 2;
        this.defense = 5 + this.level * 2 + classData.baseStats.vitality;
        this.speed = classData.baseSpeed || 120;
        
        // Position
        this.x = 0;
        this.y = 0;
        this.velocity = { x: 0, y: 0 };
        this.width = 28;
        this.height = 28;
        
        // AI state
        this.state = 'follow';
        this.target = null;
        this.attackCooldown = 0;
        this.attackRange = classData.defaultAttackRange || 50;
        this.talkTimer = 0;
        this.currentDialogue = "";
        
        // Combat
        this.pendingAttack = null;
        this.active = true;
        
        // Color based on class
        this.color = classData.color || '#888888';
    }
    
    update(dt, player, enemies) {
        if (!this.active) return;
        
        // Update cooldowns
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        
        // Random dialogue
        this.talkTimer -= dt;
        if (this.talkTimer <= 0 && Math.random() < 0.01) {
            this.speak();
            this.talkTimer = 10 + Math.random() * 20;
        }
        
        // Find nearest enemy
        let nearestEnemy = null;
        let nearestDist = 300; // Aggro range
        
        for (const enemy of enemies) {
            if (!enemy.active || enemy.health <= 0) continue;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }
        
        if (nearestEnemy && nearestDist < 200) {
            // Combat mode
            this.state = 'combat';
            this.target = nearestEnemy;
            
            // Move toward enemy
            const dx = nearestEnemy.x - this.x;
            const dy = nearestEnemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > this.attackRange) {
                // Move closer
                this.velocity.x = (dx / dist) * this.speed;
                this.velocity.y = (dy / dist) * this.speed;
                this.x += this.velocity.x * dt;
                this.y += this.velocity.y * dt;
            } else if (this.attackCooldown <= 0) {
                // Attack!
                this.attack(nearestEnemy);
            }
        } else {
            // Follow player
            this.state = 'follow';
            this.target = null;
            
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const followDistance = 60;
            if (dist > followDistance) {
                this.velocity.x = (dx / dist) * this.speed * 0.8;
                this.velocity.y = (dy / dist) * this.speed * 0.8;
                this.x += this.velocity.x * dt;
                this.y += this.velocity.y * dt;
            } else {
                this.velocity.x *= 0.9;
                this.velocity.y *= 0.9;
            }
        }
    }
    
    attack(enemy) {
        this.attackCooldown = 1.0;
        
        // Create attack
        this.pendingAttack = {
            type: 'melee',
            x: this.x,
            y: this.y,
            targetX: enemy.x,
            targetY: enemy.y,
            damage: this.damage,
            range: this.attackRange,
            element: 'physical',
            knockback: 30
        };
    }
    
    speak() {
        if (this.dialogues && this.dialogues.length > 0) {
            this.currentDialogue = this.dialogues[Math.floor(Math.random() * this.dialogues.length)];
            setTimeout(() => {
                this.currentDialogue = "";
            }, 3000);
        }
    }
    
    takeDamage(amount) {
        const actualDamage = Math.max(1, amount - this.defense);
        this.health -= actualDamage;
        
        if (this.health <= 0) {
            this.active = false;
            this.currentDialogue = "I... have failed...";
        }
        
        return actualDamage;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
}

// Arena challenge
export class ArenaChallenge {
    constructor(floor, player) {
        this.floor = floor;
        this.player = player;
        this.waves = [];
        this.currentWave = 0;
        this.isActive = false;
        this.rewards = [];
        
        this.generateWaves();
    }
    
    generateWaves() {
        const waveCount = 3 + Math.floor(this.floor / 2);
        
        for (let i = 0; i < waveCount; i++) {
            const enemyCount = 3 + i + Math.floor(this.floor / 2);
            this.waves.push({
                enemies: enemyCount,
                completed: false
            });
        }
        
        // Rewards scale with floor
        this.rewards = {
            gold: 200 * this.floor,
            exp: 100 * this.floor,
            item: Math.random() < 0.3 ? { type: 'weapon', rarity: 'rare' } : null
        };
    }
}

// Guild quest
export class GuildQuest {
    constructor(floor, type) {
        this.floor = floor;
        this.type = type;
        this.objective = "";
        this.progress = 0;
        this.target = 0;
        this.reward = {};
        this.isComplete = false;
        
        this.generate();
    }
    
    generate() {
        const questTypes = ['kill', 'collect', 'explore', 'boss'];
        this.type = this.type || questTypes[Math.floor(Math.random() * questTypes.length)];
        
        switch (this.type) {
            case 'kill':
                this.target = 10 + this.floor * 5;
                this.objective = `Defeat ${this.target} enemies`;
                this.reward = { gold: 100 * this.floor, exp: 50 * this.floor };
                break;
            case 'collect':
                this.target = 5 + this.floor;
                this.objective = `Collect ${this.target} items`;
                this.reward = { gold: 150 * this.floor };
                break;
            case 'explore':
                this.target = 10;
                this.objective = `Discover ${this.target} rooms`;
                this.reward = { exp: 100 * this.floor };
                break;
            case 'boss':
                this.target = 1;
                this.objective = `Defeat the floor boss`;
                this.reward = { gold: 300 * this.floor, exp: 200 * this.floor, item: { type: 'weapon', rarity: 'epic' } };
                break;
        }
    }
    
    updateProgress(amount = 1) {
        this.progress += amount;
        if (this.progress >= this.target) {
            this.isComplete = true;
        }
    }
}

export default {
    BUILDING_TYPES,
    NPC_TYPES,
    TAROT_CARDS,
    MarketLayout,
    MarketBuilding,
    MarketNPC,
    FortuneReading,
    Mercenary,
    ArenaChallenge,
    GuildQuest
};
