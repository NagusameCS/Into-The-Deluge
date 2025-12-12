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
        this.sprintMultiplier = classData.sprintMultiplier || 1.5;
        this.isSprinting = false;
        this.dashCooldown = 0;
        this.canDash = classData.canDash || false;
        this.dashDistance = classData.dashDistance || 100;
        
        // Combat
        this.attackDamage = 10 + this.stats.strength * 2;
        this.magicDamage = 5 + this.stats.intelligence * 3;
        this.defense = 5 + this.stats.vitality;
        this.critChance = 5 + this.stats.luck * 0.5;
        this.critMultiplier = 1.5;
        this.attackCooldown = 0;
        this.pendingAttack = null;
        
        // Abilities
        this.abilities = [];
        this.cooldowns = new Map();
        
        // Skill points and skill tree
        this.skillPoints = 0;
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
        
        // Setup components
        this.addTag('player');
        this.addTag('character');
        
        // Initialize class-specific abilities
        this.initializeAbilities();
    }
    
    initializeAbilities() {
        // Override in subclass or load from classData
        if (this.classData.abilities) {
            this.abilities = [...this.classData.abilities];
        }
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
            this.stamina -= 20 * dt;
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
        
        // Mana regen
        this.mana = Math.min(this.maxMana, this.mana + (2 + this.stats.intelligence * 0.1) * dt);
        
        // Stamina regen (faster when not sprinting)
        if (!this.isSprinting) {
            this.stamina = Math.min(this.maxStamina, this.stamina + 30 * dt);
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
            this.stamina -= 20 * dt;
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
        
        this.dashCooldown = 0.8;
        this.stamina -= 20;
        
        // Brief invulnerability during dash
        this.setInvulnerable(0.15);
        
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
        
        // Create pending attack for combat manager
        this.pendingAttack = {
            type: weapon?.attackType || 'melee',
            damage: damage,
            isCrit: isCrit,
            x: this.x,
            y: this.y,
            targetX: targetX,
            targetY: targetY,
            range: weapon?.range || 50,
            owner: this,
            element: weapon?.element || 'physical'
        };
        
        return damage;
    }
    
    useAbility(abilityIndex, target = null) {
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
        
        return ability;
    }
    
    takeDamage(amount, source = null) {
        if (this.invulnerable) return 0;
        
        // Apply defense
        const defense = this.defense + (this.equipment.armor?.defense || 0);
        const reducedDamage = Math.max(1, amount - defense * 0.5);
        
        this.health -= reducedDamage;
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
        this.health = Math.min(this.maxHealth, this.health + amount);
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
        
        // Gain skill point
        this.skillPoints++;
        
        // Increase stats based on class growth
        const growth = this.classData.statGrowth || {};
        this.stats.strength += growth.strength || 1;
        this.stats.agility += growth.agility || 1;
        this.stats.intelligence += growth.intelligence || 1;
        this.stats.vitality += growth.vitality || 1;
        this.stats.luck += growth.luck || 0.5;
        
        // Recalculate derived stats
        this.recalculateStats();
        
        // Full restore on level up
        this.health = this.maxHealth;
        this.mana = this.maxMana;
        this.stamina = this.maxStamina;
        
        // Set flag for UI notification
        this.justLeveledUp = true;
        
        // Check for multiclass unlock at level 25
        if (this.level >= 25) {
            this.canMulticlass = true;
        }
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
