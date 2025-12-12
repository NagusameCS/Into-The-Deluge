/**
 * Enemy System - All enemy types and AI
 */

import { Entity } from '../engine/core/Entity.js';
import { Utils } from '../engine/core/Utils.js';

export class Enemy extends Entity {
    constructor(type, config, floor = 1, isBoss = false) {
        super(0, 0);
        
        this.enemyType = type;
        this.name = config.name || 'Enemy';
        this.type = config.type || 'normal';
        this.isBoss = isBoss || config.type === 'boss';
        
        // Scale stats by floor
        const floorMultiplier = 1 + (floor - 1) * 0.15;
        
        // Stats
        this.level = floor;
        this.maxHealth = Math.floor((config.health || (50 + floor * 20)) * floorMultiplier);
        this.health = this.maxHealth;
        this.damage = Math.floor((config.damage || (5 + floor * 3)) * floorMultiplier);
        this.defense = Math.floor((config.defense || (2 + floor)) * floorMultiplier);
        this.maxSpeed = config.speed || 80;
        this.attackRange = config.attackRange || 40;
        this.aggroRange = config.aggroRange || 200;
        this.attackCooldown = config.attackCooldown || 1;
        
        // Experience/Loot
        this.expReward = Math.floor((config.expValue || (10 + floor * 5)) * floorMultiplier);
        this.expValue = this.expReward;
        this.goldValue = Math.floor((config.goldValue || (5 + floor * 2)) * floorMultiplier);
        this.lootTable = config.lootTable || [];
        this.dropChance = this.isBoss ? 0.8 : 0.2;
        
        // Visual
        this.width = config.width || 32;
        this.height = config.height || 32;
        this.color = config.color || '#aa3333';
        
        // AI State
        this.state = 'idle';
        this.target = null;
        this.attackTimer = 0;
        this.pathTimer = 0;
        this.wanderTarget = null;
        this.homePosition = { x: 0, y: 0 };
        this.maxWanderDistance = 150;
        this.pendingAttack = null;
        
        // Status
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.statusEffects = [];
        this.facing = { x: 0, y: 1 };
        
        // Special abilities
        this.abilities = config.abilities || [];
        this.abilityCooldowns = new Map();
        
        this.addTag('enemy');
        if (this.isBoss) this.addTag('boss');
    }
    
    update(dt, player = null, dungeon = null) {
        super.update(dt);
        
        // Store previous position for collision
        this.prevX = this.x;
        this.prevY = this.y;
        
        // Store references for AI
        if (player) this.target = player;
        this.dungeon = dungeon;
        
        // Update position based on velocity
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        
        // Update attack timer
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }
        
        // Update invulnerability
        if (this.invulnerabilityTime > 0) {
            this.invulnerabilityTime -= dt;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
        
        // Update status effects
        this.updateStatusEffects(dt);
        
        // Update ability cooldowns
        for (const [ability, cd] of this.abilityCooldowns) {
            if (cd > 0) {
                this.abilityCooldowns.set(ability, cd - dt);
            }
        }
        
        // AI behavior
        this.updateAI(dt);
    }
    
    updateAI(dt) {
        // Find target if none
        if (!this.target || !this.target.active) {
            this.findTarget();
        }
        
        if (this.target) {
            const dist = this.distanceTo(this.target);
            
            // Check if target is in range
            if (dist <= this.aggroRange) {
                this.state = 'chase';
                
                if (dist <= this.attackRange) {
                    this.state = 'attack';
                    this.attack();
                } else {
                    this.moveTowards(this.target, dt);
                }
            } else {
                this.target = null;
                this.state = 'idle';
            }
        } else {
            // Wander behavior
            this.wander(dt);
        }
    }
    
    findTarget() {
        if (!this.scene) return;
        
        const players = this.scene.getEntitiesByTag('player');
        let closest = null;
        let closestDist = this.aggroRange;
        
        for (const player of players) {
            if (!player.active) continue;
            const dist = this.distanceTo(player);
            if (dist < closestDist) {
                closest = player;
                closestDist = dist;
            }
        }
        
        this.target = closest;
    }
    
    moveTowards(target, dt) {
        const angle = this.angleTo(target);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        this.facing = { x: dx, y: dy };
        this.velocity.x = dx * this.maxSpeed;
        this.velocity.y = dy * this.maxSpeed;
    }
    
