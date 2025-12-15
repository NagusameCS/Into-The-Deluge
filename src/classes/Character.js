/**
 * Base Character Class - All playable classes inherit from this
 */

import { Entity, HealthComponent, SpriteComponent } from '../engine/core/Entity.js';
import { Utils } from '../engine/core/Utils.js';

export class Character extends Entity {
    constructor(classData, skillTree = null) {
        super(0, 0);
        
        this.classData = classData;
        this.className = classData.name;
        this.skillTree = skillTree;
        
        // Core stats
        this.level = 1;
        this.experience = 0;
        this.experienceToLevel = 100;
        this.justLeveledUp = false;
        this.multiclassNotified = false;
        
        // Base stats (modified by class)
        this.stats = {
            strength: classData.baseStats.strength || 10,
            agility: classData.baseStats.agility || 10,
            intelligence: classData.baseStats.intelligence || 10,
            vitality: classData.baseStats.vitality || 10,
            luck: classData.baseStats.luck || 10
        };
        
        // Derived stats
        this.maxHealth = 100 + this.stats.vitality * 10;
        this.health = this.maxHealth;
        this.maxMana = 50 + this.stats.intelligence * 5;
        this.mana = this.maxMana;
        this.maxStamina = 100 + this.stats.agility * 2;
        this.stamina = this.maxStamina;
        
        // Movement
        this.baseSpeed = classData.baseSpeed || 150;
        this.maxSpeed = this.baseSpeed;
        this.sprintMultiplier = classData.sprintMultiplier || 1.8; // Increased from 1.5
        this.isSprinting = false;
        this.dashCooldown = 0;
        this.canDash = classData.canDash || false;
        this.dashDistance = classData.dashDistance || 100;
        
        // Parry system (for non-dash classes)
        this.canParry = !this.canDash; // Classes without dash can parry
        this.isParrying = false;
        this.parryWindow = 0; // Active parry window
        this.parryWindowDuration = 0.15; // 150ms perfect parry window
        this.parryCooldown = 0;
        
        // Teleport (for mages)
        this.canTeleport = classData.canTeleport || false;
        this.teleportDistance = classData.teleportDistance || 160; // 5 tiles = 160 pixels
        this.teleportCooldown = 0;
        this.teleportCooldownTime = classData.teleportCooldown || 3;
        
        // Combat
        this.attackDamage = 10 + this.stats.strength * 2;
        this.magicDamage = 5 + this.stats.intelligence * 3;
        this.defense = 5 + this.stats.vitality;
        this.critChance = 5 + this.stats.luck * 0.5;
        this.critMultiplier = 1.5;
        this.attackCooldown = 0;
        this.pendingAttack = null;
        
        // Class-specific combat bonuses
        const className = classData.name?.toLowerCase();
        if (className === 'assassin') {
            // Assassin gets massive damage bonus to compensate for short range
            this.attackDamage *= 2.5;
            this.critChance += 25; // Extra crit chance
        } else if (className === 'samurai') {
            // Samurai gets high crit chance
            this.critChance += 20;
            this.critMultiplier = 2.0; // Stronger crits
        } else if (className === 'viking') {
            // Viking bloodlust is applied dynamically in attack()
            this.hasBloodlust = true;
        }
        
        // Abilities
        this.abilities = [];
        this.cooldowns = new Map();
        
        // Skill points and skill tree
        this.skillPoints = 0;
        this.statPoints = 0; // New stat point system
        this.unlockedSkills = new Set();
        
        // Multiclassing
        this.canMulticlass = false;
        this.secondaryClass = null;
        this.secondaryClassData = null;
        
        // Equipment slots
        this.equipment = {
            weapon: null,
            armor: null,
            helmet: null,
            boots: null,
            accessory1: null,
            accessory2: null
        };
        
        // Inventory
        this.inventory = [];
        this.maxInventorySize = 20;
        this.gold = 0;
        
        // Status effects
        this.statusEffects = new Map();
        
        // Direction facing (for attacks/abilities)
        this.facing = { x: 0, y: 1 };
        this.facingX = 0;
        this.facingY = 1;
        
        // State
        this.state = 'idle';
        this.stateTimer = 0;
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        
        // Visual
        this.width = 32;
        this.height = 32;
        this.color = classData.color || '#ffffff';
        
        // Animation state
        this.animationState = 'idle';
        this.animationFrame = 0;
        this.animationTimer = 0;
        
        // Dash animation
        this.isDashing = false;
        this.dashStartX = 0;
        this.dashStartY = 0;
        this.dashDirX = 0;
        this.dashDirY = 0;
        this.dashTimer = 0;
        this.dashTrail = []; // For visual trail effect
        
        // Dash chaining system
        this.dashChainWindow = 0; // Window where chaining is possible
        this.dashChainQueued = false; // Whether a chain dash is queued
        this.dashChainDirection = { x: 0, y: 0 }; // Direction for queued dash
        this.dashChainCount = 0; // Number of successful chains
        this.lastDashEndTime = 0; // When the last dash ended
        
        // Spell cycling for mage classes
        this.activeSpellIndex = 0; // Current spell for default attack
        this.spellCycleList = []; // List of projectile abilities that can be cycled
        
        // Setup components
        this.addTag('player');
        this.addTag('character');
        
        // Initialize class-specific abilities
        this.initializeAbilities();
        
        // Initialize class-specific starting equipment
        this.initializeStartingEquipment();
        
        // Initialize potions
        this.potions = {
            health: 3,
            mana: 3
        };
        this.potionCooldowns = {
            health: 0,
            mana: 0
        };
    }
    
