/**
 * Combat System - Handles attacks, projectiles, and combat logic
 */

import { Entity } from '../engine/core/Entity.js';
import { Utils } from '../engine/core/Utils.js';

// Projectile entity for ranged attacks and spells
export class Projectile extends Entity {
    constructor(x, y, angle, config) {
        super(x, y);
        
        this.angle = angle;
        this.speed = config.speed || 400;
        this.damage = config.damage || 10;
        this.damageType = config.damageType || 'physical';
        this.owner = config.owner;
        this.piercing = config.piercing || false;
        this.homing = config.homing || false;
        this.target = config.target || null;
        this.lifetime = config.lifetime || 3;
        this.maxDistance = config.maxDistance || 500;
        this.distanceTraveled = 0;
        this.hitEntities = new Set();
        
        // Visual
        this.width = config.width || 8;
        this.height = config.height || 8;
        this.color = config.color || '#ffff00';
        this.trailColor = config.trailColor || null;
        this.trail = [];
        
        // Special effects
        this.onHit = config.onHit || null;
        this.effects = config.effects || [];
        this.aoeRadius = config.aoeRadius || 0;
        this.element = config.element || null;
        
        this.addTag('projectile');
        
        // Set initial velocity
        this.velocity.x = Math.cos(angle) * this.speed;
        this.velocity.y = Math.sin(angle) * this.speed;
    }
    
    update(dt) {
        // Store trail position
        if (this.trailColor) {
            this.trail.push({ x: this.x + this.width/2, y: this.y + this.height/2, alpha: 1 });
            if (this.trail.length > 10) this.trail.shift();
            
            // Fade trail
            for (const point of this.trail) {
                point.alpha -= dt * 2;
            }
        }
        
        // Homing behavior
        if (this.homing && this.target && this.target.active) {
            const targetAngle = this.angleTo(this.target);
            const angleDiff = Utils.normalizeAngle(targetAngle - this.angle);
            const turnSpeed = 3;
            this.angle += Utils.clamp(angleDiff, -turnSpeed * dt, turnSpeed * dt);
            
            this.velocity.x = Math.cos(this.angle) * this.speed;
            this.velocity.y = Math.sin(this.angle) * this.speed;
        }
        
        super.update(dt);
        
        // Track distance
        const moved = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) * dt;
        this.distanceTraveled += moved;
        