    wander(dt) {
        this.pathTimer -= dt;
        
        if (this.pathTimer <= 0 || !this.wanderTarget) {
            // Pick new wander target
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.maxWanderDistance;
            
            this.wanderTarget = {
                x: this.homePosition.x + Math.cos(angle) * dist,
                y: this.homePosition.y + Math.sin(angle) * dist
            };
            this.pathTimer = Utils.random(2, 5);
        }
        
        const dist = Utils.distance(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y);
        
        if (dist > 10) {
            const angle = Utils.angle(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y);
            this.velocity.x = Math.cos(angle) * this.maxSpeed * 0.3;
            this.velocity.y = Math.sin(angle) * this.maxSpeed * 0.3;
        } else {
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.wanderTarget = null;
        }
    }
    
    attack() {
        if (this.attackTimer > 0 || !this.target) return null;
        
        this.attackTimer = this.attackCooldown;
        
        // Check for special abilities
        for (const ability of this.abilities) {
            const cd = this.abilityCooldowns.get(ability.name) || 0;
            if (cd <= 0 && Math.random() < (ability.useChance || 0.3)) {
                this.abilityCooldowns.set(ability.name, ability.cooldown || 5);
                this.pendingAttack = {
                    type: ability.type || 'ability',
                    ability: ability,
                    damage: ability.damage || this.damage,
                    x: this.x,
                    y: this.y,
                    targetX: this.target.x,
                    targetY: this.target.y,
                    owner: this
                };
                return this.pendingAttack;
            }
        }
        
        // Basic attack
        this.pendingAttack = {
            type: 'melee',
            damage: this.damage,
            x: this.x,
            y: this.y,
            targetX: this.target.x,
            targetY: this.target.y,
            range: this.attackRange,
            owner: this
        };
        return this.pendingAttack;
    }
    
    takeDamage(amount, source = null) {
        if (this.invulnerable) return 0;
        
        const reducedDamage = Math.max(1, amount - this.defense * 0.3);
        this.health -= reducedDamage;
        
        // Brief invulnerability
        this.invulnerable = true;
        this.invulnerabilityTime = 0.1;
        
        // Aggro the attacker
        if (source && source.hasTag('player')) {
            this.target = source;
            this.state = 'chase';
        }
        
        if (this.health <= 0) {
            this.die(source);
        }
        
        return reducedDamage;
    }
    
    die(killer = null) {
        this.active = false;
        
        // Grant experience and gold
        if (killer && killer.gainExperience) {
            killer.gainExperience(this.expValue);
            killer.gold = (killer.gold || 0) + this.goldValue;
        }
        
        // Drop loot
        this.dropLoot();
        
        // Spawn death effect
        this.spawnDeathEffect();
    }
    
    dropLoot() {
        // Implemented in game scene
    }
    
    spawnDeathEffect() {
        // Implemented in game scene
    }
    
    updateStatusEffects(dt) {
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];
            effect.duration -= dt;
            
            // Apply effect
            if (effect.type === 'slow') {
                // Already applied via maxSpeed modification
            } else if (effect.type === 'stun') {
                this.state = 'stunned';
                this.velocity.x = 0;
                this.velocity.y = 0;
            } else if (effect.type === 'poison' || effect.type === 'burn') {
                if (!effect.tickTimer) effect.tickTimer = 0;
                effect.tickTimer -= dt;
                if (effect.tickTimer <= 0) {
                    effect.tickTimer = effect.tickRate || 1;
                    this.takeDamage(effect.damage || 5);
                }
            }
            