    initializeStartingEquipment() {
        // Give each class appropriate starting gear
        const className = this.classData.name?.toLowerCase();
        
        const startingGear = {
            knight: {
                weapon: { name: 'Iron Sword', type: 'weapon', slot: 'weapon', damage: 8, rarity: 'common', color: '#888' },
                armor: { name: 'Plate Armor', type: 'armor', slot: 'armor', defense: 15, rarity: 'common', color: '#666' },
                helmet: { name: 'Iron Helm', type: 'helmet', slot: 'helmet', defense: 5, rarity: 'common', color: '#777' }
            },
            mage: {
                weapon: { name: 'Oak Staff', type: 'staff', slot: 'weapon', magicDamage: 10, rarity: 'common', color: '#964B00' },
                armor: { name: 'Cloth Robes', type: 'armor', slot: 'armor', defense: 3, manaBonus: 20, rarity: 'common', color: '#4444aa' }
            },
            assassin: {
                weapon: { name: 'Steel Daggers', type: 'weapon', slot: 'weapon', damage: 12, critBonus: 5, rarity: 'common', color: '#555' },
                armor: { name: 'Leather Vest', type: 'armor', slot: 'armor', defense: 5, agilityBonus: 2, rarity: 'common', color: '#8B4513' }
            },
            archer: {
                weapon: { name: 'Short Bow', type: 'bow', slot: 'weapon', damage: 10, rarity: 'common', color: '#8B4513' },
                armor: { name: 'Ranger Garb', type: 'armor', slot: 'armor', defense: 4, speedBonus: 5, rarity: 'common', color: '#228B22' }
            },
            ninja: {
                weapon: { name: 'Kunai Set', type: 'weapon', slot: 'weapon', damage: 8, attackSpeedBonus: 0.1, rarity: 'common', color: '#333' },
                armor: { name: 'Shinobi Garb', type: 'armor', slot: 'armor', defense: 4, stealthBonus: 0.2, rarity: 'common', color: '#222' }
            },
            samurai: {
                weapon: { name: 'Training Katana', type: 'weapon', slot: 'weapon', damage: 14, critBonus: 5, rarity: 'common', color: '#888' },
                armor: { name: 'Light Samurai Armor', type: 'armor', slot: 'armor', defense: 8, rarity: 'common', color: '#8B0000' }
            },
            viking: {
                weapon: { name: 'Battle Axe', type: 'weapon', slot: 'weapon', damage: 18, rarity: 'common', color: '#666' },
                armor: { name: 'Fur Vest', type: 'armor', slot: 'armor', defense: 6, healthBonus: 20, rarity: 'common', color: '#704214' }
            },
            necromancer: {
                weapon: { name: 'Bone Staff', type: 'staff', slot: 'weapon', magicDamage: 8, darkDamage: 5, rarity: 'common', color: '#eeeecc' },
                armor: { name: 'Cultist Robes', type: 'armor', slot: 'armor', defense: 3, manaBonus: 15, rarity: 'common', color: '#2a2a2a' }
            },
            priest: {
                weapon: { name: 'Holy Mace', type: 'weapon', slot: 'weapon', damage: 8, holyDamage: 5, rarity: 'common', color: '#ffd700' },
                armor: { name: 'Vestments', type: 'armor', slot: 'armor', defense: 5, healingBonus: 0.1, rarity: 'common', color: '#fff' }
            },
            darkmage: {
                weapon: { name: 'Shadow Staff', type: 'staff', slot: 'weapon', magicDamage: 10, darkDamage: 5, rarity: 'common', color: '#330033' },
                armor: { name: 'Dark Robes', type: 'armor', slot: 'armor', defense: 3, manaBonus: 20, rarity: 'common', color: '#1a0033' }
            },
            arcmage: {
                weapon: { name: 'Arcane Wand', type: 'staff', slot: 'weapon', magicDamage: 12, rarity: 'common', color: '#aa44ff' },
                armor: { name: 'Apprentice Robes', type: 'armor', slot: 'armor', defense: 2, manaBonus: 30, rarity: 'common', color: '#6666cc' }
            },
            magicalknight: {
                weapon: { name: 'Runic Blade', type: 'weapon', slot: 'weapon', damage: 10, magicDamage: 5, rarity: 'common', color: '#4488ff' },
                armor: { name: 'Spellforged Armor', type: 'armor', slot: 'armor', defense: 10, manaBonus: 10, rarity: 'common', color: '#446688' }
            },
            musketeer: {
                weapon: { name: 'Flintlock Pistol', type: 'weapon', slot: 'weapon', damage: 12, rarity: 'common', color: '#555' },
                armor: { name: 'Cavalier Coat', type: 'armor', slot: 'armor', defense: 5, agilityBonus: 2, rarity: 'common', color: '#660000' }
            }
        };
        
        // Also handle class names with spaces (like 'dark mage')
        const normalizedName = className?.replace(/\s+/g, '');
        const gear = startingGear[normalizedName] || startingGear[className] || startingGear['knight'];
        
        // Equip starting gear
        for (const [slot, item] of Object.entries(gear)) {
            if (item) {
                this.equipment[slot] = item;
                this.applyEquipmentBonuses(item);
            }
        }
    }
    