        // Check lifetime
        this.lifetime -= dt;
        if (this.lifetime <= 0 || this.distanceTraveled >= this.maxDistance) {
            this.destroy();
        }
    }
    
    checkCollision(entity) {
        if (entity === this.owner) return false;
        if (!entity.active) return false;
        if (this.hitEntities.has(entity.id)) return false;
        if (entity.hasTag('projectile')) return false;
        
        if (this.collidesWith(entity)) {
            this.hitEntities.add(entity.id);
            
            // Deal damage
            if (entity.takeDamage) {
                entity.takeDamage(this.damage, this.owner);
            }
            
            // Apply effects
            if (entity.addStatusEffect) {
                for (const effect of this.effects) {
                    entity.addStatusEffect({ ...effect });
                }
            }
            
            // Callback
            if (this.onHit) {
                this.onHit(entity, this);
            }
            
            // AOE explosion
            if (this.aoeRadius > 0) {
                this.explode();
            }
            
            // Destroy if not piercing
            if (!this.piercing) {
                this.destroy();
            }
            
            return true;
        }
        
        return false;
    }
    
    explode() {
        // Get all entities in range and damage them
        if (this.scene) {
            for (const entity of this.scene.entities) {
                if (entity === this.owner || entity === this) continue;
                if (this.distanceTo(entity) <= this.aoeRadius) {
                    if (entity.takeDamage) {
                        entity.takeDamage(this.damage * 0.7, this.owner);
                    }
                }
            }
        }
    }
    
    render(ctx) {
        // Draw trail
        if (this.trail.length > 0) {
            ctx.save();
            for (let i = 0; i < this.trail.length; i++) {
                const point = this.trail[i];
                if (point.alpha > 0) {
                    ctx.globalAlpha = point.alpha * 0.5;
                    ctx.fillStyle = this.trailColor;
                    const size = (i / this.trail.length) * this.width;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        
        // Draw projectile
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = this.color;
        
        // Different shapes based on element
        if (this.element === 'fire') {
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(0, 0, this.width / 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.element === 'ice') {
            ctx.fillStyle = '#66ccff';
            ctx.fillRect(-this.width / 2, -this.height / 4, this.width, this.height / 2);
        } else if (this.element === 'lightning') {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-this.width / 2, 0);
            ctx.lineTo(-this.width / 4, -this.height / 4);
            ctx.lineTo(0, this.height / 4);
            ctx.lineTo(this.width / 2, 0);
            ctx.stroke();
        } else {
            // Default arrow/bullet shape
            ctx.beginPath();
            ctx.moveTo(this.width / 2, 0);
            ctx.lineTo(-this.width / 2, -this.height / 3);
            ctx.lineTo(-this.width / 4, 0);
            ctx.lineTo(-this.width / 2, this.height / 3);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Melee attack hitbox
export class MeleeAttack extends Entity {
    constructor(owner, config) {
        const offsetX = owner.facing.x * config.range;
        const offsetY = owner.facing.y * config.range;
        
        super(
            owner.x + owner.width/2 + offsetX - config.width/2,
            owner.y + owner.height/2 + offsetY - config.height/2
        );
        
        this.owner = owner;
        this.damage = config.damage || 10;
        this.damageType = config.damageType || 'physical';
        this.lifetime = config.duration || 0.15;
        this.hitEntities = new Set();
        
        this.width = config.width || 40;
        this.height = config.height || 40;
        this.color = config.color || '#ff0000';
        
        // Special effects
        this.knockback = config.knockback || 0;
        this.stun = config.stun || 0;
        this.effects = config.effects || [];
        this.cleave = config.cleave || false;
        
        this.addTag('melee_attack');
    }
    
    update(dt) {
        // Follow owner
        this.x = this.owner.x + this.owner.width/2 + this.owner.facing.x * 30 - this.width/2;
        this.y = this.owner.y + this.owner.height/2 + this.owner.facing.y * 30 - this.height/2;
        
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.destroy();
        }
    }
    
    checkCollision(entity) {
        if (entity === this.owner) return false;
        if (!entity.active) return false;
        if (this.hitEntities.has(entity.id)) return false;
        
        if (this.collidesWith(entity)) {
            this.hitEntities.add(entity.id);
            
            // Deal damage
            if (entity.takeDamage) {
                entity.takeDamage(this.damage, this.owner);
            }
            
            // Apply knockback
            if (this.knockback > 0 && entity.velocity) {
                const angle = this.owner.angleTo(entity);
                entity.velocity.x += Math.cos(angle) * this.knockback;
                entity.velocity.y += Math.sin(angle) * this.knockback;
            }
            
            // Apply stun
            if (this.stun > 0 && entity.addStatusEffect) {
                entity.addStatusEffect({ type: 'stun', duration: this.stun });
            }
            
            // Apply other effects
            if (entity.addStatusEffect) {
                for (const effect of this.effects) {
                    entity.addStatusEffect({ ...effect });
                }
            }
            
            // If not cleaving, only hit one target
            if (!this.cleave) {
                this.destroy();
            }
            
            return true;
        }
        
        return false;
    }
    
    render(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

// Area of effect zone (spells, abilities)
export class AOEZone extends Entity {
    constructor(x, y, config) {
        super(x - config.radius, y - config.radius);
        
        this.centerX = x;
        this.centerY = y;
        this.radius = config.radius || 80;
        this.width = this.radius * 2;
        this.height = this.radius * 2;
        
        this.owner = config.owner;
        this.damage = config.damage || 0;
        this.damageType = config.damageType || 'magic';
        this.tickRate = config.tickRate || 0.5;
        this.tickTimer = 0;
        this.duration = config.duration || 3;
        this.lifetime = this.duration;
        
        this.color = config.color || '#ff6600';
        this.element = config.element || null;
        this.effects = config.effects || [];
        this.pullStrength = config.pullStrength || 0;
        this.healAmount = config.healAmount || 0;
        this.friendlyFire = config.friendlyFire || false;
        
        this.hitEntities = new Map(); // Track tick timing per entity
        
        this.addTag('aoe_zone');
    }
    
    update(dt) {
        this.lifetime -= dt;
        this.tickTimer += dt;
        
        if (this.lifetime <= 0) {
            this.destroy();
        }
    }
    
    checkCollision(entity) {
        if (entity === this.owner && !this.friendlyFire) return false;
        if (!entity.active) return false;
        
        const dist = Utils.distance(
            this.centerX, this.centerY,
            entity.x + entity.width/2, entity.y + entity.height/2
        );
        
        if (dist <= this.radius) {
            // Check tick timing
            const lastHit = this.hitEntities.get(entity.id) || 0;
            if (this.tickTimer - lastHit >= this.tickRate) {
                this.hitEntities.set(entity.id, this.tickTimer);
                
                // Deal damage
                if (this.damage > 0 && entity.takeDamage) {
                    entity.takeDamage(this.damage, this.owner);
                }
                
                // Heal (for friendly zones like priest sanctuary)
                if (this.healAmount > 0 && entity.heal) {
                    // Only heal allies
                    if (this.isAlly(entity)) {
                        entity.heal(this.healAmount);
                    }
                }
                
                // Apply effects
                if (entity.addStatusEffect) {
                    for (const effect of this.effects) {
                        entity.addStatusEffect({ ...effect, source: this.owner });
                    }
                }
            }
            
            // Pull effect (for gravity wells etc)
            if (this.pullStrength > 0 && entity.velocity) {
                const angle = Utils.angle(
                    entity.x + entity.width/2, entity.y + entity.height/2,
                    this.centerX, this.centerY
                );
                const pull = this.pullStrength * (1 - dist / this.radius);
                entity.velocity.x += Math.cos(angle) * pull * dt;
                entity.velocity.y += Math.sin(angle) * pull * dt;
            }
            
            return true;
        }
        
        return false;
    }
    
    isAlly(entity) {
        // Check if entity is allied with owner
        if (!this.owner) return false;
        if (entity.hasTag('player') && this.owner.hasTag('player')) return true;
        if (entity.hasTag('enemy') && this.owner.hasTag('enemy')) return true;
        return false;
    }
    
    render(ctx) {
        ctx.save();
        
        const alpha = Math.min(0.5, this.lifetime / this.duration + 0.2);
        ctx.globalAlpha = alpha;
        
        // Draw zone circle
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        
        // Different colors based on element
        if (this.element === 'fire') {
            const gradient = ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, this.radius
            );
            gradient.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0.2)');
            ctx.fillStyle = gradient;
        } else if (this.element === 'ice') {
            const gradient = ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, this.radius
            );
            gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(50, 100, 255, 0.2)');
            ctx.fillStyle = gradient;
        } else if (this.element === 'holy') {
            const gradient = ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, this.radius
            );
            gradient.addColorStop(0, 'rgba(255, 255, 150, 0.8)');
            gradient.addColorStop(1, 'rgba(255, 255, 0, 0.2)');
            ctx.fillStyle = gradient;
        } else if (this.element === 'dark') {
            const gradient = ctx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, this.radius
            );
            gradient.addColorStop(0, 'rgba(80, 0, 120, 0.8)');
            gradient.addColorStop(1, 'rgba(40, 0, 80, 0.2)');
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = this.color;
        }
        
        ctx.fill();
        
        // Draw border
        ctx.globalAlpha = alpha * 1.5;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
}

// Combat manager to handle all combat interactions
export class CombatManager {
    constructor(scene = null) {
        this.scene = scene;
        this.dungeon = null; // Reference to dungeon for wall collision
        this.projectiles = [];
        this.meleeAttacks = [];
        this.aoeZones = [];
        this.combatResults = [];
        this.particles = []; // Visual particles
        this.statusEffectVisuals = []; // Status effect animations
    }
    
    // Set dungeon reference for wall collision
    setDungeon(dungeon) {
        this.dungeon = dungeon;
    }
    
    // Add particle effect
    addParticle(x, y, config) {
        this.particles.push({
            x: x,
            y: y,
            vx: config.vx || (Math.random() - 0.5) * 100,
            vy: config.vy || (Math.random() - 0.5) * 100,
            size: config.size || 4,
            color: config.color || '#ffffff',
            lifetime: config.lifetime || 0.5,
            maxLifetime: config.lifetime || 0.5,
            gravity: config.gravity || 0,
            friction: config.friction || 0.98,
            shrink: config.shrink !== false,
            glow: config.glow || false
        });
    }
    
    // Create burst of particles
    createParticleBurst(x, y, count, config) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const speed = (config.speed || 100) * (0.5 + Math.random() * 0.5);
            this.addParticle(x, y, {
                ...config,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed
            });
        }
    }
    
    // Add attack from character's pendingAttack
    addAttack(attackData, owner) {
        if (!attackData) return;
        
        const type = attackData.type || 'melee';
        
        if (type === 'melee') {
            // Determine element color for melee attack
            const elementColor = attackData.element === 'fire' ? '#ff6600' : 
                       attackData.element === 'ice' ? '#66ccff' :
                       attackData.element === 'lightning' ? '#ffff00' :
                       attackData.element === 'poison' ? '#44ff44' :
                       attackData.element === 'holy' ? '#ffffaa' :
                       attackData.element === 'dark' ? '#aa66cc' :
                       attackData.element === 'earth' ? '#8b7355' :
                       attackData.element === 'electric' ? '#88ffff' :
                       attackData.element === 'arcane' ? '#aa88ff' : '#ffffff';
            
            this.meleeAttacks.push({
                owner: owner,
                damage: attackData.damage || 10,
                x: attackData.x,
                y: attackData.y,
                targetX: attackData.targetX,
                targetY: attackData.targetY,
                range: attackData.range || 50,
                lifetime: 0.2,
                maxLifetime: 0.2,
                hitEntities: new Set(),
                isCrit: attackData.isCrit,
                swingAngle: 0,
                element: attackData.element,
                color: elementColor,
                knockback: attackData.knockback || 0
            });
            
            // Slash particles - more particles spread across the arc with element color
            const slashAngle = Math.atan2(attackData.targetY - attackData.y, attackData.targetX - attackData.x);
            const slashRange = attackData.range || 100;
            for (let i = 0; i < 10; i++) {
                const spread = (i - 4.5) * 0.2;
                const dist = slashRange * (0.4 + Math.random() * 0.6);
                this.addParticle(
                    attackData.x + Math.cos(slashAngle + spread) * dist * 0.3,
                    attackData.y + Math.sin(slashAngle + spread) * dist * 0.3,
                    {
                        vx: Math.cos(slashAngle + spread) * 350,
                        vy: Math.sin(slashAngle + spread) * 350,
                        color: elementColor,
                        size: 4 + Math.random() * 3,
                        lifetime: 0.25,
                        glow: attackData.element ? true : false
                    }
                );
            }
        } else if (type === 'arrow') {
            // Archer's arrow - fast, physical projectile with arrow visuals
            const dx = attackData.targetX - attackData.x;
            const dy = attackData.targetY - attackData.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = attackData.speed || 550;
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            
            const arrow = {
                owner: owner,
                x: attackData.x,
                y: attackData.y,
                vx: vx,
                vy: vy,
                damage: attackData.damage || 25,
                range: attackData.range || 350,
                distanceTraveled: 0,
                size: 16,
                isArrow: true,
                element: 'physical',
                rotation: Math.atan2(dy, dx),
                isCrit: attackData.isCrit,
                trail: []
            };
            
            // Arrow launch sound effect (visual particles)
            for (let i = 0; i < 4; i++) {
                this.addParticle(attackData.x, attackData.y, {
                    vx: -vx * 0.1 + (Math.random() - 0.5) * 30,
                    vy: -vy * 0.1 + (Math.random() - 0.5) * 30,
                    color: '#8b7355',
                    size: 2,
                    lifetime: 0.2
                });
            }
            
            this.projectiles.push(arrow);
        } else if (type === 'musketShot') {
            // Musketeer's musket shot - fast bullet with muzzle flash and smoke
            const dx = attackData.targetX - attackData.x;
            const dy = attackData.targetY - attackData.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = attackData.speed || 650;
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            const angle = Math.atan2(dy, dx);
            
            const bullet = {
                owner: owner,
                x: attackData.x + Math.cos(angle) * 20, // Start from muzzle
                y: attackData.y + Math.sin(angle) * 20,
                vx: vx,
                vy: vy,
                damage: attackData.damage || 40,
                range: attackData.range || 320,
                distanceTraveled: 0,
                size: 8,
                isMusketBullet: true,
                element: 'physical',
                rotation: angle,
                isCrit: attackData.isCrit,
                lifetime: 2,
                trail: []
            };
            
            // Muzzle flash - bright yellow/white burst
            for (let i = 0; i < 12; i++) {
                const flashAngle = angle + (Math.random() - 0.5) * 0.8;
                const flashSpeed = 100 + Math.random() * 150;
                this.addParticle(attackData.x + Math.cos(angle) * 15, attackData.y + Math.sin(angle) * 15, {
                    vx: Math.cos(flashAngle) * flashSpeed,
                    vy: Math.sin(flashAngle) * flashSpeed,
                    color: Math.random() > 0.3 ? '#ffff88' : '#ffffff',
                    size: 4 + Math.random() * 3,
                    lifetime: 0.15,
                    glow: true
                });
            }
            
            // Smoke cloud
            for (let i = 0; i < 8; i++) {
                const smokeAngle = angle + (Math.random() - 0.5) * 1.2;
                this.addParticle(attackData.x + Math.cos(angle) * 10, attackData.y + Math.sin(angle) * 10, {
                    vx: Math.cos(smokeAngle) * (30 + Math.random() * 40),
                    vy: Math.sin(smokeAngle) * (30 + Math.random() * 40) - 20,
                    color: '#888888',
                    size: 6 + Math.random() * 4,
                    lifetime: 0.5 + Math.random() * 0.3,
                    friction: 0.95
                });
            }
            
            // Recoil particles (behind shooter)
            for (let i = 0; i < 4; i++) {
                this.addParticle(attackData.x - Math.cos(angle) * 5, attackData.y - Math.sin(angle) * 5, {
                    vx: -Math.cos(angle) * 50 + (Math.random() - 0.5) * 30,
                    vy: -Math.sin(angle) * 50 + (Math.random() - 0.5) * 30,
                    color: '#aaaaaa',
                    size: 3,
                    lifetime: 0.2
                });
            }
            
            this.projectiles.push(bullet);
        } else if (type === 'projectile' || type === 'ranged') {
            const dx = attackData.targetX - attackData.x;
            const dy = attackData.targetY - attackData.y;
            const angle = Math.atan2(dy, dx);
            const speed = attackData.speed || 400;
            
            const projectile = {
                owner: owner,
                damage: attackData.damage || 10,
                x: attackData.x,
                y: attackData.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                angle: angle,
                lifetime: 2,
                width: attackData.width || 12,
                height: attackData.height || 12,
                element: attackData.element || 'none',
                isCrit: attackData.isCrit,
                trail: [],
                orbs: [], // Orbiting particles for spells
                pulseTimer: 0,
                spin: attackData.spin || 0
            };
            
            // Add orbiting orbs for magic projectiles
            if (attackData.element === 'fire') {
                for (let i = 0; i < 3; i++) {
                    projectile.orbs.push({
                        angle: (i / 3) * Math.PI * 2,
                        distance: 15,
                        size: 4,
                        color: '#ffff00'
                    });
                }
            } else if (attackData.element === 'ice') {
                for (let i = 0; i < 4; i++) {
                    projectile.orbs.push({
                        angle: (i / 4) * Math.PI * 2,
                        distance: 12,
                        size: 3,
                        color: '#aaeeff'
                    });
                }
            } else if (attackData.element === 'lightning') {
                projectile.orbs.push({
                    angle: 0,
                    distance: 0,
                    size: 8,
                    color: '#ffff88'
                });
            } else if (attackData.element === 'dark' || attackData.element === 'shadow') {
                for (let i = 0; i < 5; i++) {
                    projectile.orbs.push({
                        angle: (i / 5) * Math.PI * 2,
                        distance: 10,
                        size: 3,
                        color: '#8844aa'
                    });
                }
            } else if (attackData.element === 'poison') {
                for (let i = 0; i < 3; i++) {
                    projectile.orbs.push({
                        angle: (i / 3) * Math.PI * 2,
                        distance: 8,
                        size: 4,
                        color: '#44ff44'
                    });
                }
            } else if (attackData.element === 'holy') {
                for (let i = 0; i < 6; i++) {
                    projectile.orbs.push({
                        angle: (i / 6) * Math.PI * 2,
                        distance: 12,
                        size: 3,
                        color: '#ffffaa'
                    });
                }
            } else if (attackData.element === 'earth') {
                for (let i = 0; i < 4; i++) {
                    projectile.orbs.push({
                        angle: (i / 4) * Math.PI * 2 + Math.random() * 0.3,
                        distance: 14,
                        size: 5,
                        color: '#8b7355'
                    });
                }
            } else if (attackData.element === 'electric') {
                for (let i = 0; i < 3; i++) {
                    projectile.orbs.push({
                        angle: (i / 3) * Math.PI * 2,
                        distance: 10,
                        size: 3,
                        color: '#00ccff'
                    });
                }
            }
            
            this.projectiles.push(projectile);
        } else if (type === 'darkPulse') {
            // Necromancer's dark pulse - expanding ring of dark energy
            const pulse = {
                owner: owner,
                damage: attackData.damage || 25,
                x: attackData.x,
                y: attackData.y,
                currentRadius: 0,
                maxRadius: attackData.radius || 120,
                expandSpeed: 250, // pixels per second
                ringWidth: 20,
                lifetime: 0.6,
                maxLifetime: 0.6,
                hitEntities: new Set(),
                element: 'dark',
                particles: [],
                pulseTimer: 0,
                isDarkPulse: true
            };
            
            // Initial dark burst particles at center
            for (let i = 0; i < 15; i++) {
                const angle = (i / 15) * Math.PI * 2;
                this.addParticle(pulse.x, pulse.y, {
                    vx: Math.cos(angle) * 80,
                    vy: Math.sin(angle) * 80,
                    color: Math.random() > 0.5 ? '#6622aa' : '#220033',
                    size: 6,
                    lifetime: 0.4,
                    glow: true
                });
            }
            
            // Add some skull/spirit particles
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                this.addParticle(pulse.x, pulse.y, {
                    vx: Math.cos(angle) * 40,
                    vy: Math.sin(angle) * 40 - 30,
                    color: '#aa66cc',
                    size: 8,
                    lifetime: 0.5,
                    gravity: -50
                });
            }
            
            this.aoeZones.push(pulse);
        } else if (type === 'boneSpear') {
            // Necromancer's bone spear - piercing bone projectile
            const dx = attackData.targetX - attackData.x;
            const dy = attackData.targetY - attackData.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const vx = (dx / dist) * (attackData.speed || 400);
            const vy = (dy / dist) * (attackData.speed || 400);
            
            const boneSpear = {
                owner: owner,
                x: attackData.x,
                y: attackData.y,
                vx: vx,
                vy: vy,
                damage: attackData.damage || 30,
                range: attackData.range || 280,
                distanceTraveled: 0,
                size: 20,
                isBoneSpear: true,
                piercing: true, // Goes through multiple enemies
                hitEntities: new Set(),
                element: 'dark',
                rotation: Math.atan2(dy, dx),
                boneSegments: 5, // Visual segments
                trailParticles: []
            };
            
            // Launch particles
            for (let i = 0; i < 8; i++) {
                const angle = Math.random() * Math.PI * 2;
                this.addParticle(attackData.x, attackData.y, {
                    vx: Math.cos(angle) * 50 + vx * 0.2,
                    vy: Math.sin(angle) * 50 + vy * 0.2,
                    color: '#e8dcc8',
                    size: 4,
                    lifetime: 0.3
                });
            }
            
            this.projectiles.push(boneSpear);
        } else if (type === 'holyPurge') {
            // Priest's Holy Purge - expanding circle of holy light at cursor
            const purge = {
                owner: owner,
                damage: attackData.damage || 50,
                x: attackData.targetX,
                y: attackData.targetY,
                currentRadius: 0,
                maxRadius: attackData.radius || 100,
                expandSpeed: 200, // pixels per second
                ringWidth: 30,
                lifetime: 0.8,
                maxLifetime: 0.8,
                hitEntities: new Set(),
                element: 'holy',
                particles: [],
                pulseTimer: 0,
                isHolyPurge: true
            };
            
            // Initial holy burst - golden cross pattern
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                for (let j = 0; j < 8; j++) {
                    const dist = j * 15;
                    this.addParticle(purge.x + Math.cos(angle) * dist, purge.y + Math.sin(angle) * dist, {
                        vx: Math.cos(angle) * 100,
                        vy: Math.sin(angle) * 100,
                        color: '#ffee88',
                        size: 6 - j * 0.5,
                        lifetime: 0.5,
                        glow: true
                    });
                }
            }
            
            // Central holy explosion
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                this.addParticle(purge.x, purge.y, {
                    vx: Math.cos(angle) * 120,
                    vy: Math.sin(angle) * 120 - 30,
                    color: Math.random() > 0.5 ? '#ffffff' : '#ffdd44',
                    size: 5,
                    lifetime: 0.6,
                    glow: true
                });
            }
            
            // Rising light particles
            for (let i = 0; i < 10; i++) {
                this.addParticle(purge.x + (Math.random() - 0.5) * 60, purge.y + (Math.random() - 0.5) * 60, {
                    vx: (Math.random() - 0.5) * 30,
                    vy: -80 - Math.random() * 60,
                    color: '#ffffcc',
                    size: 4,
                    lifetime: 0.8,
                    gravity: -50
                });
            }
            
            this.aoeZones.push(purge);
        } else if (type === 'aoe') {
            const zone = {
                owner: owner,
                damage: attackData.damage || 10,
                x: attackData.targetX,
                y: attackData.targetY,
                radius: attackData.radius || 60,
                lifetime: attackData.duration || 1.0,
                maxLifetime: attackData.duration || 1.0,
                tickRate: 0.2,
                tickTimer: 0,
                hitEntities: new Map(),
                element: attackData.element || 'fire',
                pulseTimer: 0,
                particles: []
            };
            
            // Initial burst
            this.createParticleBurst(zone.x, zone.y, 20, {
                color: attackData.element === 'fire' ? '#ff6600' : 
                       attackData.element === 'ice' ? '#66ccff' :
                       attackData.element === 'poison' ? '#44ff44' : '#ffaa00',
                speed: 150,
                lifetime: 0.5,
                size: 6
            });
            
            this.aoeZones.push(zone);
        }
    }
    
    createProjectile(x, y, angle, config) {
        const projectile = new Projectile(x, y, angle, config);
        projectile.scene = this.scene;
        this.projectiles.push(projectile);
        if (this.scene) this.scene.addEntity(projectile);
        return projectile;
    }
    
    createMeleeAttack(owner, config) {
        const attack = new MeleeAttack(owner, config);
        attack.scene = this.scene;
        this.meleeAttacks.push(attack);
        if (this.scene) this.scene.addEntity(attack);
        return attack;
    }
    
    createAOEZone(x, y, config) {
        const zone = new AOEZone(x, y, config);
        zone.scene = this.scene;
        this.aoeZones.push(zone);
        if (this.scene) this.scene.addEntity(zone);
        return zone;
    }
    
    update(dt, targets = []) {
        this.combatResults = [];
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity * dt;
            p.lifetime -= dt;
            if (p.lifetime <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            // Move projectile
            const moveX = proj.vx * dt;
            const moveY = proj.vy * dt;
            proj.x += moveX;
            proj.y += moveY;
            proj.lifetime -= dt;
            proj.pulseTimer = (proj.pulseTimer || 0) + dt * 10;
            
            // Track distance for range-based projectiles (like bone spear)
            if (proj.distanceTraveled !== undefined) {
                proj.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
                if (proj.distanceTraveled >= proj.range) {
                    // Range exceeded - shatter effect for bone spear
                    if (proj.isBoneSpear) {
                        this.createParticleBurst(proj.x, proj.y, 12, {
                            color: '#e8dcc8',
                            speed: 100,
                            lifetime: 0.4,
                            size: 4
                        });
                        // Bone fragment particles
                        for (let j = 0; j < 6; j++) {
                            const angle = Math.random() * Math.PI * 2;
                            this.addParticle(proj.x, proj.y, {
                                vx: Math.cos(angle) * 80,
                                vy: Math.sin(angle) * 80,
                                color: '#c8b898',
                                size: 3,
                                lifetime: 0.5,
                                gravity: 200
                            });
                        }
                    }
                    this.projectiles.splice(i, 1);
                    continue;
                }
            }
            
            // Add trail point
            proj.trail = proj.trail || [];
            proj.trail.push({ x: proj.x, y: proj.y, alpha: 1.0 });
            if (proj.trail.length > 10) proj.trail.shift();
            
            // Update orbiting orbs
            if (proj.orbs) {
                for (const orb of proj.orbs) {
                    orb.angle += dt * 8; // Orbit speed
                }
            }
            
            // Spawn trail particles based on element
            if (Math.random() < 0.3) {
                let color = '#ffff00';
                if (proj.element === 'fire') color = Math.random() > 0.5 ? '#ff6600' : '#ffcc00';
                else if (proj.element === 'ice') color = Math.random() > 0.5 ? '#66ccff' : '#ffffff';
                else if (proj.element === 'lightning') color = '#ffff88';
                else if (proj.element === 'poison') color = '#44ff44';
                else if (proj.element === 'dark' || proj.element === 'shadow') color = '#8844aa';
                
                this.addParticle(proj.x, proj.y, {
                    vx: (Math.random() - 0.5) * 50,
                    vy: (Math.random() - 0.5) * 50,
                    color: color,
                    size: 3,
                    lifetime: 0.3,
                    friction: 0.9
                });
            }
            
            if (proj.lifetime <= 0) {
                // Explosion particles on timeout
                this.createParticleBurst(proj.x, proj.y, 8, {
                    color: proj.element === 'fire' ? '#ff6600' : '#ffff00',
                    speed: 100,
                    lifetime: 0.3,
                    size: 4
                });
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check wall collision if dungeon is available
            if (this.dungeon) {
                const tileX = Math.floor(proj.x / 32);
                const tileY = Math.floor(proj.y / 32);
                const tile = this.dungeon.getTile(tileX, tileY);
                
                // Check if hit wall or empty space (FLOOR=1, WALL=2, VOID/EMPTY=0)
                if (tile === 2 || tile === 0) { // WALL or EMPTY
                    // Check if this is a bouncing projectile
                    if (proj.bounces && proj.bounces > 0) {
                        proj.bounces--;
                        
                        // Determine which wall was hit and reflect
                        const prevTileX = Math.floor((proj.x - proj.vx * dt * 2) / 32);
                        const prevTileY = Math.floor((proj.y - proj.vy * dt * 2) / 32);
                        
                        if (prevTileX !== tileX) {
                            // Hit vertical wall - reverse X
                            proj.vx = -proj.vx;
                            proj.x += proj.vx * dt * 2;
                        }
                        if (prevTileY !== tileY) {
                            // Hit horizontal wall - reverse Y
                            proj.vy = -proj.vy;
                            proj.y += proj.vy * dt * 2;
                        }
                        
                        // Bounce particles
                        this.createParticleBurst(proj.x, proj.y, 6, {
                            color: proj.element === 'fire' ? '#ff6600' : 
                                   proj.element === 'holy' ? '#ffffaa' : '#ffaa00',
                            speed: 60,
                            lifetime: 0.2,
                            size: 3
                        });
                        
                        // Check if this projectile should split
                        if (proj.splitsRemaining && proj.splitsRemaining > 0) {
                            proj.splitsRemaining--;
                            const splitDamage = proj.damage * 0.5;
                            
                            // Create two split projectiles at 45 degree angles
                            const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
                            const angle = Math.atan2(proj.vy, proj.vx);
                            
                            for (let splitAngle of [angle - Math.PI / 4, angle + Math.PI / 4]) {
                                this.projectiles.push({
                                    x: proj.x,
                                    y: proj.y,
                                    vx: Math.cos(splitAngle) * speed,
                                    vy: Math.sin(splitAngle) * speed,
                                    damage: splitDamage,
                                    owner: proj.owner,
                                    lifetime: proj.lifetime,
                                    element: proj.element,
                                    bounces: 1, // Split projectiles get 1 bounce
                                    splitsRemaining: proj.splitsRemaining, // Pass remaining splits
                                    width: proj.width * 0.8,
                                    height: proj.height * 0.8,
                                    trail: []
                                });
                            }
                        }
                        
                        continue; // Don't destroy the projectile
                    }
                    
                    // Impact particles
                    this.createParticleBurst(proj.x, proj.y, 10, {
                        color: proj.element === 'fire' ? '#ff6600' : 
                               proj.element === 'ice' ? '#66ccff' :
                               proj.element === 'lightning' ? '#ffff00' : '#ffaa00',
                        speed: 80,
                        lifetime: 0.3,
                        size: 4
                    });
                    this.projectiles.splice(i, 1);
                    continue;
                }
            }
            
            // Check collisions
            for (const target of targets) {
                if (target === proj.owner) continue;
                if (!target.health || target.health <= 0) continue;
                
                // For piercing projectiles (like bone spear), skip already hit targets
                if (proj.piercing && proj.hitEntities && proj.hitEntities.has(target)) continue;
                
                // Check if same team
                const ownerIsPlayer = proj.owner.hasTag?.('player') || proj.owner.className;
                const targetIsPlayer = target.hasTag?.('player') || target.className;
                if (ownerIsPlayer === targetIsPlayer) continue;
                
                // Simple distance check
                const dist = Math.sqrt((target.x - proj.x) ** 2 + (target.y - proj.y) ** 2);
                if (dist < 30) {
                    const damage = target.takeDamage ? target.takeDamage(proj.damage) : proj.damage;
                    this.combatResults.push({
                        target: target,
                        damage: damage,
                        isCrit: proj.isCrit
                    });
                    
                    // Impact explosion
                    this.createParticleBurst(proj.x, proj.y, 15, {
                        color: proj.element === 'fire' ? '#ff6600' : 
                               proj.element === 'ice' ? '#66ccff' :
                               proj.element === 'lightning' ? '#ffff00' :
                               proj.element === 'poison' ? '#44ff44' :
                               proj.element === 'dark' ? '#8844aa' : '#ffaa00',
                        speed: 150,
                        lifetime: 0.4,
                        size: 5
                    });
                    
                    // For piercing projectiles, track hit and continue
                    if (proj.piercing && proj.hitEntities) {
                        proj.hitEntities.add(target);
                        // Bone spear loses some damage on pierce
                        if (proj.isBoneSpear) {
                            proj.damage *= 0.7; // 30% damage reduction per pierce
                        }
                        // Don't remove projectile, let it continue
                    } else {
                        this.projectiles.splice(i, 1);
                        break;
                    }
                }
            }
        }
        
        // Update melee attacks
        for (let i = this.meleeAttacks.length - 1; i >= 0; i--) {
            const attack = this.meleeAttacks[i];
            attack.lifetime -= dt;
            attack.swingAngle = (attack.swingAngle || 0) + dt * 20;
            
            if (attack.lifetime <= 0) {
                this.meleeAttacks.splice(i, 1);
                continue;
            }
            
            // Spawn swing particles
            if (Math.random() < 0.5) {
                const angle = Math.atan2(attack.targetY - attack.y, attack.targetX - attack.x);
                this.addParticle(
                    attack.x + Math.cos(angle) * attack.range * 0.5,
                    attack.y + Math.sin(angle) * attack.range * 0.5,
                    {
                        vx: Math.cos(angle + attack.swingAngle) * 100,
                        vy: Math.sin(angle + attack.swingAngle) * 100,
                        color: attack.color || '#ffffff',
                        size: 3,
                        lifetime: 0.15
                    }
                );
            }
            
            // Check collisions
            for (const target of targets) {
                if (target === attack.owner) continue;
                if (!target.health || target.health <= 0) continue;
                if (attack.hitEntities.has(target)) continue;
                
                // Check if same team
                const ownerIsPlayer = attack.owner.hasTag?.('player') || attack.owner.className;
                const targetIsPlayer = target.hasTag?.('player') || target.className;
                if (ownerIsPlayer === targetIsPlayer) continue;
                
                // Distance check from attack origin towards target
                const dist = Math.sqrt((target.x - attack.x) ** 2 + (target.y - attack.y) ** 2);
                if (dist < attack.range) {
                    attack.hitEntities.add(target);
                    const damage = target.takeDamage ? target.takeDamage(attack.damage) : attack.damage;
                    this.combatResults.push({
                        target: target,
                        damage: damage,
                        isCrit: attack.isCrit
                    });
                    
                    // Apply knockback if present
                    if (attack.knockback > 0 && target.velocity) {
                        const knockbackAngle = Math.atan2(target.y - attack.y, target.x - attack.x);
                        target.velocity.x += Math.cos(knockbackAngle) * attack.knockback;
                        target.velocity.y += Math.sin(knockbackAngle) * attack.knockback;
                    }
                    
                    // Hit particles
                    this.createParticleBurst(target.x, target.y, 8, {
                        color: '#ff4444',
                        speed: 80,
                        lifetime: 0.2,
                        size: 4
                    });
                }
            }
        }
        
        // Update AOE zones
        for (let i = this.aoeZones.length - 1; i >= 0; i--) {
            const zone = this.aoeZones[i];
            zone.lifetime -= dt;
            zone.tickTimer += dt;
            zone.pulseTimer = (zone.pulseTimer || 0) + dt * 5;
            
            if (zone.lifetime <= 0) {
                this.aoeZones.splice(i, 1);
                continue;
            }
            
            // Handle dark pulse expanding ring
            if (zone.isDarkPulse) {
                zone.currentRadius += zone.expandSpeed * dt;
                
                // Spawn particles along the ring edge
                if (Math.random() < 0.8) {
                    const angle = Math.random() * Math.PI * 2;
                    const edgeX = zone.x + Math.cos(angle) * zone.currentRadius;
                    const edgeY = zone.y + Math.sin(angle) * zone.currentRadius;
                    this.addParticle(edgeX, edgeY, {
                        vx: Math.cos(angle) * 30,
                        vy: Math.sin(angle) * 30 - 20,
                        color: Math.random() > 0.3 ? '#6622aa' : '#220044',
                        size: 4 + Math.random() * 3,
                        lifetime: 0.3,
                        glow: true
                    });
                }
                
                // Check collision with targets in the ring
                for (const target of targets) {
                    if (target === zone.owner) continue;
                    if (!target.health || target.health <= 0) continue;
                    if (zone.hitEntities.has(target)) continue;
                    
                    // Check if same team
                    const ownerIsPlayer = zone.owner.hasTag?.('player') || zone.owner.className;
                    const targetIsPlayer = target.hasTag?.('player') || target.className;
                    if (ownerIsPlayer === targetIsPlayer) continue;
                    
                    const dist = Math.sqrt((target.x - zone.x) ** 2 + (target.y - zone.y) ** 2);
                    // Hit if target is within the ring (between currentRadius - ringWidth and currentRadius)
                    if (dist < zone.currentRadius && dist > zone.currentRadius - zone.ringWidth * 2) {
                        zone.hitEntities.add(target);
                        const damage = target.takeDamage ? target.takeDamage(zone.damage) : zone.damage;
                        this.combatResults.push({
                            target: target,
                            damage: damage,
                            isCrit: false
                        });
                        
                        // Dark impact particles
                        this.createParticleBurst(target.x, target.y, 10, {
                            color: '#8844aa',
                            speed: 100,
                            lifetime: 0.3,
                            size: 5
                        });
                    }
                }
                continue;
            }
            
            // Handle holy purge expanding ring
            if (zone.isHolyPurge) {
                zone.currentRadius += zone.expandSpeed * dt;
                
                // Spawn holy particles along the ring edge
                if (Math.random() < 0.7) {
                    const angle = Math.random() * Math.PI * 2;
                    const edgeX = zone.x + Math.cos(angle) * zone.currentRadius;
                    const edgeY = zone.y + Math.sin(angle) * zone.currentRadius;
                    this.addParticle(edgeX, edgeY, {
                        vx: Math.cos(angle) * 20,
                        vy: -40 - Math.random() * 30,
                        color: Math.random() > 0.3 ? '#ffee88' : '#ffffff',
                        size: 3 + Math.random() * 2,
                        lifetime: 0.4,
                        glow: true
                    });
                }
                
                // Check collision with targets in the ring
                for (const target of targets) {
                    if (target === zone.owner) continue;
                    if (!target.health || target.health <= 0) continue;
                    if (zone.hitEntities.has(target)) continue;
                    
                    // Check if same team
                    const ownerIsPlayer = zone.owner.hasTag?.('player') || zone.owner.className;
                    const targetIsPlayer = target.hasTag?.('player') || target.className;
                    if (ownerIsPlayer === targetIsPlayer) continue;
                    
                    const dist = Math.sqrt((target.x - zone.x) ** 2 + (target.y - zone.y) ** 2);
                    // Hit if target is within the ring
                    if (dist < zone.currentRadius && dist > zone.currentRadius - zone.ringWidth * 2) {
                        zone.hitEntities.add(target);
                        
                        // Extra damage to undead
                        let damageMultiplier = 1;
                        if (target.isUndead || target.type === 'skeleton' || target.type === 'ghost') {
                            damageMultiplier = 1.5; // 50% bonus damage to undead
                        }
                        
                        const damage = target.takeDamage ? target.takeDamage(zone.damage * damageMultiplier) : zone.damage * damageMultiplier;
                        this.combatResults.push({
                            target: target,
                            damage: damage,
                            isCrit: false
                        });
                        
                        // Holy impact particles - golden burst
                        this.createParticleBurst(target.x, target.y, 12, {
                            color: '#ffdd44',
                            speed: 120,
                            lifetime: 0.4,
                            size: 4
                        });
                        
                        // Rising light effect
                        for (let j = 0; j < 5; j++) {
                            this.addParticle(target.x + (Math.random() - 0.5) * 20, target.y, {
                                vx: (Math.random() - 0.5) * 20,
                                vy: -60 - Math.random() * 40,
                                color: '#ffffff',
                                size: 3,
                                lifetime: 0.5,
                                gravity: -30
                            });
                        }
                    }
                }
                continue;
            }
            
            // Spawn zone particles
            if (Math.random() < 0.3) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * zone.radius;
                let color = '#ff6600';
                if (zone.element === 'fire') color = Math.random() > 0.5 ? '#ff6600' : '#ffcc00';
                else if (zone.element === 'ice') color = Math.random() > 0.5 ? '#66ccff' : '#aaeeff';
                else if (zone.element === 'poison') color = Math.random() > 0.5 ? '#44ff44' : '#88ff88';
                else if (zone.element === 'lightning') color = '#ffff88';
                
                this.addParticle(
                    zone.x + Math.cos(angle) * dist,
                    zone.y + Math.sin(angle) * dist,
                    {
                        vx: 0,
                        vy: -50 - Math.random() * 50,
                        color: color,
                        size: 4 + Math.random() * 3,
                        lifetime: 0.5 + Math.random() * 0.5,
                        friction: 0.95
                    }
                );
            }
            
            // Check collisions with tick rate
            for (const target of targets) {
                if (target === zone.owner) continue;
                if (!target.health || target.health <= 0) continue;
                
                // Ensure hitEntities is a Map, initialize if missing or wrong type
                if (!zone.hitEntities || !(zone.hitEntities instanceof Map)) {
                    zone.hitEntities = new Map();
                }
                
                const lastHit = zone.hitEntities.get(target) || -1;
                if (zone.tickTimer - lastHit < zone.tickRate) continue;
                
                // Distance check
                const dist = Math.sqrt((target.x - zone.x) ** 2 + (target.y - zone.y) ** 2);
                if (dist < zone.radius) {
                    zone.hitEntities.set(target, zone.tickTimer);
                    const damage = target.takeDamage ? target.takeDamage(zone.damage) : zone.damage;
                    this.combatResults.push({
                        target: target,
                        damage: damage,
                        isCrit: false
                    });
                }
            }
        }
        
        // Update status effect visuals
        for (let i = this.statusEffectVisuals.length - 1; i >= 0; i--) {
            const v = this.statusEffectVisuals[i];
            v.lifetime -= dt;
            if (v.lifetime <= 0) {
                this.statusEffectVisuals.splice(i, 1);
            }
        }
        
        return this.combatResults;
    }
    
    // Add visual for status effect
    addStatusVisual(entity, type) {
        const colors = {
            poison: '#44ff44',
            burn: '#ff6600',
            bleed: '#ff0000',
            freeze: '#66ccff',
            stun: '#ffff00',
            slow: '#8888ff'
        };
        
        this.statusEffectVisuals.push({
            entity: entity,
            type: type,
            color: colors[type] || '#ffffff',
            lifetime: 0.5
        });
        
        // Spawn particles around entity
        this.createParticleBurst(entity.x + 16, entity.y + 16, 6, {
            color: colors[type] || '#ffffff',
            speed: 60,
            lifetime: 0.4,
            size: 4
        });
    }
    
    render(ctx) {
        // Render particles first (behind everything)
        for (const p of this.particles) {
            const alpha = p.lifetime / p.maxLifetime;
            const size = p.shrink ? p.size * alpha : p.size;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Special lightning bolt rendering
            if (p.isLightning) {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 15;
                
                // Draw jagged lightning line
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                
                const dx = p.targetX - p.x;
                const dy = p.targetY - p.y;
                const segments = 6;
                
                for (let i = 1; i <= segments; i++) {
                    const t = i / segments;
                    let x = p.x + dx * t;
                    let y = p.y + dy * t;
                    
                    // Add jagged offset (except for last point)
                    if (i < segments) {
                        const perpX = -dy / Math.sqrt(dx*dx + dy*dy) * 15;
                        const perpY = dx / Math.sqrt(dx*dx + dy*dy) * 15;
                        x += perpX * (Math.random() - 0.5);
                        y += perpY * (Math.random() - 0.5);
                    }
                    
                    ctx.lineTo(x, y);
                }
                
                ctx.stroke();
                ctx.restore();
                continue;
            }
            
            if (p.glow) {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
            }
            
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Render AOE zones
        for (const zone of this.aoeZones) {
            // Skip zones with invalid coordinates to prevent NaN errors
            if (!isFinite(zone.x) || !isFinite(zone.y) || !isFinite(zone.radius)) {
                continue;
            }
            
            ctx.save();
            
            // Special rendering for dark pulse
            if (zone.isDarkPulse) {
                const alpha = zone.lifetime / zone.maxLifetime;
                
                // Outer glow ring
                ctx.shadowColor = '#8844aa';
                ctx.shadowBlur = 20;
                
                // Draw expanding ring
                ctx.strokeStyle = `rgba(102, 34, 170, ${alpha * 0.8})`;
                ctx.lineWidth = zone.ringWidth;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.currentRadius, 0, Math.PI * 2);
                ctx.stroke();
                
                // Inner bright edge
                ctx.strokeStyle = `rgba(170, 100, 200, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.currentRadius - zone.ringWidth / 2, 0, Math.PI * 2);
                ctx.stroke();
                
                // Outer bright edge
                ctx.strokeStyle = `rgba(136, 68, 170, ${alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.currentRadius + zone.ringWidth / 2 - 2, 0, Math.PI * 2);
                ctx.stroke();
                
                // Dark center fade
                if (zone.currentRadius < zone.maxRadius * 0.5) {
                    const centerGradient = ctx.createRadialGradient(
                        zone.x, zone.y, 0,
                        zone.x, zone.y, zone.currentRadius * 0.8
                    );
                    centerGradient.addColorStop(0, `rgba(34, 0, 51, ${alpha * 0.5})`);
                    centerGradient.addColorStop(1, 'rgba(34, 0, 51, 0)');
                    ctx.fillStyle = centerGradient;
                    ctx.beginPath();
                    ctx.arc(zone.x, zone.y, zone.currentRadius * 0.8, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Draw some spirit wisps along the ring
                const numWisps = 8;
                for (let i = 0; i < numWisps; i++) {
                    const wispAngle = (i / numWisps) * Math.PI * 2 + zone.pulseTimer * 0.5;
                    const wispX = zone.x + Math.cos(wispAngle) * zone.currentRadius;
                    const wispY = zone.y + Math.sin(wispAngle) * zone.currentRadius;
                    
                    ctx.fillStyle = `rgba(170, 100, 204, ${alpha * 0.7})`;
                    ctx.beginPath();
                    ctx.arc(wispX, wispY, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.restore();
                continue;
            }
            
            // Special rendering for holy purge
            if (zone.isHolyPurge) {
                const alpha = zone.lifetime / zone.maxLifetime;
                const progress = zone.currentRadius / zone.maxRadius;
                
                // Holy glow
                ctx.shadowColor = '#ffdd44';
                ctx.shadowBlur = 25;
                
                // Outer golden ring
                ctx.strokeStyle = `rgba(255, 238, 136, ${alpha * 0.9})`;
                ctx.lineWidth = zone.ringWidth;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.currentRadius, 0, Math.PI * 2);
                ctx.stroke();
                
                // Inner white edge (holy light)
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.currentRadius - zone.ringWidth / 2, 0, Math.PI * 2);
                ctx.stroke();
                
                // Outer soft golden edge
                ctx.strokeStyle = `rgba(255, 200, 50, ${alpha * 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.currentRadius + zone.ringWidth / 2, 0, Math.PI * 2);
                ctx.stroke();
                
                // Center holy light fill
                if (zone.currentRadius < zone.maxRadius * 0.7) {
                    const centerGradient = ctx.createRadialGradient(
                        zone.x, zone.y, 0,
                        zone.x, zone.y, zone.currentRadius
                    );
                    centerGradient.addColorStop(0, `rgba(255, 255, 220, ${alpha * 0.4})`);
                    centerGradient.addColorStop(0.5, `rgba(255, 240, 180, ${alpha * 0.2})`);
                    centerGradient.addColorStop(1, 'rgba(255, 220, 100, 0)');
                    ctx.fillStyle = centerGradient;
                    ctx.beginPath();
                    ctx.arc(zone.x, zone.y, zone.currentRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Light rays emanating from center
                const numRays = 12;
                for (let i = 0; i < numRays; i++) {
                    const rayAngle = (i / numRays) * Math.PI * 2 + zone.pulseTimer * 0.3;
                    const rayLength = zone.currentRadius * 0.8;
                    const rayX = zone.x + Math.cos(rayAngle) * rayLength;
                    const rayY = zone.y + Math.sin(rayAngle) * rayLength;
                    
                    ctx.strokeStyle = `rgba(255, 255, 200, ${alpha * 0.4})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(zone.x, zone.y);
                    ctx.lineTo(rayX, rayY);
                    ctx.stroke();
                }
                
                // Holy crosses floating in the purge area
                const numCrosses = 6;
                for (let i = 0; i < numCrosses; i++) {
                    const crossAngle = (i / numCrosses) * Math.PI * 2 + zone.pulseTimer * 0.7;
                    const crossDist = zone.currentRadius * 0.6;
                    const crossX = zone.x + Math.cos(crossAngle) * crossDist;
                    const crossY = zone.y + Math.sin(crossAngle) * crossDist;
                    
                    ctx.fillStyle = `rgba(255, 238, 170, ${alpha * 0.8})`;
                    // Vertical bar
                    ctx.fillRect(crossX - 1.5, crossY - 6, 3, 12);
                    // Horizontal bar
                    ctx.fillRect(crossX - 4, crossY - 1.5, 8, 3);
                }
                
                ctx.restore();
                continue;
            }
            
            // Pulsing effect
            const pulse = 1 + Math.sin(zone.pulseTimer) * 0.1;
            const alpha = 0.2 + 0.1 * (zone.lifetime / zone.maxLifetime);
            
            // Outer glow
            const gradient = ctx.createRadialGradient(
                zone.x, zone.y, 0,
                zone.x, zone.y, zone.radius * pulse
            );
            
            let color1, color2;
            if (zone.element === 'fire') {
                color1 = 'rgba(255, 100, 0, ' + alpha + ')';
                color2 = 'rgba(255, 200, 0, 0)';
            } else if (zone.element === 'ice') {
                color1 = 'rgba(100, 200, 255, ' + alpha + ')';
                color2 = 'rgba(200, 230, 255, 0)';
            } else if (zone.element === 'poison') {
                color1 = 'rgba(68, 255, 68, ' + alpha + ')';
                color2 = 'rgba(100, 255, 100, 0)';
            } else if (zone.element === 'lightning') {
                color1 = 'rgba(255, 255, 100, ' + alpha + ')';
                color2 = 'rgba(255, 255, 200, 0)';
            } else {
                color1 = 'rgba(255, 170, 0, ' + alpha + ')';
                color2 = 'rgba(255, 200, 100, 0)';
            }
            
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, zone.radius * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner ring
            ctx.strokeStyle = color1.replace(alpha + '', (alpha * 2) + '');
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, zone.radius * 0.3 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Render projectiles with trails and orbs
        for (const proj of this.projectiles) {
            ctx.save();
            
            // Special rendering for bone spear
            if (proj.isBoneSpear) {
                ctx.translate(proj.x, proj.y);
                ctx.rotate(proj.rotation);
                
                // Bone spear glow
                ctx.shadowColor = '#c8b898';
                ctx.shadowBlur = 8;
                
                // Bone spear body - elongated bone segments
                const segmentLength = proj.size / proj.boneSegments * 2;
                const totalLength = proj.size * 2;
                
                // Dark outline
                ctx.strokeStyle = '#1a1a1a';
                ctx.lineWidth = 8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-totalLength/2, 0);
                ctx.lineTo(totalLength/2, 0);
                ctx.stroke();
                
                // Main bone color
                ctx.strokeStyle = '#e8dcc8';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(-totalLength/2, 0);
                ctx.lineTo(totalLength/2, 0);
                ctx.stroke();
                
                // Bone segments (joints)
                ctx.fillStyle = '#c8b898';
                for (let i = 0; i < proj.boneSegments; i++) {
                    const segX = -totalLength/2 + (i + 0.5) * segmentLength;
                    ctx.beginPath();
                    ctx.arc(segX, 0, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                // Spear tip (sharpened bone)
                ctx.fillStyle = '#f0e8d8';
                ctx.beginPath();
                ctx.moveTo(totalLength/2, 0);
                ctx.lineTo(totalLength/2 + 12, 0);
                ctx.lineTo(totalLength/2, -4);
                ctx.lineTo(totalLength/2, 4);
                ctx.closePath();
                ctx.fill();
                
                // Dark energy wisps around spear
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#6622aa';
                ctx.strokeStyle = 'rgba(102, 34, 170, 0.6)';
                ctx.lineWidth = 2;
                const time = Date.now() / 100;
                for (let i = 0; i < 3; i++) {
                    const phase = time + i * 2;
                    const yOff = Math.sin(phase) * 8;
                    ctx.beginPath();
                    ctx.moveTo(-totalLength/2 + i * 10, yOff);
                    ctx.quadraticCurveTo(0, -yOff, totalLength/2 - i * 5, yOff * 0.5);
                    ctx.stroke();
                }
                
                ctx.restore();
                continue;
            }
            
            // Special rendering for arrows
            if (proj.isArrow) {
                ctx.translate(proj.x, proj.y);
                ctx.rotate(proj.rotation);
                
                // Arrow shaft (wood)
                const shaftLength = proj.size * 2;
                ctx.strokeStyle = '#5c4033';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-shaftLength/2, 0);
                ctx.lineTo(shaftLength/2 - 8, 0);
                ctx.stroke();
                
                // Arrow head (metal/flint)
                ctx.fillStyle = '#8a8a8a';
                ctx.beginPath();
                ctx.moveTo(shaftLength/2 - 8, -4);
                ctx.lineTo(shaftLength/2 + 4, 0);
                ctx.lineTo(shaftLength/2 - 8, 4);
                ctx.closePath();
                ctx.fill();
                
                // Arrow head edge highlight
                ctx.strokeStyle = '#aaaaaa';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(shaftLength/2 - 6, -3);
                ctx.lineTo(shaftLength/2 + 2, 0);
                ctx.stroke();
                
                // Fletching (feathers at back)
                ctx.fillStyle = '#cc3333'; // Red feathers
                // Top feather
                ctx.beginPath();
                ctx.moveTo(-shaftLength/2, 0);
                ctx.lineTo(-shaftLength/2 - 6, -5);
                ctx.lineTo(-shaftLength/2 + 8, 0);
                ctx.closePath();
                ctx.fill();
                // Bottom feather
                ctx.beginPath();
                ctx.moveTo(-shaftLength/2, 0);
                ctx.lineTo(-shaftLength/2 - 6, 5);
                ctx.lineTo(-shaftLength/2 + 8, 0);
                ctx.closePath();
                ctx.fill();
                
                // Feather detail lines
                ctx.strokeStyle = '#aa2222';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(-shaftLength/2 + 2, -2);
                ctx.lineTo(-shaftLength/2 - 4, -4);
                ctx.moveTo(-shaftLength/2 + 2, 2);
                ctx.lineTo(-shaftLength/2 - 4, 4);
                ctx.stroke();
                
                // Motion blur / speed lines
                ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-shaftLength/2 - 10, -2);
                ctx.lineTo(-shaftLength/2 - 20, -2);
                ctx.moveTo(-shaftLength/2 - 8, 0);
                ctx.lineTo(-shaftLength/2 - 25, 0);
                ctx.moveTo(-shaftLength/2 - 10, 2);
                ctx.lineTo(-shaftLength/2 - 18, 2);
                ctx.stroke();
                
                ctx.restore();
                continue;
            }
            
            // Special rendering for musket bullets
            if (proj.isMusketBullet) {
                ctx.translate(proj.x, proj.y);
                ctx.rotate(proj.rotation);
                
                // Motion trail
                ctx.strokeStyle = 'rgba(255, 255, 200, 0.4)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-20, 0);
                ctx.lineTo(-40, 0);
                ctx.stroke();
                
                ctx.strokeStyle = 'rgba(255, 255, 200, 0.2)';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(-30, 0);
                ctx.lineTo(-55, 0);
                ctx.stroke();
                
                // Bullet body (lead ball)
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 10;
                ctx.fillStyle = '#555555';
                ctx.beginPath();
                ctx.arc(0, 0, proj.size / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Highlight on bullet
                ctx.fillStyle = '#888888';
                ctx.beginPath();
                ctx.arc(-1, -1, proj.size / 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Hot glow (freshly fired)
                ctx.shadowColor = '#ff6600';
                ctx.shadowBlur = 8;
                ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, proj.size / 2 + 2, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.restore();
                continue;
            }
            
            // Draw trail
            if (proj.trail && proj.trail.length > 1) {
                for (let i = 0; i < proj.trail.length - 1; i++) {
                    const t = proj.trail[i];
                    const alpha = i / proj.trail.length * 0.5;
                    const size = (proj.width / 2) * (i / proj.trail.length);
                    
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = proj.element === 'fire' ? '#ff6600' :
                                    proj.element === 'ice' ? '#66ccff' :
                                    proj.element === 'lightning' ? '#ffff88' :
                                    proj.element === 'poison' ? '#44ff44' :
                                    proj.element === 'dark' ? '#8844aa' : '#ffaa00';
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            ctx.globalAlpha = 1;
            
            // Glow effect
            ctx.shadowColor = proj.element === 'fire' ? '#ff6600' :
                              proj.element === 'ice' ? '#66ccff' :
                              proj.element === 'lightning' ? '#ffff00' :
                              proj.element === 'poison' ? '#44ff44' :
                              proj.element === 'dark' ? '#aa66cc' : '#ffaa00';
            ctx.shadowBlur = 15;
            
            // Main projectile with pulsing
            const pulse = 1 + Math.sin(proj.pulseTimer) * 0.2;
            ctx.fillStyle = proj.element === 'fire' ? '#ffcc00' :
                            proj.element === 'ice' ? '#aaeeff' :
                            proj.element === 'lightning' ? '#ffffff' :
                            proj.element === 'poison' ? '#88ff88' :
                            proj.element === 'dark' ? '#cc88ff' : '#ffffff';
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, (proj.width / 2) * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw orbiting orbs
            if (proj.orbs) {
                ctx.shadowBlur = 8;
                for (const orb of proj.orbs) {
                    const ox = proj.x + Math.cos(orb.angle) * orb.distance;
                    const oy = proj.y + Math.sin(orb.angle) * orb.distance;
                    ctx.shadowColor = orb.color;
                    ctx.fillStyle = orb.color;
                    ctx.beginPath();
                    ctx.arc(ox, oy, orb.size * pulse, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            ctx.restore();
        }
        
        // Render melee attack arcs
        for (const attack of this.meleeAttacks) {
            ctx.save();
            
            const progress = 1 - (attack.lifetime / attack.maxLifetime);
            const angle = Math.atan2(attack.targetY - attack.y, attack.targetX - attack.x);
            
            // Swing arc - wider sweep for more dramatic effect
            const arcStart = angle - Math.PI / 2 + progress * Math.PI;
            const arcEnd = arcStart + Math.PI / 2;
            
            ctx.globalAlpha = 0.9 * (attack.lifetime / attack.maxLifetime);
            ctx.strokeStyle = attack.color || '#ffffff';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.shadowColor = attack.color || '#ffffff';
            ctx.shadowBlur = 25;
            
            ctx.beginPath();
            ctx.arc(attack.x, attack.y, attack.range * 1.0, arcStart, arcEnd);
            ctx.stroke();
            
            // Inner arc with brighter color
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(attack.x, attack.y, attack.range * 0.7, arcStart, arcEnd);
            ctx.stroke();
            
            // Additional trail effect
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5 * (attack.lifetime / attack.maxLifetime);
            ctx.beginPath();
            ctx.arc(attack.x, attack.y, attack.range * 0.4, arcStart, arcEnd);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // Render status effect visuals on entities
        for (const v of this.statusEffectVisuals) {
            if (!v.entity) continue;
            
            ctx.save();
            ctx.globalAlpha = v.lifetime * 2;
            ctx.strokeStyle = v.color;
            ctx.lineWidth = 2;
            
            const radius = 20 + (1 - v.lifetime) * 10;
            ctx.beginPath();
            ctx.arc(v.entity.x + 16, v.entity.y + 16, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    clear() {
        this.projectiles = [];
        this.meleeAttacks = [];
        this.aoeZones = [];
        this.particles = [];
        this.statusEffectVisuals = [];
    }
}

export default CombatManager;