            if (effect.duration <= 0) {
                this.statusEffects.splice(i, 1);
            }
        }
    }
    
    addStatusEffect(effect) {
        const existing = this.statusEffects.find(e => e.type === effect.type);
        if (existing) {
            existing.duration = Math.max(existing.duration, effect.duration);
        } else {
            this.statusEffects.push({ ...effect });
        }
    }
    
    render(ctx) {
        // Flash when invulnerable
        if (this.invulnerable && Math.floor(Date.now() / 50) % 2 === 0) {
            return;
        }
        
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        // Draw enemy body
        ctx.fillStyle = this.color;
        
        if (this.type === 'boss') {
            // Boss - larger, more detailed
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Normal enemy
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        
        // Draw facing indicator
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.facing.x * 15, this.facing.y * 15);
        ctx.stroke();
        
        ctx.restore();
        
        // Health bar
        this.renderHealthBar(ctx);
        
        // Status effect indicators
        this.renderStatusEffects(ctx);
    }
    
    renderHealthBar(ctx) {
        if (this.health >= this.maxHealth) return;
        
        const barWidth = this.width + 10;
        const barHeight = 4;
        const x = this.x + (this.width - barWidth) / 2;
        const y = this.y - 10;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = this.type === 'boss' ? '#ff4444' : '#aa4444';
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        if (this.type === 'boss') {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, barWidth, barHeight);
        }
    }
    
    renderStatusEffects(ctx) {
        let offsetX = 0;
        for (const effect of this.statusEffects) {
            ctx.fillStyle = this.getEffectColor(effect.type);
            ctx.fillRect(
                this.x + offsetX,
                this.y - 18,
                8,
                4
            );
            offsetX += 10;
        }
    }
    
    getEffectColor(type) {
        const colors = {
            slow: '#66ccff',
            stun: '#ffff00',
            poison: '#00ff00',
            burn: '#ff6600',
            bleed: '#cc0000'
        };
        return colors[type] || '#ffffff';
    }
}

// Enemy type definitions
export const EnemyTypes = {
    // Basic enemies
    skeleton: {
        name: 'Skeleton',
        health: 40,
        damage: 8,
        defense: 2,
        speed: 70,
        attackRange: 40,
        aggroRange: 180,
        attackCooldown: 1.2,
        expValue: 15,
        goldValue: 5,
        color: '#d4c8a0',
        width: 28,
        height: 28
    },
    
    zombie: {
        name: 'Zombie',
        health: 60,
        damage: 12,
        defense: 3,
        speed: 40,
        attackRange: 35,
        aggroRange: 150,
        attackCooldown: 1.8,
        expValue: 20,
        goldValue: 8,
        color: '#4a6b3a',
        width: 32,
        height: 32
    },
    
    goblin: {
        name: 'Goblin',
        health: 30,
        damage: 10,
        defense: 1,
        speed: 100,
        attackRange: 35,
        aggroRange: 200,
        attackCooldown: 0.8,
        expValue: 12,
        goldValue: 10,
        color: '#4a8c4a',
        width: 24,
        height: 24
    },
    
    orc: {
        name: 'Orc',
        health: 100,
        damage: 18,
        defense: 5,
        speed: 60,
        attackRange: 50,
        aggroRange: 180,
        attackCooldown: 1.5,
        expValue: 35,
        goldValue: 20,
        color: '#3a5c3a',
        width: 40,
        height: 40
    },
    
    darkKnight: {
        name: 'Dark Knight',
        health: 150,
        damage: 22,
        defense: 10,
        speed: 50,
        attackRange: 55,
        aggroRange: 200,
        attackCooldown: 1.3,
        expValue: 50,
        goldValue: 35,
        color: '#2a2a3a',
        width: 36,
        height: 36,
        abilities: [
            { name: 'Shield Bash', damage: 15, cooldown: 8, useChance: 0.4, stun: 1 }
        ]
    },
    
    mage: {
        name: 'Dark Mage',
        health: 50,
        damage: 25,
        defense: 2,
        speed: 55,
        attackRange: 200,
        aggroRange: 250,
        attackCooldown: 2.0,
        expValue: 40,
        goldValue: 25,
        color: '#5a2a7a',
        width: 28,
        height: 28,
        abilities: [
            { name: 'Fireball', damage: 30, cooldown: 5, useChance: 0.6, type: 'projectile' }
        ]
    },
    
    archer: {
        name: 'Skeleton Archer',
        health: 35,
        damage: 15,
        defense: 1,
        speed: 65,
        attackRange: 250,
        aggroRange: 280,
        attackCooldown: 1.5,
        expValue: 25,
        goldValue: 12,
        color: '#c4b890',
        width: 26,
        height: 26
    },
    
    ghost: {
        name: 'Ghost',
        health: 45,
        damage: 20,
        defense: 0,
        speed: 90,
        attackRange: 40,
        aggroRange: 220,
        attackCooldown: 1.2,
        expValue: 30,
        goldValue: 15,
        color: '#8888cc',
        width: 30,
        height: 30,
        abilities: [
            { name: 'Phase', cooldown: 10, useChance: 0.3, type: 'teleport' }
        ]
    },
    
    // Bosses
    skeletonKing: {
        name: 'Skeleton King',
        type: 'boss',
        health: 500,
        damage: 35,
        defense: 15,
        speed: 45,
        attackRange: 60,
        aggroRange: 400,
        attackCooldown: 1.5,
        expValue: 200,
        goldValue: 150,
        color: '#f4e8c0',
        width: 64,
        height: 64,
        abilities: [
            { name: 'Summon Skeletons', cooldown: 15, useChance: 0.4, type: 'summon', count: 3 },
            { name: 'Ground Slam', damage: 50, cooldown: 10, useChance: 0.5, type: 'aoe', radius: 100 }
        ]
    },
    
    dragonLord: {
        name: 'Dragon Lord',
        type: 'boss',
        health: 800,
        damage: 50,
        defense: 20,
        speed: 35,
        attackRange: 80,
        aggroRange: 500,
        attackCooldown: 2.0,
        expValue: 500,
        goldValue: 400,
        color: '#cc3300',
        width: 80,
        height: 80,
        abilities: [
            { name: 'Fire Breath', damage: 40, cooldown: 8, useChance: 0.6, type: 'cone', angle: 60, range: 150 },
            { name: 'Tail Sweep', damage: 30, cooldown: 5, useChance: 0.4, type: 'aoe', radius: 80 },
            { name: 'Flight', cooldown: 20, useChance: 0.2, type: 'reposition' }
        ]
    },
    
    lichKing: {
        name: 'Lich King',
        type: 'boss',
        health: 600,
        damage: 40,
        defense: 10,
        speed: 30,
        attackRange: 300,
        aggroRange: 450,
        attackCooldown: 2.5,
        expValue: 400,
        goldValue: 300,
        color: '#4a0080',
        width: 56,
        height: 56,
        abilities: [
            { name: 'Death Bolt', damage: 60, cooldown: 3, useChance: 0.7, type: 'projectile' },
            { name: 'Raise Dead', cooldown: 20, useChance: 0.3, type: 'summon', count: 5 },
            { name: 'Frost Nova', damage: 35, cooldown: 12, useChance: 0.5, type: 'aoe', radius: 150, slow: 0.5 }
        ]
    }
};

