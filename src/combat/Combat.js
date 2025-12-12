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
        this.projectiles = [];
        this.meleeAttacks = [];
        this.aoeZones = [];
        this.combatResults = [];
        this.particles = []; // Visual particles
        this.statusEffectVisuals = []; // Status effect animations
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
                color: attackData.element === 'fire' ? '#ff6600' : 
                       attackData.element === 'ice' ? '#66ccff' : '#ffffff'
            });
            
            // Slash particles
            const slashAngle = Math.atan2(attackData.targetY - attackData.y, attackData.targetX - attackData.x);
            for (let i = 0; i < 5; i++) {
                const spread = (i - 2) * 0.3;
                this.addParticle(attackData.x, attackData.y, {
                    vx: Math.cos(slashAngle + spread) * 200,
                    vy: Math.sin(slashAngle + spread) * 200,
                    color: '#ffffff',
                    size: 3,
                    lifetime: 0.15
                });
            }
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
            }
            
            this.projectiles.push(projectile);
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
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.lifetime -= dt;
            proj.pulseTimer = (proj.pulseTimer || 0) + dt * 10;
            
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
            
            // Check collisions
            for (const target of targets) {
                if (target === proj.owner) continue;
                if (!target.health || target.health <= 0) continue;
                
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
                               proj.element === 'poison' ? '#44ff44' : '#ffaa00',
                        speed: 150,
                        lifetime: 0.4,
                        size: 5
                    });
                    
                    this.projectiles.splice(i, 1);
                    break;
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
            ctx.save();
            
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
            
            // Swing arc
            const arcStart = angle - Math.PI / 3 + progress * Math.PI / 1.5;
            const arcEnd = arcStart + Math.PI / 3;
            
            ctx.globalAlpha = 0.6 * (attack.lifetime / attack.maxLifetime);
            ctx.strokeStyle = attack.color || '#ffffff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.shadowColor = attack.color || '#ffffff';
            ctx.shadowBlur = 10;
            
            ctx.beginPath();
            ctx.arc(attack.x, attack.y, attack.range * 0.8, arcStart, arcEnd);
            ctx.stroke();
            
            // Inner arc
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(attack.x, attack.y, attack.range * 0.5, arcStart, arcEnd);
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