    applyEquipmentBonuses(item) {
        if (!item) return;
        
        if (item.defense) this.defense += item.defense;
        if (item.damage) this.attackDamage += item.damage;
        if (item.magicDamage) this.magicDamage += item.magicDamage;
        if (item.manaBonus) this.maxMana += item.manaBonus;
        if (item.healthBonus) {
            this.maxHealth += item.healthBonus;
            this.health += item.healthBonus;
        }
        if (item.critBonus) this.critChance += item.critBonus;
        if (item.speedBonus) this.baseSpeed += item.speedBonus;
        if (item.agilityBonus) this.stats.agility += item.agilityBonus;
    }
    
    removeEquipmentBonuses(item) {
        if (!item) return;
        
        if (item.defense) this.defense -= item.defense;
        if (item.damage) this.attackDamage -= item.damage;
        if (item.magicDamage) this.magicDamage -= item.magicDamage;
        if (item.manaBonus) this.maxMana -= item.manaBonus;
        if (item.healthBonus) {
            this.maxHealth -= item.healthBonus;
            this.health = Math.min(this.health, this.maxHealth);
        }
        if (item.critBonus) this.critChance -= item.critBonus;
        if (item.speedBonus) this.baseSpeed -= item.speedBonus;
        if (item.agilityBonus) this.stats.agility -= item.agilityBonus;
    }
    
    initializeAbilities() {
        // Override in subclass or load from classData
        if (this.classData.abilities) {
            this.abilities = [...this.classData.abilities];
        }
        
        // Build spell cycle list from projectile/instant abilities
        this.spellCycleList = this.abilities.filter(a => 
            a.type === 'projectile' || a.type === 'instant'
        );
        
        // Set default active spell element if mage class
        if (this.classData.defaultAttackType === 'projectile' && this.spellCycleList.length > 0) {
            this.activeSpell = this.spellCycleList[0];
        }
    }
    
    // Cycle to next spell for default attack
    cycleSpell() {
        if (this.spellCycleList.length === 0) return null;
        
        this.activeSpellIndex = (this.activeSpellIndex + 1) % this.spellCycleList.length;
        this.activeSpell = this.spellCycleList[this.activeSpellIndex];
        
        return this.activeSpell;
    }
    
    // Get current active spell
    getActiveSpell() {
        return this.activeSpell || null;
    }
    
    update(dt) {
        super.update(dt);
        
        // Regeneration
        this.regenerate(dt);
        
        // Update cooldowns
        for (const [ability, cooldown] of this.cooldowns) {
            if (cooldown > 0) {
                this.cooldowns.set(ability, cooldown - dt);
            }
        }
        
        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }
        