// Separate boss types for easy access
export const BossTypes = {
    skeletonKing: EnemyTypes.skeletonKing,
    dragonLord: EnemyTypes.dragonLord,
    lichKing: EnemyTypes.lichKing
};

// Generate enemy drop (loot)
export function generateEnemyDrop(enemy, floor) {
    if (Math.random() > (enemy.isBoss ? 0.8 : 0.15)) return null;
    
    const rarityRoll = Math.random();
    let rarity = 'common';
    
    if (enemy.isBoss) {
        if (rarityRoll < 0.1) rarity = 'legendary';
        else if (rarityRoll < 0.3) rarity = 'epic';
        else if (rarityRoll < 0.6) rarity = 'rare';
        else rarity = 'uncommon';
    } else {
        if (rarityRoll < 0.01 * floor) rarity = 'epic';
        else if (rarityRoll < 0.05 * floor) rarity = 'rare';
        else if (rarityRoll < 0.15 * floor) rarity = 'uncommon';
    }
    
    // Return a simple loot object - weapon generation handled elsewhere
    return {
        type: 'weapon',
        level: enemy.level || floor,
        rarity: rarity
    };
}

// Factory function to create enemies
export function createEnemy(type, x, y, levelModifier = 0) {
    const config = EnemyTypes[type];
    if (!config) {
        throw new Error(`Unknown enemy type: ${type}`);
    }
    
    const enemyConfig = { ...config };
    
    // Scale by level modifier
    if (levelModifier > 0) {
        enemyConfig.level = 1 + levelModifier;
        enemyConfig.health = Math.floor(config.health * (1 + levelModifier * 0.2));
        enemyConfig.damage = Math.floor(config.damage * (1 + levelModifier * 0.15));
        enemyConfig.defense = Math.floor(config.defense * (1 + levelModifier * 0.1));
        enemyConfig.expValue = Math.floor(config.expValue * (1 + levelModifier * 0.25));
        enemyConfig.goldValue = Math.floor(config.goldValue * (1 + levelModifier * 0.2));
    }
    
    return new Enemy(x, y, enemyConfig);
}

export default Enemy;