        // Dash cooldown
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }
        
        // Teleport cooldown
        if (this.teleportCooldown > 0) {
            this.teleportCooldown -= dt;
        }
        
        // Dash animation timer
        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            // Add trail points during dash
            this.dashTrail.push({
                x: this.x,
                y: this.y,
                alpha: 1.0
            });
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.lastDashEndTime = Date.now();
                // Open chain window - 4 frames at 60fps ~= 0.066 seconds (2 frames before/after forgiveness)
                this.dashChainWindow = 0.1;
                
                // If a chain dash was queued, execute it immediately
                if (this.dashChainQueued) {
                    this.executeChainDash();
                }
            }
        }
        
        // Dash chain window timer
        if (this.dashChainWindow > 0) {
            this.dashChainWindow -= dt;
            if (this.dashChainWindow <= 0) {
                // Chain window closed - reset chain count if not chaining
                if (!this.isDashing) {
                    this.dashChainCount = 0;
                }
                this.dashChainQueued = false;
            }
        }
        
        // Fade dash trail
        for (let i = this.dashTrail.length - 1; i >= 0; i--) {
            this.dashTrail[i].alpha -= dt * 5;
            if (this.dashTrail[i].alpha <= 0) {
                this.dashTrail.splice(i, 1);
            }
        }
        
        // Update status effects
        this.updateStatusEffects(dt);
        
        // Update state timer
        if (this.stateTimer > 0) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
            }
        }
        
        // Invulnerability
        if (this.invulnerabilityTime > 0) {
            this.invulnerabilityTime -= dt;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update parry system
        this.updateParry(dt);
        
        // Level up check
        if (this.experience >= this.experienceToLevel) {
            this.levelUp();
        }
        
        // Multiclass unlock at level 25
        if (this.level >= 25 && !this.canMulticlass) {
            this.canMulticlass = true;
        }
        
        // Sprint stamina drain
        if (this.isSprinting && this.stamina > 0) {
            this.stamina -= 10 * dt; // Reduced from 20 * dt
            if (this.stamina <= 0) {
                this.stopSprinting();
            }
        }
        
        // Update animation
        this.updateAnimation(dt);
    }
    
    regenerate(dt) {
        // Health regen (very slow in combat)
        if (this.state !== 'combat') {
            this.health = Math.min(this.maxHealth, this.health + 1 * dt);
        }
        
        // Mana regen (improved)
        const manaRegenRate = 4 + this.stats.intelligence * 0.2; // Doubled base rate
        this.mana = Math.min(this.maxMana, this.mana + manaRegenRate * dt);
        
        // Stamina regen (improved - faster when not sprinting, still regens while sprinting)
        const baseStaminaRegen = 50; // Increased from 30
        if (!this.isSprinting) {
            this.stamina = Math.min(this.maxStamina, this.stamina + baseStaminaRegen * dt);
        } else {
            // Slow regen even while sprinting
            this.stamina = Math.min(this.maxStamina, this.stamina + (baseStaminaRegen * 0.2) * dt);
        }
    }
    
    updateAnimation(dt) {
        this.animationTimer += dt;
        if (this.animationTimer >= 0.1) {
            this.animationTimer = 0;
            this.animationFrame++;
        }
        
        // Determine animation state
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (this.state === 'attacking') {
            this.animationState = 'attack';
        } else if (speed > 10) {
            this.animationState = this.isSprinting ? 'run' : 'walk';
        } else {
            this.animationState = 'idle';
        }
    }
    
    updateStatusEffects(dt) {
        // Support both array and Map formats
        if (this.statusEffects instanceof Map) {
            for (const [name, effect] of this.statusEffects) {
                effect.duration -= dt;
                
                if (effect.tickTimer !== undefined) {
                    effect.tickTimer -= dt;
                    if (effect.tickTimer <= 0) {
                        effect.tickTimer = effect.tickRate || 1;
                        if (effect.tickDamage) {
                            this.takeDamage(effect.tickDamage, effect.source);
                        }
                        if (effect.tickHeal) {
                            this.heal(effect.tickHeal);
                        }
                    }
                }
                
                if (effect.duration <= 0) {
                    this.statusEffects.delete(name);
                }
            }
        }
    }
    
    addStatusEffect(effect) {
        if (this.statusEffects instanceof Map) {
            const existing = this.statusEffects.get(effect.type);
            if (existing) {
                existing.duration = Math.max(existing.duration, effect.duration);
            } else {
                this.statusEffects.set(effect.type, { ...effect });
                // Flag for visual effects
                this.pendingStatusVisual = effect.type;
            }
        }
    }
    
    removeStatusEffect(name) {
        if (this.statusEffects instanceof Map) {
            this.statusEffects.delete(name);
        }
    }
    
    applyStatusEffectModifiers(effect, apply) {
        const multiplier = apply ? 1 : -1;
        
        if (effect.speedModifier) {
            this.maxSpeed += this.baseSpeed * effect.speedModifier * multiplier;
        }
        if (effect.damageModifier) {
            this.attackDamage += this.attackDamage * effect.damageModifier * multiplier;
        }
    }
    
    // Movement methods (can be overridden by class)
    move(dx, dy, dt, isSprinting = false) {
        if (this.state === 'stunned' || this.state === 'attacking') return;
        
        // Store previous position for collision
        this.prevX = this.x;
        this.prevY = this.y;
        
        // Handle sprinting
        if (isSprinting && this.stamina > 0 && this.classData.canSprint !== false) {
            this.isSprinting = true;
            this.stamina -= 10 * dt; // Reduced from 20 * dt
        } else {
            this.isSprinting = false;
        }
        
        const speed = this.isSprinting ? this.maxSpeed * this.sprintMultiplier : this.maxSpeed;
        
        // Normalize diagonal movement
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
            this.facing = { x: dx, y: dy };
        }
        
        // Apply movement
        this.x += dx * speed * dt;
        this.y += dy * speed * dt;
        
        this.velocity.x = dx * speed;
        this.velocity.y = dy * speed;
    }
    
    dash(dx, dy) {
        // Check for chain dash input during chain window
        if (this.dashChainWindow > 0 && this.isDashing) {
            // Queue the chain dash for when current dash ends
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 0) {
                this.dashChainQueued = true;
                this.dashChainDirection = { x: dx / length, y: dy / length };
            }
            return false;
        }
        
        // Check for chain dash input at the exact moment dash ends
        if (this.dashChainWindow > 0 && !this.isDashing) {
            // Perfect timing! Execute chain dash with reduced cost
            return this.executeChainDash(dx, dy);
        }
        
        // Normal dash
        if (!this.canDash || this.dashCooldown > 0 || this.stamina < 20) return false;
        
        // Use movement direction, not facing direction
        // If no movement, don't dash
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return false;
        
        // Normalize direction
        dx /= length;
        dy /= length;
        
        // Store start position for validation and animation
        this.isDashing = true;
        this.dashStartX = this.x;
        this.dashStartY = this.y;
        this.dashDirX = dx;
        this.dashDirY = dy;
        this.dashTimer = 0.15;
        
        // Store pending dash for Game.js to validate with wall collision
        this.pendingDash = {
            startX: this.x,
            startY: this.y,
            dirX: dx,
            dirY: dy,
            distance: this.dashDistance
        };
        
        // Reset chain count on fresh dash
        this.dashChainCount = 0;
        
        this.dashCooldown = 0.8;
        this.stamina -= 20;
        
        // Extended invulnerability during dash (0.25 seconds for more responsiveness)
        this.setInvulnerable(0.25);
        
        return true;
    }
    
    executeChainDash(dx, dy) {
        // Use provided direction or queued direction
        if (!dx && !dy) {
            dx = this.dashChainDirection.x;
            dy = this.dashChainDirection.y;
        }
        
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return false;
        
        // Chain dash has reduced stamina cost
        const chainStaminaCost = Math.max(5, 20 - this.dashChainCount * 5);
        if (this.stamina < chainStaminaCost) return false;
        
        // Normalize direction
        dx /= length;
        dy /= length;
        
        // Execute chain dash
        this.isDashing = true;
        this.dashStartX = this.x;
        this.dashStartY = this.y;
        this.dashDirX = dx;
        this.dashDirY = dy;
        this.dashTimer = 0.15;
        
        // Store pending dash for Game.js to validate with wall collision
        this.pendingDash = {
            startX: this.x,
            startY: this.y,
            dirX: dx,
            dirY: dy,
            distance: this.dashDistance * (1 + this.dashChainCount * 0.1) // Slight distance bonus on chains
        };
        
        // Increment chain count
        this.dashChainCount++;
        
        // Chain dash has NO cooldown - can keep chaining while timing correctly
        this.dashCooldown = 0;
        this.dashChainQueued = false;
        this.dashChainWindow = 0;
        
        // Reduced stamina cost for chains
        this.stamina -= chainStaminaCost;
        
        // Invulnerability during dash
        this.setInvulnerable(0.25);
        
        // Flag for Game.js to know this is a chain dash
        this.wasChainDash = true;
        
        return true;
    }
    
    teleport(dx, dy) {
        if (!this.canTeleport || this.teleportCooldown > 0 || this.mana < 15) return false;
        
        // Use movement direction, not facing direction
        // If no movement, don't teleport
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return false;
        
        // Normalize direction
        dx /= length;
        dy /= length;
        
        // Store pending teleport for Game.js to validate with wall collision
        this.pendingTeleport = {
            startX: this.x,
            startY: this.y,
            dirX: dx,
            dirY: dy,
            distance: this.teleportDistance
        };
        
        this.teleportCooldown = this.teleportCooldownTime;
        this.mana -= 15;
        
        // Brief invulnerability during teleport
        this.setInvulnerable(0.3);
        
        return true;
    }
    
    startSprinting() {
        if (this.stamina > 0 && this.classData.canSprint !== false) {
            this.isSprinting = true;
        }
    }
    
    stopSprinting() {
        this.isSprinting = false;
    }
    
    // Parry system
    startParry() {
        // Check if parry is available
        if (!this.canParry || this.parryCooldown > 0 || this.isParrying) return false;
        
        // Check stamina cost
        const parryCost = 10;
        if (this.stamina < parryCost) return false;
        
        // Start parry window
        this.isParrying = true;
        this.parryWindow = this.parryWindowDuration;
        this.stamina -= parryCost;
        
        // Set parry cooldown
        this.parryCooldown = 0.8; // 800ms cooldown
        
        // Visual state
        this.state = 'parrying';
        this.stateTimer = this.parryWindowDuration + 0.1; // Slightly longer than window for recovery
        
        // Brief invulnerability on successful parry will be handled by parry collision
        return true;
    }
    
    updateParry(dt) {
        // Update parry window timer
        if (this.parryWindow > 0) {
            this.parryWindow -= dt;
            if (this.parryWindow <= 0) {
                this.isParrying = false;
                this.parryWindow = 0;
            }
        }
        
        // Update parry cooldown
        if (this.parryCooldown > 0) {
            this.parryCooldown -= dt;
        }
    }
    
    // Called when parry successfully deflects an attack
    onParrySuccess(attacker) {
        // Reward for successful parry
        this.stamina = Math.min(this.maxStamina, this.stamina + 15);
        
        // Brief invulnerability after successful parry
        this.setInvulnerable(0.3);
        
        // Stagger the attacker if possible
        if (attacker && typeof attacker.stagger === 'function') {
            attacker.stagger(0.5);
        }
        
        // Reset parry window for potential chain parry
        this.parryCooldown = 0.3; // Reduced cooldown after success
    }
    
    // Combat methods
    attack(targetX, targetY) {
        if (this.state === 'attacking' || this.attackCooldown > 0) return;
        
        this.state = 'attacking';
        this.stateTimer = 0.3;
        this.attackCooldown = 0.5;
        
        // Calculate damage
        let damage = this.attackDamage;
        let isCrit = false;
        
        // Critical hit
        if (Math.random() * 100 < this.critChance) {
            damage *= this.critMultiplier;
            isCrit = true;
        }
        
        // Apply weapon damage
        const weapon = this.equipment.weapon;
        if (weapon) {
            damage += weapon.damage || 0;
        }
        
        // Get attack type from class definition, weapon, or default to melee
        // Priority: active spell (for mages) > weapon attackType > class defaultAttackType > 'melee'
        let attackType = weapon?.attackType || this.classData?.defaultAttackType || 'melee';
        let attackRange = weapon?.range || this.classData?.defaultAttackRange || 70;
        let attackElement = weapon?.element || this.classData?.defaultAttackElement || 'physical';
        let attackSpeed = this.classData?.defaultAttackSpeed || 400;
        let attackRadius = this.classData?.defaultAttackRadius || 80;
        let attackHoming = this.classData?.defaultAttackHoming || false;
        
        // If mage class with active spell, use spell properties for default attack
        if (this.activeSpell && this.classData?.defaultAttackType === 'projectile') {
            attackType = this.activeSpell.type === 'instant' ? 'projectile' : this.activeSpell.type;
            attackRange = this.activeSpell.range || attackRange;
            attackElement = this.activeSpell.element || attackElement;
            attackRadius = this.activeSpell.radius || attackRadius;
            
            // Apply intelligence bonus to magic damage
            damage = this.magicDamage + (this.activeSpell.damage || 0);
            if (isCrit) damage *= this.critMultiplier;
        }
        
        // Create pending attack for combat manager
        // Player position (this.x, this.y) is already the center point
        this.pendingAttack = {
            type: attackType,
            damage: damage,
            isCrit: isCrit,
            x: this.x,
            y: this.y,
            targetX: targetX,
            targetY: targetY,
            range: attackRange,
            speed: attackSpeed,
            owner: this,
            element: attackElement,
            attackSound: this.classData?.defaultAttackSound || null,
            radius: attackRadius,
            homing: attackHoming,
            activeSpell: this.activeSpell // Pass spell info for visual effects
        };
        
        return damage;
    }
    
    useAbility(abilityIndex, targetX = null, targetY = null) {
        const ability = this.abilities[abilityIndex];
        if (!ability) return null;
        
        // Check cooldown
        const cooldown = this.cooldowns.get(ability.name) || 0;
        if (cooldown > 0) return null;
        
        // Check mana/stamina cost
        if (ability.manaCost && this.mana < ability.manaCost) return null;
        if (ability.staminaCost && this.stamina < ability.staminaCost) return null;
        
        // Check if ability is unlocked
        if (ability.requiresUnlock && !this.unlockedSkills.has(ability.name)) return null;
        
        // Consume resources
        if (ability.manaCost) this.mana -= ability.manaCost;
        if (ability.staminaCost) this.stamina -= ability.staminaCost;
        
        // Set cooldown
        this.cooldowns.set(ability.name, ability.cooldown || 1);
        
        // Set state
        this.state = 'casting';
        this.stateTimer = ability.castTime || 0.2;
        
        // Execute ability based on type
        this.executeAbility(ability, targetX, targetY);
        
        return ability;
    }
    
    // Execute ability and create its effects
    executeAbility(ability, targetX, targetY) {
        // Calculate direction to target
        const dx = targetX !== null ? targetX - this.x : this.facingX;
        const dy = targetY !== null ? targetY - this.y : this.facingY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // Store pending ability for CombatManager to pick up
        this.pendingAbility = {
            ability: ability,
            targetX: targetX,
            targetY: targetY,
            dirX: dirX,
            dirY: dirY,
            startX: this.x,
            startY: this.y,
            owner: this
        };
        
        // Apply immediate buffs/debuffs
        if (ability.type === 'buff') {
            this.applyAbilityBuff(ability);
        }
        
        // Apply healing
        if (ability.type === 'heal') {
            this.applyAbilityHeal(ability);
        }
    }
    
    // Apply buff ability to self
    applyAbilityBuff(ability) {
        if (!ability.effects) return;
        
        for (const effect of ability.effects) {
            this.addStatusEffect({
                type: effect.type,
                value: effect.value,
                duration: effect.duration || ability.duration || 5,
                source: 'ability'
            });
        }
    }
    
    // Apply heal ability
    applyAbilityHeal(ability) {
        const healAmount = ability.healAmount || (this.stats.intelligence * 3 + 20);
        this.heal(healAmount);
        
        // Mark for visual effect
        this.justHealed = true;
        this.healEffectTimer = 0.5;
    }
    
    // Add a status effect
    addStatusEffect(effect) {
        if (!this.statusEffects) this.statusEffects = [];
        
        // Check if we already have this effect type
        const existing = this.statusEffects.find(e => e.type === effect.type);
        if (existing) {
            // Refresh duration
            existing.duration = Math.max(existing.duration, effect.duration);
            existing.value = effect.value; // Update value too
        } else {
            this.statusEffects.push({...effect});
        }
    }
    
    // Update status effects
    updateStatusEffects(dt) {
        if (!this.statusEffects) return;
        
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];
            effect.duration -= dt;
            
            if (effect.duration <= 0) {
                this.statusEffects.splice(i, 1);
            }
        }
        
        // Update heal effect timer
        if (this.healEffectTimer > 0) {
            this.healEffectTimer -= dt;
            if (this.healEffectTimer <= 0) {
                this.justHealed = false;
            }
        }
    }
    
    // Check if status effect is active
    hasStatusEffect(type) {
        if (this.statusEffects instanceof Map) {
            return this.statusEffects.has(type);
        }
        return this.statusEffects?.some?.(e => e.type === type) || false;
    }
    
    // Get status effect value
    getStatusEffectValue(type) {
        if (this.statusEffects instanceof Map) {
            const effect = this.statusEffects.get(type);
            return effect ? effect.value : 0;
        }
        const effect = this.statusEffects?.find?.(e => e.type === type);
        return effect ? effect.value : 0;
    }
    
    takeDamage(amount, source = null) {
        if (this.invulnerable) return 0;
        
        // Check for active parry window - perfect block
        if (this.isParrying && this.parryWindow > 0) {
            this.onParrySuccess(source);
            this.pendingStatusVisual = { type: 'parry_success' };
            return 0;
        }
        
        // Check for active shield (blocks hits completely)
        if (this.hasStatusEffect && this.hasStatusEffect('shield_active')) {
            // Get the shield effect and decrement hits
            if (this.statusEffects instanceof Map) {
                const shield = this.statusEffects.get('shield_active');
                if (shield && shield.value > 0) {
                    shield.value--;
                    if (shield.value <= 0) {
                        this.statusEffects.delete('shield_active');
                    }
                    // Shield absorbed the hit
                    this.pendingStatusVisual = { type: 'shield_block' };
                    return 0;
                }
            }
        }
        
        // Check for damage absorption shield (absorbs % of damage)
        if (this.hasStatusEffect && this.hasStatusEffect('shield_absorb')) {
            if (this.statusEffects instanceof Map) {
                const absorbShield = this.statusEffects.get('shield_absorb');
                if (absorbShield && absorbShield.value > 0) {
                    // Absorb damage from shield pool
                    const absorbed = Math.min(absorbShield.value, amount);
                    absorbShield.value -= absorbed;
                    amount -= absorbed;
                    
                    if (absorbShield.value <= 0) {
                        this.statusEffects.delete('shield_absorb');
                    }
                    
                    // Show partial block visual
                    if (amount <= 0) {
                        this.pendingStatusVisual = { type: 'shield_block' };
                        return 0;
                    }
                }
            }
        }
        
        // Check for mana shield (uses mana to block damage)
        if (this.hasStatusEffect && this.hasStatusEffect('mana_shield')) {
            if (this.statusEffects instanceof Map) {
                const manaShield = this.statusEffects.get('mana_shield');
                if (manaShield && this.mana > 0) {
                    // Convert damage to mana cost at ratio
                    const ratio = manaShield.value || 0.5; // 0.5 = 1 damage costs 0.5 mana
                    const manaCost = amount * ratio;
                    
                    if (this.mana >= manaCost) {
                        // Full block
                        this.mana -= manaCost;
                        this.pendingStatusVisual = { type: 'mana_shield_block' };
                        return 0;
                    } else {
                        // Partial block - use remaining mana
                        const blockedDamage = this.mana / ratio;
                        amount -= blockedDamage;
                        this.mana = 0;
                    }
                }
            }
        }
        
        // Apply defense
        const defense = this.defense + (this.equipment.armor?.defense || 0);
        const reducedDamage = Math.max(1, Math.floor(amount - defense * 0.5));
        
        this.health = Math.floor(this.health - reducedDamage);
        this.state = 'combat';
        
        if (this.health <= 0) {
            this.die();
        } else {
            // Brief invulnerability after taking damage
            this.setInvulnerable(0.2);
        }
        
        return reducedDamage;
    }
    
    heal(amount) {
        this.health = Math.floor(Math.min(this.maxHealth, this.health + amount));
    }
    
    setInvulnerable(duration) {
        this.invulnerable = true;
        this.invulnerabilityTime = duration;
    }
    
    die() {
        this.state = 'dead';
        this.active = false;
        // Trigger death event
    }
    
    // Level system
    gainExperience(amount) {
        this.experience += amount;
    }
    
    levelUp() {
        this.level++;
        this.experience -= this.experienceToLevel;
        this.experienceToLevel = Math.floor(this.experienceToLevel * 1.5);
        
        // Gain skill point and stat points
        this.skillPoints++;
        this.statPoints += 3; // 3 stat points per level to allocate
        
        // DON'T auto-increase stats anymore - player allocates them
        // const growth = this.classData.statGrowth || {};
        // this.stats.strength += growth.strength || 1;
        // etc...
        
        // Recalculate derived stats
        this.recalculateStats();
        
        // Full restore on level up
        this.health = this.maxHealth;
        this.mana = this.maxMana;
        this.stamina = this.maxStamina;
        
        // Set flag for UI notification and to show level up screen
        this.justLeveledUp = true;
        this.showLevelUpScreen = true; // New flag to freeze game and show allocation
        
        // Check for multiclass unlock at level 25
        if (this.level >= 25) {
            this.canMulticlass = true;
        }
    }
    
    // Allocate a stat point
    allocateStat(statName) {
        if (this.statPoints <= 0) return false;
        if (!this.stats.hasOwnProperty(statName)) return false;
        
        this.stats[statName]++;
        this.statPoints--;
        this.recalculateStats();
        return true;
    }
    
    recalculateStats() {
        this.maxHealth = 100 + this.stats.vitality * 10;
        this.maxMana = 50 + this.stats.intelligence * 5;
        this.maxStamina = 100 + this.stats.agility * 2;
        this.attackDamage = 10 + this.stats.strength * 2;
        this.magicDamage = 5 + this.stats.intelligence * 3;
        this.defense = 5 + this.stats.vitality;
        this.critChance = 5 + this.stats.luck * 0.5;
        this.maxSpeed = this.baseSpeed + this.stats.agility * 2;
    }
    
    // Skill tree
    unlockSkill(skillId) {
        if (this.skillPoints <= 0) return false;
        
        const skill = this.skillTree?.getSkill(skillId);
        if (!skill) return false;
        
        // Check prerequisites
        if (skill.requires) {
            for (const req of skill.requires) {
                if (!this.unlockedSkills.has(req)) return false;
            }
        }
        
        // Check level requirement
        if (skill.levelRequired && this.level < skill.levelRequired) return false;
        
        this.skillPoints--;
        this.unlockedSkills.add(skillId);
        
        // Apply passive effects
        if (skill.passive) {
            this.applySkillPassive(skill);
        }
        
        // Add ability if skill grants one
        if (skill.grantsAbility) {
            this.abilities.push(skill.grantsAbility);
        }
        
        return true;
    }
    
    applySkillPassive(skill) {
        if (skill.passive.healthBonus) this.maxHealth += skill.passive.healthBonus;
        if (skill.passive.manaBonus) this.maxMana += skill.passive.manaBonus;
        if (skill.passive.damageBonus) this.attackDamage += skill.passive.damageBonus;
        if (skill.passive.magicBonus) this.magicDamage += skill.passive.magicBonus;
        if (skill.passive.speedBonus) this.maxSpeed += skill.passive.speedBonus;
    }
    
    // Multiclassing
    selectSecondaryClass(classData) {
        if (!this.canMulticlass || this.secondaryClass) return false;
        
        this.secondaryClass = classData.name;
        this.secondaryClassData = classData;
        
        // Gain access to secondary class abilities (at reduced effectiveness)
        for (const ability of classData.abilities || []) {
            const modifiedAbility = { ...ability };
            modifiedAbility.damage = (modifiedAbility.damage || 0) * 0.7;
            modifiedAbility.manaCost = (modifiedAbility.manaCost || 0) * 1.2;
            this.abilities.push(modifiedAbility);
        }
        
        // Gain partial stat bonuses
        const secondaryStats = classData.baseStats;
        this.stats.strength += Math.floor((secondaryStats.strength || 0) * 0.3);
        this.stats.agility += Math.floor((secondaryStats.agility || 0) * 0.3);
        this.stats.intelligence += Math.floor((secondaryStats.intelligence || 0) * 0.3);
        this.stats.vitality += Math.floor((secondaryStats.vitality || 0) * 0.3);
        
        this.recalculateStats();
        
        return true;
    }
    
    // Equipment
    equip(item) {
        if (!item.slot) return false;
        
        // Unequip current item in slot
        const currentItem = this.equipment[item.slot];
        if (currentItem) {
            this.unequip(item.slot);
        }
        
        // Check class restrictions
        if (item.classRestriction && !item.classRestriction.includes(this.className)) {
            return false;
        }
        
        this.equipment[item.slot] = item;
        
        // Apply item stats
        if (item.stats) {
            for (const [stat, value] of Object.entries(item.stats)) {
                if (this.stats[stat] !== undefined) {
                    this.stats[stat] += value;
                }
            }
            this.recalculateStats();
        }
        
        return true;
    }
    
    // Alias for Game.js compatibility
    equipItem(slot, item) {
        if (item) {
            item.slot = slot;
            return this.equip(item);
        }
        return false;
    }
    
    unequip(slot) {
        const item = this.equipment[slot];
        if (!item) return null;
        
        // Remove item stats
        if (item.stats) {
            for (const [stat, value] of Object.entries(item.stats)) {
                if (this.stats[stat] !== undefined) {
                    this.stats[stat] -= value;
                }
            }
            this.recalculateStats();
        }
        
        this.equipment[slot] = null;
        
        // Add to inventory
        this.addToInventory(item);
        
        return item;
    }
    
    // Inventory
    addToInventory(item) {
        if (this.inventory.length >= this.maxInventorySize) return false;
        this.inventory.push(item);
        return true;
    }
    
    removeFromInventory(index) {
        if (index < 0 || index >= this.inventory.length) return null;
        return this.inventory.splice(index, 1)[0];
    }
    
    // Rendering
    render(ctx) {
        // Flash when invulnerable
        if (this.invulnerable && Math.floor(this.invulnerabilityTime * 10) % 2 === 0) {
            return;
        }
        
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        
        // Draw character placeholder
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // Draw class indicator
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.className[0], 0, 4);
        
        // Draw facing direction indicator
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.facing.x * 20, this.facing.y * 20);
        ctx.stroke();
        
        ctx.restore();
        
        // Draw health bar above character
        this.renderHealthBar(ctx);
    }
    
    renderHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 4;
        const x = this.x + (this.width - barWidth) / 2;
        const y = this.y - 10;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.3 ? '#4a4' : '#a44';
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Mana bar (below health)
        const manaPercent = this.mana / this.maxMana;
        ctx.fillStyle = '#44a';
        ctx.fillRect(x, y + barHeight + 1, barWidth * manaPercent, 2);
    }
}
