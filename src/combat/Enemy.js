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
        // Bosses have much larger melee range
        this.attackRange = isBoss ? (config.attackRange || 80) : (config.attackRange || 40);
        this.aggroRange = config.aggroRange || 200;
        this.attackCooldown = isBoss ? (config.attackCooldown || 0.6) : (config.attackCooldown || 1);
        
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
        
        // Boss dash chain system
        this.bossDashTrail = []; // For crackling afterimage effect
        this.bossDashChainCount = 0;
        this.bossDashChainTimer = 0;
        this.isBossDashing = false;
        
        // Boss element based on type
        this.bossElement = this.getBossElement();
        
        // Boss minion spawning system
        this.minionSpawnTimer = 0;
        this.minionSpawnInterval = 8; // Spawn minions every 8 seconds
        this.maxMinions = 4; // Max active minions
        this.activeMinions = [];
        
        // Lightning strike zones for Pharaoh
        this.lightningZones = [];
        this.lightningStrikeDelay = 0.5; // 0.5s warning before strike
        
        // Boss phase/healing system - triggers at each third of health
        this.bossPhase = 1;
        this.phaseThresholds = [0.66, 0.33]; // Phases trigger at 66% and 33%
        this.phasesTriggered = [];
        this.isHealingPhase = false;
        this.healingMinions = [];
        this.healRate = 0; // Health per second while minions alive
        
        // Telegraph warning system
        this.showTelegraph = false;
        this.telegraphRadius = 0;
    }
    
    getBossElement() {
        // Assign element based on boss type
        if (this.enemyType === 'pharaoh' || this.name === 'Pharaoh') return 'lightning';
        if (this.enemyType === 'cerberus' || this.name === 'Cerberus') return 'fire';
        if (this.enemyType === 'queenSpider' || this.name === 'Spider Queen') return 'poison';
        if (this.enemyType === 'archangel' || this.name === 'Archangel') return 'holy';
        if (this.enemyType === 'masterAI' || this.name === 'Master A.I.') return 'electric';
        if (this.enemyType === 'ancientGolem' || this.name === 'Ancient Golem') return 'earth';
        return 'arcane';
    }
    
    update(dt, player = null, dungeon = null) {
        super.update(dt);
        
        // Store previous position for collision
        this.prevX = this.x;
        this.prevY = this.y;
        
        // Store references for AI
        if (player) this.target = player;
        this.dungeon = dungeon;
        
        // Update boss dash animation
        if (this.isBoss && this.isDashing) {
            this.updateBossDash(dt);
            return; // Skip other updates while dashing
        }
        
        // Update position based on velocity
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
        
        // Safety check: prevent NaN positions
        if (!isFinite(this.x) || !isFinite(this.y)) {
            this.x = this.prevX || 0;
            this.y = this.prevY || 0;
            this.velocity.x = 0;
            this.velocity.y = 0;
        }
        
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
        // Initialize mob dash cooldown
        if (this.mobDashCooldown === undefined) {
            this.mobDashCooldown = 0;
        }
        if (this.mobDashCooldown > 0) this.mobDashCooldown -= dt;
        
        // Find target if none - use line of sight check
        if (!this.target || !this.target.active) {
            this.findTargetWithLineOfSight();
        }
        
        // Bosses ALWAYS need a target - if we have one, use it
        if (this.target) {
            const dist = this.distanceTo(this.target);
            
            // Boss-specific dynamic AI
            if (this.isBoss) {
                this.updateBossAI(dt, dist);
                return;
            }
            
            // Check if target is in range and we have line of sight
            if (dist <= this.aggroRange && this.hasLineOfSight(this.target)) {
                this.state = 'chase';
                
                if (dist <= this.attackRange) {
                    this.state = 'attack';
                    this.attack();
                } else {
                    // Occasionally dash towards player (mobs can dash too!)
                    if (this.mobDashCooldown <= 0 && dist > 100 && Math.random() < 0.02) {
                        this.doMobDash();
                    } else {
                        this.moveTowards(this.target, dt);
                    }
                }
            } else {
                this.target = null;
                this.state = 'idle';
            }
        } else {
            // Wander behavior - more active movement
            this.wander(dt);
        }
    }
    
    // Line of sight check using dungeon tiles
    hasLineOfSight(target) {
        if (!this.dungeon || !target) return true; // Default to true if no dungeon
        
        const steps = Math.max(Math.abs(target.x - this.x), Math.abs(target.y - this.y)) / 16;
        const dx = (target.x - this.x) / steps;
        const dy = (target.y - this.y) / steps;
        
        for (let i = 1; i < steps; i++) {
            const checkX = Math.floor((this.x + dx * i) / 32);
            const checkY = Math.floor((this.y + dy * i) / 32);
            const tile = this.dungeon.getTile ? this.dungeon.getTile(checkX, checkY) : 1;
            if (tile === 2 || tile === 0) { // WALL or EMPTY
                return false;
            }
        }
        return true;
    }
    
    // Find target with line of sight requirement
    findTargetWithLineOfSight() {
        if (!this.game || !this.game.player) {
            this.findTarget();
            return;
        }
        
        const player = this.game.player;
        const dist = this.distanceTo(player);
        
        // Check if player is within detection range AND we have line of sight
        if (dist <= this.aggroRange && this.hasLineOfSight(player)) {
            this.target = player;
        }
    }
    
    // Mob dash - quick lunge towards target
    doMobDash() {
        if (!this.target) return;
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const dashDist = 60 + Math.random() * 40;
        
        this.x += Math.cos(angle) * dashDist;
        this.y += Math.sin(angle) * dashDist;
        this.mobDashCooldown = 3 + Math.random() * 2; // 3-5 second cooldown
    }
    
    updateBossAI(dt, dist) {
        // Bosses are always bloodlusted - never idle
        this.state = 'chase';
        
        // Initialize boss phase tracking
        if (!this.bossPhase) {
            this.bossPhase = 1;
            this.bossPatternTimer = 0;
            this.currentPattern = null;
            this.patternStep = 0;
            this.dodgeTimer = 0;
            this.strafeDirection = 1;
            this.chargeTarget = null;
            this.signatureCooldown = 0;
            this.bossStage = 1; // Stage system: 1, 2, 3
            this.idleTimer = 0; // Track time without action
            this.lastActionTime = 0;
            this.patternTimeout = 0; // Timeout to prevent stuck patterns
            this.phasesTriggered = [];
            this.unlockedPhases = [1]; // Track unlocked phases for progressive moves
            this.patternHistory = []; // Track last 5 patterns to avoid repetition
            this.combatMode = 'balanced'; // 'melee', 'ranged', or 'balanced'
            this.combatModeTimer = 0; // Time until mode switch
            this.dashCooldown = 0; // Cooldown for dash attacks/dodges
        }
        
        // Always ensure trackingOrbs array exists
        if (!this.trackingOrbs) {
            this.trackingOrbs = [];
        }
        
        // Determine phase based on health
        const healthPercent = this.health / this.maxHealth;
        
        // Check for phase threshold crossings (triggers mob spawn + heal mechanic)
        if (healthPercent <= 0.66 && !this.phasesTriggered.includes(0.66)) {
            this.phasesTriggered.push(0.66);
            this.triggerPhaseTransition(2);
        }
        if (healthPercent <= 0.33 && !this.phasesTriggered.includes(0.33)) {
            this.phasesTriggered.push(0.33);
            this.triggerPhaseTransition(3);
        }
        
        // Handle healing phase
        if (this.isHealingPhase) {
            this.updateHealingPhase(dt);
        }
        
        if (healthPercent <= 0.25 && this.bossStage < 3) {
            this.bossStage = 3;
            this.bossPhase = 3;
            this.bossPatternTimer = 0;
            // Enrage - faster attacks
            this.attackCooldown *= 0.7;
            this.minionSpawnInterval = 5; // Spawn minions faster when enraged
        } else if (healthPercent <= 0.5 && this.bossStage < 2) {
            this.bossStage = 2;
            this.bossPhase = 2;
            this.bossPatternTimer = 0;
            this.minionSpawnInterval = 6;
        } else if (healthPercent <= 0.75 && this.bossPhase < 2) {
            this.bossPhase = 2;
            this.bossPatternTimer = 0;
        }
        
        // Update pattern timer
        this.bossPatternTimer += dt;
        this.dodgeTimer -= dt;
        this.signatureCooldown -= dt;
        this.idleTimer += dt;
        this.patternTimeout += dt;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        
        // Combat mode switching - randomly change fighting style
        this.combatModeTimer -= dt;
        if (this.combatModeTimer <= 0) {
            const modes = ['melee', 'ranged', 'balanced'];
            this.combatMode = modes[Math.floor(Math.random() * modes.length)];
            this.combatModeTimer = 3 + Math.random() * 4; // Switch every 3-7 seconds
        }
        
        // ANTI-IDLE: Force action if boss hasn't done anything in 0.5 seconds
        if (this.idleTimer > 0.5 && !this.currentPattern) {
            this.selectBossPattern();
            this.idleTimer = 0;
        }
        
        // PATTERN TIMEOUT: If a pattern is stuck for more than 3 seconds, end it
        if (this.currentPattern && this.patternTimeout > 3.0) {
            this.endBossPattern();
            this.patternTimeout = 0;
        }
        
        // Update lightning zones for Pharaoh
        this.updateLightningZones(dt);
        
        // Update minion spawning
        this.updateMinionSpawning(dt);
        
        // Update tracking orbs
        this.updateTrackingOrbs(dt);
        
        // Wall collision for bosses - don't let them phase through walls
        // FLOOR=1, WALL=2, VOID/EMPTY=0
        if (this.dungeon) {
            const tileX = Math.floor(this.x / 32);
            const tileY = Math.floor(this.y / 32);
            const tile = this.dungeon.getTile(tileX, tileY);
            if (tile === 2 || tile === 0) { // WALL or EMPTY
                // Push back to previous position
                this.x = this.prevX || this.x;
                this.y = this.prevY || this.y;
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
        }
        
        // Boss patterns based on phase - ALWAYS attacking
        if (!this.currentPattern && this.attackTimer <= 0) {
            // 90% chance to select a pattern - bosses should ALWAYS be attacking
            this.selectBossPattern();
        }
        
        // Execute current pattern
        if (this.currentPattern) {
            this.executeBossPattern(dt, dist);
            return;
        }
        
        // Default boss behavior based on combat mode
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        
        // Always face the player
        this.facing.x = Math.cos(angle);
        this.facing.y = Math.sin(angle);
        
        // Determine preferred range based on combat mode
        const preferMelee = this.combatMode === 'melee' || (this.combatMode === 'balanced' && Math.random() < 0.5);
        const preferRanged = this.combatMode === 'ranged';
        
        if (dist > 300) {
            // Far from player - close gap aggressively
            if (dist > 500 && Math.random() < 0.02) {
                this.doBossTeleport();
            } else if (this.dashCooldown <= 0 && Math.random() < 0.15) {
                // Dash attack to close distance - more frequent
                this.doBossDashAttack();
            } else {
                // Sprint towards player
                this.velocity.x = Math.cos(angle) * this.maxSpeed * 1.8;
                this.velocity.y = Math.sin(angle) * this.maxSpeed * 1.8;
            }
            
            // Ranged mode fires while moving
            if (preferRanged && this.attackTimer <= 0) {
                this.doRangedAttack();
            }
        } else if (dist > 120) {
            // Medium range - behavior depends on combat mode
            if (preferMelee) {
                // Close in aggressively with dash attacks
                if (this.dashCooldown <= 0 && Math.random() < 0.15) {
                    this.doBossDashAttack();
                } else {
                    const approachAngle = angle + (Math.PI / 6) * this.strafeDirection;
                    this.velocity.x = Math.cos(approachAngle) * this.maxSpeed * 1.4;
                    this.velocity.y = Math.sin(approachAngle) * this.maxSpeed * 1.4;
                }
            } else {
                // Ranged - strafe and fire
                const strafeAngle = angle + (Math.PI / 2) * this.strafeDirection;
                this.velocity.x = Math.cos(strafeAngle) * this.maxSpeed * 1.0;
                this.velocity.y = Math.sin(strafeAngle) * this.maxSpeed * 1.0;
                
                if (this.attackTimer <= 0) {
                    this.doRangedAttack();
                }
            }
            
            // Change strafe direction occasionally
            if (Math.random() < 0.03) {
                this.strafeDirection *= -1;
            }
        } else if (dist > 50) {
            // Close-medium range - mixed combat
            if (Math.random() < 0.04) {
                this.strafeDirection *= -1;
            }
            
            const strafeAngle = angle + (Math.PI / 3) * this.strafeDirection;
            this.velocity.x = Math.cos(strafeAngle) * this.maxSpeed * 0.8;
            this.velocity.y = Math.sin(strafeAngle) * this.maxSpeed * 0.8;
            
            if (this.attackTimer <= 0) {
                if (preferMelee || dist < 80) {
                    this.attack();
                } else {
                    this.doRangedAttack();
                }
            }
            
            // Dash dodge when player attacks
            if (this.dashCooldown <= 0 && Math.random() < 0.06) {
                this.doBossDashDodge();
            }
        } else {
            // Very close - melee combat with dash dodges
            if (this.dashCooldown <= 0 && Math.random() < 0.12) {
                // Dash through player for repositioning - more stylish movement
                this.doBossDashThrough();
            } else if (this.dodgeTimer <= 0 && Math.random() < 0.03) {
                this.doBossDashDodge();
            } else {
                // Circle around player
                const circleAngle = angle + (Math.PI / 2) * this.strafeDirection;
                this.velocity.x = Math.cos(circleAngle) * this.maxSpeed * 0.6;
                this.velocity.y = Math.sin(circleAngle) * this.maxSpeed * 0.6;
                
                if (this.attackTimer <= 0) {
                    this.attack();
                }
            }
        }
    }
    
    doBossDash() {
        if (!this.target) return;
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const dashDist = 120;
        this.x += Math.cos(angle) * dashDist;
        this.y += Math.sin(angle) * dashDist;
        this.dashCooldown = 0.8;
    }
    
    // Dash attack - dash to player and attack on arrival
    doBossDashAttack() {
        if (!this.target) return;
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const dist = this.distanceTo(this.target);
        const dashDist = Math.min(dist - 30, 200);
        
        this.x += Math.cos(angle) * dashDist;
        this.y += Math.sin(angle) * dashDist;
        this.dashCooldown = 1.2;
        this.playDashSound = true;
        
        // Attack immediately after dash with knockback
        this.attackTimer = 0;
        this.pendingAttack = {
            type: 'melee',
            damage: this.damage * 1.2,
            x: this.x,
            y: this.y,
            targetX: this.target.x,
            targetY: this.target.y,
            range: this.attackRange || 60,
            knockback: 150,
            owner: this
        };
    }
    
    // Dash dodge - dash away from player
    doBossDashDodge() {
        if (!this.target) return;
        const awayAngle = Math.atan2(this.y - this.target.y, this.x - this.target.x);
        const sideAngle = awayAngle + (Math.random() < 0.5 ? Math.PI / 3 : -Math.PI / 3);
        const dashDist = 100 + Math.random() * 50;
        
        this.x += Math.cos(sideAngle) * dashDist;
        this.y += Math.sin(sideAngle) * dashDist;
        this.dashCooldown = 1.0;
        this.dodgeTimer = 1.5;
        this.playDashSound = true;
        this.strafeDirection *= -1;
    }
    
    // Dash through player for repositioning
    doBossDashThrough() {
        if (!this.target) return;
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const dashDist = 180; // Dash past the player
        
        this.x += Math.cos(angle) * dashDist;
        this.y += Math.sin(angle) * dashDist;
        this.dashCooldown = 1.5;
        this.playDashSound = true;
        this.strafeDirection *= -1;
        this.dodgeTimer = 0.5;
    }
    
    // Replaced teleport with dash - now has animation and afterimages
    doBossTeleport() {
        if (!this.target) return;
        
        // Calculate dash destination near player
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 60;
        const targetX = this.target.x + Math.cos(angle) * dist;
        const targetY = this.target.y + Math.sin(angle) * dist;
        
        // Use dash instead of instant teleport
        this.doBossDashTo(targetX, targetY, 800, true); // Fast dash with afterimages
        this.dodgeTimer = 1.0;
    }
    
    // Boss dash to specific position with afterimages
    doBossDashTo(targetX, targetY, speed = 600, createAfterimages = true) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) return;
        
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        // Store start position for afterimages
        this.dashStartX = this.x;
        this.dashStartY = this.y;
        this.dashTargetX = targetX;
        this.dashTargetY = targetY;
        this.dashSpeed = speed;
        this.dashProgress = 0;
        this.dashDuration = dist / speed;
        this.isDashing = true;
        this.createDashAfterimages = createAfterimages;
        this.dashAfterimageTimer = 0;
        
        // Create initial afterimage in bossDashTrail (the rendered trail)
        if (createAfterimages) {
            this.bossDashTrail.push({
                x: this.x,
                y: this.y,
                alpha: 0.8,
                time: 0.4,
                color: this.bossElement ? this.getElementColor(this.bossElement) : (this.color || '#ff4444')
            });
        }
    }
    
    // Update boss dash (call in update method)
    updateBossDash(dt) {
        if (!this.isDashing) return false;
        
        this.dashProgress += dt;
        const t = Math.min(1, this.dashProgress / this.dashDuration);
        
        // Smooth easing
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        // Interpolate position
        this.x = this.dashStartX + (this.dashTargetX - this.dashStartX) * easeT;
        this.y = this.dashStartY + (this.dashTargetY - this.dashStartY) * easeT;
        
        // Create afterimages during dash using bossDashTrail
        if (this.createDashAfterimages) {
            this.dashAfterimageTimer += dt;
            if (this.dashAfterimageTimer >= 0.03) {
                this.dashAfterimageTimer = 0;
                this.bossDashTrail.push({
                    x: this.x,
                    y: this.y,
                    alpha: 0.6,
                    time: 0.25,
                    color: this.bossElement ? this.getElementColor(this.bossElement) : (this.color || '#ff4444')
                });
            }
        }
        
        // Check if dash complete
        if (t >= 1) {
            this.isDashing = false;
            this.x = this.dashTargetX;
            this.y = this.dashTargetY;
            return true; // Dash completed
        }
        
        return false; // Still dashing
    }
    
    // Get element color for boss
    getElementColor(element) {
        const colors = {
            fire: '#ff6600',
            ice: '#66ccff',
            lightning: '#ffff00',
            poison: '#44ff44',
            holy: '#ffffaa',
            dark: '#aa66cc',
            earth: '#8b7355',
            electric: '#88ffff',
            arcane: '#aa88ff',
            sand: '#daa520',
            physical: '#ffffff'
        };
        return colors[element] || '#ff4444';
    }
    
    doRangedAttack() {
        if (!this.target || this.attackTimer > 0) return;
        
        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.pendingAttack = {
            type: 'projectile',
            damage: this.damage * 0.8,
            x: this.x,
            y: this.y,
            targetX: this.target.x,
            targetY: this.target.y,
            angle: angle,
            speed: 350,
            element: 'arcane',
            range: 400
        };
        this.attackTimer = this.attackCooldown * 0.8;
    }
    
    selectBossPattern() {
        // Reset idle timer when selecting a pattern
        this.idleTimer = 0;
        this.patternTimeout = 0;
        
        // Initialize pattern history if needed
        if (!this.patternHistory) this.patternHistory = [];
        
        // Check for signature move first (high priority, cooldown-based)
        if (this.signatureCooldown <= 0 && Math.random() < 0.4) {
            const signatureMove = this.getSignatureMove();
            if (signatureMove && !this.patternHistory.includes(signatureMove)) {
                this.currentPattern = signatureMove;
                this.patternStep = 0;
                this.patternData = {};
                this.signatureCooldown = 10;
                this.addToPatternHistory(signatureMove);
                return;
            }
        }
        
        // Boss-specific unique patterns
        const bossSpecificPatterns = this.getBossSpecificPatterns();
        
        // Base projectile patterns - many varieties
        const projectilePatterns = [
            'circleAttack',
            'projectileBarrage',
            'spiralProjectiles',
            'multiProjectile',
            'crossPattern',
            'waveProjectiles',
            'scatterShot',
            'ricochetBurst',
            'arcingVolley',
            'seekerMissiles',
            // New creative spawn patterns
            'wallBarrage',
            'ceilingRain',
            'floorEruption',
            'cornerTrap',
            'zigzagVolley',
            'sineWave',
            'snakePattern',
            'arrowRain'
        ];
        
        // Melee/dash patterns
        const meleePatterns = [
            'chargeAttack',
            'meleeDashStrike',
            'groundSlam',
            'teleportStrike',
            'rageDash',
            'spinSlash',
            'circleDashStrike'
        ];
        
        // Special patterns
        const specialPatterns = [
            'trackingOrbCircle',
            'vortexPull',
            'laserSweep',
            // New geometric/creative patterns
            'pentagramStrike',
            'hexagonalGrid',
            'spiralGalaxy',
            'orbitalBombardment',
            'diamondCage',
            'starBurst',
            'clockworkSpiral',
            ...bossSpecificPatterns
        ];
        
        // Build pattern pool based on phase
        let patterns = [...projectilePatterns.slice(0, 5), ...meleePatterns.slice(0, 4), ...specialPatterns.slice(0, 3)];
        
        // Ring collapse pattern - available from the start (signature boss move)
        patterns.push('ringCollapse');
        
        // Phase 2 unlocks more
        if (this.bossPhase >= 2) {
            patterns.push(...projectilePatterns.slice(5));
            patterns.push('bulletHellSpiral', 'bouncingOrbs', 'shadowClones');
            patterns.push('homingBarrage', 'novaBlast', 'chainLightning');
            // New phase 2 patterns
            patterns.push('convergeExpand', 'mirrorImage', 'pulseWave', 'triangleFormation');
            patterns.push('crossfireTrap', 'encircle', 'laserFence');
        }
        
        // Phase 3 unlocks most dangerous
        if (this.bossPhase >= 3) {
            patterns.push(...meleePatterns.slice(4));
            patterns.push('ultimateBlast', 'omniDirectional', 'trackingSwarm', 'deathRay', 'meteorStorm');
            patterns.push('bulletHellFlower', 'homingMissileBarrage', 'voidRift', 'annihilationBeam');
            // New phase 3 patterns - most dangerous
            patterns.push('pillarsOfDoom', 'chaosOrbs', 'galaxyArms', 'pinwheel');
            patterns.push('checkerboard', 'crescentMoon', 'vortexSuck');
        }
        
        // Filter out recently used patterns (no repeats from last 5)
        const availablePatterns = patterns.filter(p => !this.patternHistory.includes(p));
        
        // If all patterns were recently used, allow any but still avoid last one
        const finalPool = availablePatterns.length > 0 ? availablePatterns : 
            patterns.filter(p => p !== this.patternHistory[this.patternHistory.length - 1]);
        
        // Select random pattern from available pool
        this.currentPattern = finalPool[Math.floor(Math.random() * finalPool.length)] || patterns[0];
        this.patternStep = 0;
        this.patternData = {};
        this.addToPatternHistory(this.currentPattern);
    }
    
    // Track pattern history to avoid repetition
    addToPatternHistory(pattern) {
        if (!this.patternHistory) this.patternHistory = [];
        this.patternHistory.push(pattern);
        // Keep only last 5 patterns
        if (this.patternHistory.length > 5) {
            this.patternHistory.shift();
        }
    }
    
    // Get boss-specific unique patterns
    getBossSpecificPatterns() {
        // Original bosses - each with 10+ unique patterns
        if (this.enemyType === 'skeletonKing' || this.name === 'Skeleton King') {
            return ['boneStorm', 'graveRise', 'royalExecution', 'boneWall', 'skeletonRush', 'curseOfDeath',
                    'pentagramStrike', 'encircle', 'crescentMoon', 'chaosOrbs'];
        }
        if (this.enemyType === 'dragonLord' || this.name === 'Dragon Lord') {
            return ['fireBreathSweep', 'wingBlast', 'dragonFury', 'meteorRain', 'flameVortex', 'dragonRoar',
                    'ceilingRain', 'pillarsOfDoom', 'arrowRain', 'galaxyArms'];
        }
        if (this.enemyType === 'lichKing' || this.name === 'Lich King') {
            return ['soulDrain', 'frostTomb', 'deathCoil', 'iceSpikes', 'phantomGrasp', 'necromanticRift',
                    'vortexSuck', 'spiralGalaxy', 'hexagonalGrid', 'convergeExpand'];
        }
        // Themed bosses - each with 10+ unique patterns
        if (this.enemyType === 'pharaoh' || this.name === 'Pharaoh') {
            return ['lightningChain', 'sandstormLightning', 'pyramidStrike', 'scarabSwarm', 'sandTornado', 'curseOfTheSun',
                    'cornerTrap', 'diamondCage', 'clockworkSpiral', 'starBurst'];
        }
        if (this.enemyType === 'cerberus' || this.name === 'Cerberus') {
            return ['hellfireBreath', 'tripleChomp', 'infernoCircle', 'spiralBounce', 'splittingFlame', 'fireWave', 'hellShockwave', 'lavaPools',
                    'wallBarrage', 'crossfireTrap', 'floorEruption', 'pinwheel'];
        }
        if (this.enemyType === 'queenSpider' || this.name === 'Spider Queen') {
            return ['webTrap', 'venomSpray', 'spiderSwarm', 'cocoonBomb', 'silkLine', 'toxicBurst',
                    'snakePattern', 'zigzagVolley', 'encircle', 'triangleFormation'];
        }
        if (this.enemyType === 'archangel' || this.name === 'Archangel') {
            return ['holyRain', 'divineBeam', 'purifyingLight', 'lightPillars', 'orbGridStrike', 'celestialCross', 'angelicDescent', 'radiantNova',
                    'mirrorImage', 'pulseWave', 'sineWave', 'checkerboard'];
        }
        if (this.enemyType === 'masterAI' || this.name === 'Master A.I.') {
            return ['laserGrid', 'droneSwarm', 'systemHack', 'dataStorm', 'firewall', 'virusInfection',
                    'laserFence', 'orbitalBombardment', 'hexagonalGrid', 'crossfireTrap'];
        }
        if (this.enemyType === 'ancientGolem' || this.name === 'Ancient Golem') {
            return ['earthquakeWave', 'boulderToss', 'stoneSkin', 'crystalSpikes', 'rockyBarrier', 'seismicStomp',
                    'floorEruption', 'wallBarrage', 'pillarsOfDoom', 'ceilingRain'];
        }
        return [];
    }
    
    // Get signature move based on boss type/theme
    getSignatureMove() {
        // Original bosses
        if (this.enemyType === 'skeletonKing' || this.name === 'Skeleton King') {
            return 'signatureSkeletonKing';
        }
        if (this.enemyType === 'dragonLord' || this.name === 'Dragon Lord') {
            return 'signatureDragonLord';
        }
        if (this.enemyType === 'lichKing' || this.name === 'Lich King') {
            return 'signatureLichKing';
        }
        // Pharaoh - Giant Ankh Paralysis
        if (this.enemyType === 'pharaoh' || this.name === 'Pharaoh') {
            return 'signatureAnkh';
        }
        // Cerberus (Hades) - Triple Hellfire Breath
        if (this.enemyType === 'cerberus' || this.name === 'Cerberus') {
            return 'signatureCerberus';
        }
        // Spider Queen (Jungle) - Web Prison
        if (this.enemyType === 'queenSpider' || this.name === 'Spider Queen') {
            return 'signatureWebPrison';
        }
        // Archangel (Light) - Divine Judgment
        if (this.enemyType === 'archangel' || this.name === 'Archangel') {
            return 'signatureDivineJudgment';
        }
        // Master AI (Cyber) - System Overload
        if (this.enemyType === 'masterAI' || this.name === 'Master A.I.') {
            return 'signatureSystemOverload';
        }
        // Ancient Golem (Stone) - Seismic Slam
        if (this.enemyType === 'ancientGolem' || this.name === 'Ancient Golem') {
            return 'signatureSeismicSlam';
        }
        return null;
    }
    
    // Update tracking orbs
    updateTrackingOrbs(dt) {
        for (let i = this.trackingOrbs.length - 1; i >= 0; i--) {
            const orb = this.trackingOrbs[i];
            orb.timer -= dt;
            
            if (orb.phase === 'tracking' && this.target) {
                // Track player
                const dx = this.target.x - orb.x;
                const dy = this.target.y - orb.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > orb.lockRadius) {
                    // Still tracking
                    orb.x += (dx / dist) * orb.speed * dt;
                    orb.y += (dy / dist) * orb.speed * dt;
                } else {
                    // Lock direction and stop tracking
                    orb.phase = 'locked';
                    orb.vx = (dx / dist) * orb.speed * 1.5;
                    orb.vy = (dy / dist) * orb.speed * 1.5;
                }
            } else if (orb.phase === 'locked') {
                // Move in locked direction
                orb.x += orb.vx * dt;
                orb.y += orb.vy * dt;
            }
            
            // Check collision with player
            if (this.target) {
                const dist = Math.sqrt((orb.x - this.target.x) ** 2 + (orb.y - this.target.y) ** 2);
                if (dist < 20) {
                    // Hit player
                    this.pendingAttack = {
                        type: 'direct',
                        damage: orb.damage,
                        target: this.target,
                        owner: this
                    };
                    this.trackingOrbs.splice(i, 1);
                    continue;
                }
            }
            
            // Remove if expired
            if (orb.timer <= 0) {
                this.trackingOrbs.splice(i, 1);
            }
        }
    }
    
    // Lightning zone system for Pharaoh
    updateLightningZones(dt) {
        if (!this.lightningZones) this.lightningZones = [];
        
        for (let i = this.lightningZones.length - 1; i >= 0; i--) {
            const zone = this.lightningZones[i];
            zone.timer -= dt;
            
            if (zone.timer <= 0 && !zone.struck) {
                // STRIKE! Deal damage if player is still in zone
                zone.struck = true;
                zone.strikeTime = 0.3; // Visual duration of strike
                
                if (this.target) {
                    const dist = Math.sqrt((zone.x - this.target.x) ** 2 + (zone.y - this.target.y) ** 2);
                    if (dist < zone.radius) {
                        this.pendingAttack = {
                            type: 'direct',
                            damage: this.damage * 1.5,
                            target: this.target,
                            element: 'lightning',
                            owner: this
                        };
                    }
                }
            }
            
            if (zone.struck) {
                zone.strikeTime -= dt;
                if (zone.strikeTime <= 0) {
                    this.lightningZones.splice(i, 1);
                }
            }
        }
    }
    
    // Spawn a lightning warning zone at target location
    spawnLightningZone(x, y, delay = 0.5, radius = 60) {
        if (!this.lightningZones) this.lightningZones = [];
        this.lightningZones.push({
            x: x,
            y: y,
            radius: radius,
            timer: delay,
            struck: false
        });
    }
    
    // Minion spawning system
    updateMinionSpawning(dt) {
        if (!this.isBoss) return;
        
        this.minionSpawnTimer += dt;
        
        // Clean up dead minions
        this.activeMinions = this.activeMinions.filter(m => m && m.active && m.health > 0);
        
        // Spawn minions periodically
        if (this.minionSpawnTimer >= this.minionSpawnInterval && this.activeMinions.length < this.maxMinions) {
            this.minionSpawnTimer = 0;
            this.shouldSpawnMinion = true; // Flag for Game.js to handle
        }
    }
    
    // Get minion type based on boss
    getMinionType() {
        if (this.enemyType === 'pharaoh' || this.name === 'Pharaoh') return 'mummy';
        if (this.enemyType === 'cerberus' || this.name === 'Cerberus') return 'hellhound';
        if (this.enemyType === 'queenSpider' || this.name === 'Spider Queen') return 'venomSpider';
        if (this.enemyType === 'archangel' || this.name === 'Archangel') return 'pureSpirit';
        if (this.enemyType === 'masterAI' || this.name === 'Master A.I.') return 'securityDrone';
        if (this.enemyType === 'ancientGolem' || this.name === 'Ancient Golem') return 'golem';
        return 'skeleton';
    }
    
    // Trigger phase transition with mob spawn and heal
    triggerPhaseTransition(newPhase) {
        this.bossPhase = newPhase;
        this.bossStage = newPhase; // Sync stage with phase
        this.isHealingPhase = true;
        this.healingMinions = [];
        this.healRate = this.maxHealth * 0.02; // 2% max health per second while minions alive
        
        // Track unlocked phases for progressive move unlocking
        if (!this.unlockedPhases) {
            this.unlockedPhases = [1]; // Phase 1 always unlocked
        }
        if (!this.unlockedPhases.includes(newPhase)) {
            this.unlockedPhases.push(newPhase);
        }
        
        // Heal to full health on phase transition
        this.health = this.maxHealth;
        
        // Spawn 10 minions around the boss
        this.pendingMobSpawn = {
            count: 10,
            type: this.getMinionType(),
            phase: newPhase
        };
        
        // Visual and audio feedback
        this.phaseTransitionTimer = 2.0; // Invulnerable for 2 seconds during transition
        this.invulnerable = true;
        this.invulnerabilityTime = 2.0;
    }
    
    // Update healing phase - boss heals while minions are alive
    updateHealingPhase(dt) {
        if (!this.isHealingPhase) return;
        
        // Check if healing minions are still alive
        this.healingMinions = this.healingMinions.filter(m => m && m.active && m.health > 0);
        
        // Heal while minions alive
        if (this.healingMinions.length > 0) {
            const healAmount = this.healRate * dt * (this.healingMinions.length / 10);
            this.health = Math.min(this.maxHealth, this.health + healAmount);
            
            // Visual effect - green healing particles
            this.showHealingEffect = true;
        } else {
            // All minions dead - stop healing
            this.isHealingPhase = false;
            this.showHealingEffect = false;
        }
    }
    
    // Register a healing minion
    addHealingMinion(minion) {
        if (this.isHealingPhase) {
            this.healingMinions.push(minion);
        }
    }

    executeBossPattern(dt, dist) {
        // Safety check - need a valid target for most patterns
        if (!this.target) {
            this.endBossPattern();
            return;
        }
        
        switch (this.currentPattern) {
            case 'circleAttack':
                // Move in a circle while shooting projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = (this.patternData.angle || 0) + dt * 3; // Faster circle
                
                const circleRadius = 150;
                const targetX = this.target.x + Math.cos(this.patternData.angle) * circleRadius;
                const targetY = this.target.y + Math.sin(this.patternData.angle) * circleRadius;
                
                this.velocity.x = (targetX - this.x) * 3; // Faster movement
                this.velocity.y = (targetY - this.y) * 3;
                
                // Fire projectile every 0.15 seconds (much faster)
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    // Fire 2 projectiles - one at player, one spread
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.5,
                        x: this.x,
                        y: this.y,
                        targetX: this.target.x,
                        targetY: this.target.y,
                        speed: 400, // Faster projectiles
                        owner: this
                    };
                }
                
                // End pattern after one full circle
                if (this.patternData.angle > Math.PI * 2) {
                    this.endBossPattern();
                }
                break;
                
            case 'chargeAttack':
                if (this.patternStep === 0) {
                    // Wind up - stop and prepare
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                    
                    // Lock in target position
                    this.chargeTarget = { x: this.target.x, y: this.target.y };
                } else if (this.patternStep === 1) {
                    // Charging up (telegraph)
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.8) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Charge!
                    const dx = this.chargeTarget.x - this.x;
                    const dy = this.chargeTarget.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 20) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 4;
                        this.velocity.y = (dy / len) * this.maxSpeed * 4;
                    } else {
                        // Arrived at target, deal damage in area
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 1.5,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 80,
                            owner: this
                        };
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'projectileBarrage':
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.shots = this.patternData.shots || 0;
                
                // Stand still and fire rapid projectiles
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.06) { // Much faster firing
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // Fire 2 spread projectiles per shot
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    for (let s = 0; s < 2; s++) {
                        const spread = (s - 0.5) * 0.3 + (Math.random() - 0.5) * 0.2;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.35,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(baseAngle + spread) * 200,
                            targetY: this.y + Math.sin(baseAngle + spread) * 200,
                            speed: 450, // Faster projectiles
                            owner: this
                        };
                    }
                    
                    if (this.patternData.shots >= 20) { // More shots
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'trackingOrbCircle':
                // Spawn orbs in a circle that target player's position at fire time (not tracking)
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    const orbCount = 8 + this.bossPhase * 4;
                    const orbRadius = 120;
                    
                    // Visual ring forming phase
                    this.patternData.ringTimer = 0;
                    this.patternData.ringDuration = 1.5; // Ring forms over 1.5 seconds
                    this.patternData.orbCount = orbCount;
                    this.patternData.orbRadius = orbRadius;
                    this.showRingIndicator = true;
                    this.ringIndicatorProgress = 0;
                    
                    this.patternStep = 1;
                    this.patternData.timer = 0;
                } else if (this.patternStep === 1) {
                    // Ring forming phase - visual only
                    this.patternData.ringTimer += dt;
                    this.ringIndicatorProgress = Math.min(1, this.patternData.ringTimer / this.patternData.ringDuration);
                    
                    if (this.patternData.ringTimer >= this.patternData.ringDuration) {
                        // Lock player position NOW - this is where projectiles will aim
                        this.patternData.lockedTargetX = this.target.x;
                        this.patternData.lockedTargetY = this.target.y;
                        
                        // Spawn all orbs aiming at locked position
                        for (let i = 0; i < this.patternData.orbCount; i++) {
                            const angle = (i / this.patternData.orbCount) * Math.PI * 2;
                            const startX = this.x + Math.cos(angle) * this.patternData.orbRadius;
                            const startY = this.y + Math.sin(angle) * this.patternData.orbRadius;
                            
                            // Calculate direction to locked position
                            const dx = this.patternData.lockedTargetX - startX;
                            const dy = this.patternData.lockedTargetY - startY;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            this.trackingOrbs.push({
                                x: startX,
                                y: startY,
                                // Pre-calculated velocity - NO TRACKING, just straight line to locked position
                                vx: (dx / dist) * (200 + this.bossPhase * 40),
                                vy: (dy / dist) * (200 + this.bossPhase * 40),
                                speed: 200 + this.bossPhase * 40,
                                damage: this.damage * 0.5,
                                timer: 4, // Lifetime
                                phase: 'locked', // Skip tracking phase entirely
                                launchDelay: i * 0.05 // Slight stagger for visual effect
                            });
                        }
                        
                        this.showRingIndicator = false;
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    this.patternData.timer += dt;
                    
                    // End when all orbs are gone or timeout
                    if (this.trackingOrbs.length === 0 || this.patternData.timer > 6) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'meleeDashStrike':
                // Melee combo: dash to player, strike, dash back
                if (this.patternStep === 0) {
                    // Wind up
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.startPos = { x: this.x, y: this.y };
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Dash to player
                    this.patternData.timer += dt;
                    const dx = this.target.x - this.x;
                    const dy = this.target.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 40 && this.patternData.timer < 0.8) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 5;
                        this.velocity.y = (dy / len) * this.maxSpeed * 5;
                    } else {
                        // Strike! - with warning
                        this.showTelegraph = true;
                        this.telegraphRadius = 60;
                        this.pendingAttack = {
                            type: 'melee',
                            damage: this.damage * 1.3,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            range: 60,
                            knockback: 150,
                            owner: this
                        };
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Brief pause
                    this.patternData.timer += dt;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    if (this.patternData.timer > 0.3) {
                        this.patternStep = 3;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 3) {
                    // Dash back
                    this.patternData.timer += dt;
                    const dx = this.patternData.startPos.x - this.x;
                    const dy = this.patternData.startPos.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 30 && this.patternData.timer < 0.6) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 4;
                        this.velocity.y = (dy / len) * this.maxSpeed * 4;
                    } else {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'spiralProjectiles':
                // Fire projectiles in an expanding spiral
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.spiralAngle = (this.patternData.spiralAngle || 0) + dt * 5; // Faster spin
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.05) { // Much faster
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // Three arms of spiral
                    for (let arm = 0; arm < 3; arm++) {
                        const angle = this.patternData.spiralAngle + arm * (Math.PI * 2 / 3);
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 200,
                            targetY: this.y + Math.sin(angle) * 200,
                            speed: 280,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.shots >= 50) { // More shots
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'crossPattern':
                // Fire in + pattern that rotates
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.rotation = (this.patternData.rotation || 0) + dt * 0.8; // Faster rotation
                this.patternData.waves = this.patternData.waves || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.25) { // Faster waves
                    this.patternData.timer = 0;
                    this.patternData.waves++;
                    
                    // Fire in 8 directions (double cross pattern)
                    for (let i = 0; i < 8; i++) {
                        const angle = this.patternData.rotation + (i * Math.PI / 4);
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.4,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 300,
                            targetY: this.y + Math.sin(angle) * 300,
                            speed: 320,
                            width: 14,
                            height: 14,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.waves >= 8) { // More waves
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'multiProjectile':
                // Fire projectiles in all directions
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                const numProjectiles = 16 + this.bossPhase * 8; // More projectiles
                for (let i = 0; i < numProjectiles; i++) {
                    const angle = (i / numProjectiles) * Math.PI * 2;
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.4,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(angle) * 200,
                        targetY: this.y + Math.sin(angle) * 200,
                        speed: 350, // Faster projectiles
                        owner: this
                    };
                }
                this.endBossPattern();
                break;
            
            case 'ringCollapse':
                // Creates a full ring of projectiles around the boss that all fly toward the player's position
                if (this.patternStep === 0) {
                    // Setup phase - stop movement and lock player position
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.lockedTargetX = this.target.x; // Lock player position NOW
                    this.patternData.lockedTargetY = this.target.y;
                    this.patternData.ringRadius = 100 + Math.random() * 50;
                    this.patternData.projectileCount = 16 + Math.floor(Math.random() * 8); // 16-24 projectiles for full ring
                    this.patternData.projectilesSpawned = [];
                    
                    // Telegraph - show where ring will form
                    this.showTelegraph = true;
                    this.telegraphRadius = this.patternData.ringRadius;
                    this.telegraphColor = 'rgba(255, 100, 100, 0.3)';
                    
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Spawn projectiles in a full circle around the boss
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.5) { // 0.5 second wind-up
                        const count = this.patternData.projectileCount;
                        const radius = this.patternData.ringRadius;
                        
                        // Create all projectiles at once for a complete ring
                        for (let i = 0; i < count; i++) {
                            const angle = (i / count) * Math.PI * 2; // Full 360 degrees
                            const spawnX = this.x + Math.cos(angle) * radius;
                            const spawnY = this.y + Math.sin(angle) * radius;
                            
                            this.patternData.projectilesSpawned.push({
                                x: spawnX,
                                y: spawnY,
                                angle: angle
                            });
                        }
                        
                        this.patternData.timer = 0;
                        this.patternStep = 2;
                    }
                } else if (this.patternStep === 2) {
                    // Brief pause with projectiles visible at ring positions
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) { // 0.3 second pause before firing
                        // Fire all projectiles toward the LOCKED player position using pendingAttacks array
                        const targetX = this.patternData.lockedTargetX;
                        const targetY = this.patternData.lockedTargetY;
                        
                        // Initialize pendingAttacks array if needed
                        if (!this.pendingAttacks) this.pendingAttacks = [];
                        
                        for (const proj of this.patternData.projectilesSpawned) {
                            this.pendingAttacks.push({
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: proj.x,
                                y: proj.y,
                                targetX: targetX, // All projectiles converge on locked position
                                targetY: targetY,
                                speed: 280,
                                element: this.bossElement || 'fire',
                                owner: this
                            });
                        }
                        
                        this.showTelegraph = false;
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'omniDirectional':
                // Multiple waves of all-direction projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.waves = this.patternData.waves || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.25) { // Faster waves
                    this.patternData.timer = 0;
                    this.patternData.waves++;
                    
                    const projectiles = 20; // More projectiles per wave
                    const angleOffset = this.patternData.waves * 0.15; // Rotate each wave
                    
                    // Use pendingAttacks array for all projectiles at once
                    if (!this.pendingAttacks) this.pendingAttacks = [];
                    
                    for (let i = 0; i < projectiles; i++) {
                        const angle = angleOffset + (i / projectiles) * Math.PI * 2;
                        this.pendingAttacks.push({
                            type: 'projectile',
                            damage: this.damage * 0.35,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 200,
                            targetY: this.y + Math.sin(angle) * 200,
                            speed: 300,
                            owner: this
                        });
                    }
                    
                    if (this.patternData.waves >= 7) { // More waves
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'trackingSwarm':
                // Spawn many tracking orbs in rapid succession
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.spawned = this.patternData.spawned || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15 && this.patternData.spawned < 20) {
                    this.patternData.timer = 0;
                    this.patternData.spawned++;
                    
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 80 + Math.random() * 60;
                    
                    this.trackingOrbs.push({
                        x: this.x + Math.cos(angle) * dist,
                        y: this.y + Math.sin(angle) * dist,
                        speed: 180,
                        damage: this.damage * 0.35,
                        timer: 4,
                        phase: 'tracking',
                        lockRadius: 40
                    });
                }
                
                if (this.patternData.spawned >= 20 && this.trackingOrbs.length === 0) {
                    this.endBossPattern();
                }
                break;
                
            case 'rageDash':
                // 5 chained dashes to random coordinates within room bounds
                this.patternData.dashes = this.patternData.dashes || 0;
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.dashPhase = this.patternData.dashPhase || 'windup';
                
                if (this.patternData.dashPhase === 'windup') {
                    // Brief telegraph before dash chain
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.isBossDashing = true;
                    
                    if (this.patternData.timer > 0.15) {
                        // Pick random target within room (radius of 150 from current position)
                        const dashRadius = 100 + Math.random() * 80;
                        const dashAngle = Math.random() * Math.PI * 2;
                        this.patternData.dashTarget = {
                            x: this.x + Math.cos(dashAngle) * dashRadius,
                            y: this.y + Math.sin(dashAngle) * dashRadius
                        };
                        
                        // Add afterimage at start position
                        this.bossDashTrail.push({
                            x: this.x,
                            y: this.y,
                            alpha: 1.0,
                            time: 0.4,
                            color: this.color
                        });
                        
                        // Signal to play dash sound
                        this.playDashSound = true;
                        
                        this.patternData.dashPhase = 'dashing';
                        this.patternData.timer = 0;
                    }
                } else if (this.patternData.dashPhase === 'dashing') {
                    // Dash towards target at high speed
                    const dx = this.patternData.dashTarget.x - this.x;
                    const dy = this.patternData.dashTarget.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    // Add intermediate afterimages during dash
                    if (Math.random() < 0.5) {
                        this.bossDashTrail.push({
                            x: this.x,
                            y: this.y,
                            alpha: 0.6,
                            time: 0.25,
                            color: this.color
                        });
                    }
                    
                    if (len > 20) {
                        // Very fast dash movement
                        this.velocity.x = (dx / len) * this.maxSpeed * 8;
                        this.velocity.y = (dy / len) * this.maxSpeed * 8;
                        this.facing.x = dx / len;
                        this.facing.y = dy / len;
                    } else {
                        // Arrived at destination - attack and prepare next dash
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                        
                        // Melee strike on arrival with knockback
                        this.pendingAttack = {
                            type: 'melee',
                            damage: this.damage * 1.3,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            range: 60,
                            knockback: 130,
                            owner: this
                        };
                        
                        this.patternData.dashes++;
                        this.patternData.timer = 0;
                        
                        if (this.patternData.dashes >= 5) {
                            // End the chain
                            this.isBossDashing = false;
                            this.endBossPattern();
                        } else {
                            // Quick pause then next dash
                            this.patternData.dashPhase = 'windup';
                        }
                    }
                }
                break;
                
            case 'ultimateBlast':
                // Huge AOE explosion - VERY telegraphed so player can dodge
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                    // Show big warning telegraph
                    this.showTelegraph = true;
                    this.telegraphRadius = 200;
                    this.telegraphColor = 'rgba(255, 0, 0, 0.3)';
                } else if (this.patternStep === 1) {
                    // Long charge up (warning period) - player has 2.5 seconds to escape
                    this.patternData.timer += dt;
                    // Pulsing telegraph gets more intense
                    this.telegraphRadius = 200 + Math.sin(this.patternData.timer * 8) * 20;
                    
                    if (this.patternData.timer > 2.5) {
                        // BOOM! - reduced damage, very avoidable
                        this.showTelegraph = false;
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 1.2,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 200,
                            owner: this
                        };
                        this.endBossPattern();
                    }
                }
                break;
                
            // ========== SIGNATURE MOVES ==========
            
            case 'signatureAnkh':
                // Pharaoh: Lightning Storm - multiple lightning strikes around arena
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.strikes = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Spawn lightning zones in rapid succession
                    if (this.patternData.timer > 0.15 && this.patternData.strikes < 12) {
                        this.patternData.timer = 0;
                        this.patternData.strikes++;
                        
                        // Target player position with some spread
                        const spreadX = (Math.random() - 0.5) * 200;
                        const spreadY = (Math.random() - 0.5) * 200;
                        this.spawnLightningZone(
                            this.target.x + spreadX,
                            this.target.y + spreadY,
                            this.lightningStrikeDelay,
                            70
                        );
                    }
                    
                    // Also fire an ankh projectile
                    if (this.patternData.strikes === 6) {
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.8,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            speed: 250,
                            width: 48,
                            height: 48,
                            element: 'lightning',
                            effects: [{ type: 'stun', duration: 1.5 }],
                            owner: this
                        };
                    }
                    
                    if (this.patternData.strikes >= 12) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'signatureCerberus':
                // Cerberus: Triple lightning breath (3 directions)
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.bursts = this.patternData.bursts || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.06) {
                    this.patternData.timer = 0;
                    this.patternData.bursts++;
                    
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    
                    // Three heads breathing lightning
                    for (let head = -1; head <= 1; head++) {
                        const angle = baseAngle + head * 0.4;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: this.x + Math.cos(angle) * 30,
                            y: this.y + Math.sin(angle) * 30,
                            targetX: this.x + Math.cos(angle) * 300,
                            targetY: this.y + Math.sin(angle) * 300,
                            speed: 450,
                            element: 'lightning',
                            owner: this
                        };
                    }
                    
                    if (this.patternData.bursts >= 30) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'signatureWebPrison':
                // Spider Queen: Surround player with web projectiles
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.8) {
                        // Create web prison around player
                        const webCount = 16;
                        for (let i = 0; i < webCount; i++) {
                            const angle = (i / webCount) * Math.PI * 2;
                            const dist = 150;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.4,
                                x: this.target.x + Math.cos(angle) * dist,
                                y: this.target.y + Math.sin(angle) * dist,
                                targetX: this.target.x,
                                targetY: this.target.y,
                                speed: 180,
                                element: 'poison',
                                effects: [{ type: 'slow', duration: 3, amount: 0.5 }],
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'signatureDivineJudgment':
                // Archangel: Rain of holy light from above
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.strikes = this.patternData.strikes || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.strikes++;
                    
                    // Random position near player
                    const offsetX = (Math.random() - 0.5) * 200;
                    const offsetY = (Math.random() - 0.5) * 200;
                    
                    this.pendingAttack = {
                        type: 'aoe',
                        damage: this.damage * 0.6,
                        x: this.target.x + offsetX,
                        y: this.target.y + offsetY,
                        targetX: this.target.x + offsetX,
                        targetY: this.target.y + offsetY,
                        radius: 50,
                        duration: 0.3,
                        element: 'holy',
                        owner: this
                    };
                    
                    if (this.patternData.strikes >= 15) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'signatureSystemOverload':
                // Master AI: Grid of laser beams
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.5) {
                        // Create grid of lasers
                        for (let x = -2; x <= 2; x++) {
                            for (let y = -2; y <= 2; y++) {
                                if (x === 0 && y === 0) continue;
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.35,
                                    x: this.x,
                                    y: this.y,
                                    targetX: this.x + x * 100,
                                    targetY: this.y + y * 100,
                                    speed: 350,
                                    element: 'lightning',
                                    owner: this
                                };
                            }
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'signatureSeismicSlam':
                // Ancient Golem: Ground pound with shockwaves
                if (this.patternStep === 0) {
                    // Jump up (telegraph)
                    this.velocity.x = 0;
                    this.velocity.y = -200;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.5) {
                        // Slam down at player position
                        this.x = this.target.x;
                        this.y = this.target.y;
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                        
                        // Create expanding shockwaves
                        for (let ring = 1; ring <= 3; ring++) {
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * (1.5 - ring * 0.3),
                                x: this.x,
                                y: this.y,
                                targetX: this.x,
                                targetY: this.y,
                                radius: 60 * ring,
                                duration: 0.3 + ring * 0.2,
                                element: 'earth',
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== ORIGINAL BOSS SIGNATURES ==========
            
            case 'signatureSkeletonKing':
                // Skeleton King: Army of the Damned - summon skeleton army + royal ground slam
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.summons = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 180;
                    this.telegraphColor = 'rgba(200, 180, 140, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Summon skeletons in waves
                    if (this.patternData.timer > 0.3 && this.patternData.summons < 8) {
                        this.patternData.timer = 0;
                        this.patternData.summons++;
                        
                        const angle = (this.patternData.summons / 8) * Math.PI * 2;
                        this.pendingMobSpawn = {
                            type: 'skeleton',
                            count: 1,
                            x: this.x + Math.cos(angle) * 120,
                            y: this.y + Math.sin(angle) * 120
                        };
                    }
                    
                    if (this.patternData.summons >= 8) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Royal ground slam finale
                    this.patternData.timer += dt;
                    this.telegraphRadius = 180 + Math.sin(this.patternData.timer * 10) * 30;
                    
                    if (this.patternData.timer > 1) {
                        this.showTelegraph = false;
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 1.5,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 180,
                            element: 'dark',
                            owner: this
                        };
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'signatureDragonLord':
                // Dragon Lord: Inferno Apocalypse - carpet bombing + final breath
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.bombRuns = 0;
                    this.patternData.flightY = this.y - 100;
                    // Rise up
                    this.y -= 50;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Drop fire bombs across the arena
                    if (this.patternData.timer > 0.2 && this.patternData.bombRuns < 12) {
                        this.patternData.timer = 0;
                        this.patternData.bombRuns++;
                        
                        // Firebombs spread across arena
                        const spread = 200;
                        this.spawnLightningZone(
                            this.target.x + (Math.random() - 0.5) * spread * 2,
                            this.target.y + (Math.random() - 0.5) * spread,
                            0.8, // Shorter delay - must dodge fast!
                            80
                        );
                    }
                    
                    if (this.patternData.bombRuns >= 12) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Final sweeping fire breath
                    this.patternData.timer += dt;
                    this.patternData.breathAngle = this.patternData.breathAngle || Math.atan2(this.target.y - this.y, this.target.x - this.x) - Math.PI / 3;
                    
                    // Sweep fire breath
                    if (this.patternData.timer > 0.05) {
                        this.patternData.timer = 0;
                        this.patternData.breathAngle += 0.1;
                        
                        for (let i = 0; i < 3; i++) {
                            const spreadAngle = this.patternData.breathAngle + (i - 1) * 0.1;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.4,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(spreadAngle) * 400,
                                targetY: this.y + Math.sin(spreadAngle) * 400,
                                speed: 400,
                                element: 'fire',
                                owner: this
                            };
                        }
                        
                        // Check if sweep complete
                        if (this.patternData.breathAngle > Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 3) {
                            this.y += 50; // Return to ground
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'signatureLichKing':
                // Lich King: Soul Harvest - drain life + death nova
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.orbsLaunched = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 250;
                    this.telegraphColor = 'rgba(80, 0, 120, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Soul orbs spiral outward
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.1 && this.patternData.orbsLaunched < 24) {
                        this.patternData.timer = 0;
                        this.patternData.orbsLaunched++;
                        
                        const spiralAngle = (this.patternData.orbsLaunched / 24) * Math.PI * 4;
                        this.trackingOrbs.push({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(spiralAngle) * 200,
                            vy: Math.sin(spiralAngle) * 200,
                            speed: 200,
                            damage: this.damage * 0.3,
                            timer: 3,
                            phase: 'locked',
                            element: 'dark'
                        });
                    }
                    
                    if (this.patternData.orbsLaunched >= 24) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Death Nova - heal self if player still in range
                    this.patternData.timer += dt;
                    this.telegraphRadius = 250 - this.patternData.timer * 200;
                    
                    if (this.patternData.timer > 1) {
                        this.showTelegraph = false;
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 1.2,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 250,
                            element: 'dark',
                            owner: this
                        };
                        // Heal self a bit
                        this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.05);
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== NEW DYNAMIC PATTERNS ==========
            
            case 'groundSlam':
                // Slam the ground creating expanding shockwave
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.4) {
                        // Create shockwave ring
                        for (let i = 0; i < 16; i++) {
                            const angle = (i / 16) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.6,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 400,
                                targetY: this.y + Math.sin(angle) * 400,
                                speed: 250,
                                width: 24,
                                height: 24,
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'teleportStrike':
                // Dash behind player with afterimages and strike (was teleport)
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.startPos = { x: this.x, y: this.y };
                    // Calculate target position behind player
                    const angleToPlayer = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    this.patternData.targetPos = {
                        x: this.target.x - Math.cos(angleToPlayer) * 60,
                        y: this.target.y - Math.sin(angleToPlayer) * 60
                    };
                    // Show warning line
                    this.showTelegraph = true;
                    this.telegraphRadius = 40;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Wind-up with telegraph
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.4) {
                        this.showTelegraph = false;
                        this.isBossDashing = true;
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Dash with afterimages
                    this.patternData.timer += dt;
                    const dashProgress = Math.min(this.patternData.timer / 0.2, 1);
                    
                    // Interpolate position
                    const prevX = this.x;
                    const prevY = this.y;
                    this.x = this.patternData.startPos.x + (this.patternData.targetPos.x - this.patternData.startPos.x) * dashProgress;
                    this.y = this.patternData.startPos.y + (this.patternData.targetPos.y - this.patternData.startPos.y) * dashProgress;
                    
                    // Add afterimage trail
                    if (this.patternData.timer % 0.03 < 0.016) {
                        this.bossDashTrail.push({
                            x: prevX,
                            y: prevY,
                            alpha: 1.0,
                            time: 0.3,
                            color: this.getElementColor(this.bossElement)
                        });
                    }
                    
                    if (dashProgress >= 1) {
                        this.isBossDashing = false;
                        this.patternStep = 3;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 3) {
                    // Strike - with warning telegraph
                    this.patternData.timer += dt;
                    // Add warning flash before strike
                    this.showTelegraph = true;
                    this.telegraphRadius = 80;
                    if (this.patternData.timer > 0.35) {
                        this.showTelegraph = false;
                        this.pendingAttack = {
                            type: 'melee',
                            damage: this.damage * 1.2,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            range: 80,
                            owner: this
                        };
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'summonMinions':
                // Summon tracking projectiles that act as minions
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.6) {
                        // Spawn minion orbs in circle
                        const minionCount = 4 + this.bossPhase * 2;
                        for (let i = 0; i < minionCount; i++) {
                            const angle = (i / minionCount) * Math.PI * 2;
                            this.trackingOrbs.push({
                                x: this.x + Math.cos(angle) * 60,
                                y: this.y + Math.sin(angle) * 60,
                                speed: 120,
                                damage: this.damage * 0.4,
                                timer: 8,
                                phase: 'tracking',
                                lockRadius: 30
                            });
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'shadowClones':
                // Create shadow clones - player must hit the real boss!
                // Fake clones disappear when hit, real boss takes damage
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                
                if (this.patternStep === 0) {
                    // Initialize - spawn clones around arena
                    this.patternData.clones = [];
                    this.patternData.realIndex = Math.floor(Math.random() * 5); // Which one is real (0-4)
                    this.patternData.clonesAlive = 5;
                    this.shadowCloneActive = true;
                    this.shadowClones = [];
                    
                    // Store original position
                    this.patternData.originalX = this.x;
                    this.patternData.originalY = this.y;
                    
                    // Create 5 positions in a circle
                    const centerX = this.x;
                    const centerY = this.y;
                    const radius = 150;
                    
                    for (let i = 0; i < 5; i++) {
                        const angle = (i / 5) * Math.PI * 2;
                        const cloneX = centerX + Math.cos(angle) * radius;
                        const cloneY = centerY + Math.sin(angle) * radius;
                        
                        this.patternData.clones.push({
                            x: cloneX,
                            y: cloneY,
                            isReal: i === this.patternData.realIndex,
                            alive: true,
                            alpha: 1,
                            attackTimer: 0.5 + Math.random() * 0.5
                        });
                        
                        // Add to visible clones for rendering
                        this.shadowClones.push({
                            x: cloneX,
                            y: cloneY,
                            isReal: i === this.patternData.realIndex,
                            alive: true,
                            alpha: 1
                        });
                    }
                    
                    // Move real boss to the "real" clone position
                    const realClone = this.patternData.clones[this.patternData.realIndex];
                    this.x = realClone.x;
                    this.y = realClone.y;
                    
                    this.patternStep = 1;
                    this.patternData.timer = 0;
                } else if (this.patternStep === 1) {
                    // Main phase - clones attack, player hunts the real one
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    
                    // Update clone attack timers
                    for (let i = 0; i < this.patternData.clones.length; i++) {
                        const clone = this.patternData.clones[i];
                        if (!clone.alive) continue;
                        
                        clone.attackTimer -= dt;
                        if (clone.attackTimer <= 0) {
                            clone.attackTimer = 0.8 + Math.random() * 0.4;
                            
                            // Fire projectile at player
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: clone.x,
                                y: clone.y,
                                targetX: this.target.x,
                                targetY: this.target.y,
                                speed: 300,
                                owner: this
                            };
                        }
                        
                        // Sync visual clone
                        if (this.shadowClones[i]) {
                            this.shadowClones[i].alive = clone.alive;
                            this.shadowClones[i].alpha = clone.alpha;
                        }
                    }
                    
                    // Check timeout or all fake clones destroyed
                    const fakeClones = this.patternData.clones.filter(c => !c.isReal && c.alive);
                    if (this.patternData.timer > 8 || fakeClones.length === 0) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // End phase - reveal real boss with flourish
                    this.shadowCloneActive = false;
                    this.shadowClones = [];
                    
                    // Return to original position if needed
                    const realClone = this.patternData.clones[this.patternData.realIndex];
                    this.x = realClone.x;
                    this.y = realClone.y;
                    
                    this.endBossPattern();
                }
                break;
                
            case 'vortexPull':
                // Pull player towards boss then explode
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer < 1.5) {
                    // Pull effect - create a projectile that pushes player toward boss
                    if (this.patternData.timer > 0.1 && !this.patternData.pulling) {
                        this.patternData.pulling = true;
                        // We'll use a tracking orb going towards the player that when near applies pull
                    }
                } else {
                    // Explosion at boss location
                    this.pendingAttack = {
                        type: 'aoe',
                        damage: this.damage * 1.5,
                        x: this.x,
                        y: this.y,
                        targetX: this.x,
                        targetY: this.y,
                        radius: 150,
                        owner: this
                    };
                    this.endBossPattern();
                }
                break;
                
            case 'deathRay':
                // Continuous beam attack sweeping across the arena
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = this.patternData.angle || Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                // Rotate the beam
                this.patternData.angle += dt * 1.5;
                
                if (this.patternData.timer > 0.03) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // Fire beam projectile
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.2,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(this.patternData.angle) * 500,
                        targetY: this.y + Math.sin(this.patternData.angle) * 500,
                        speed: 600,
                        width: 8,
                        height: 8,
                        owner: this
                    };
                    
                    if (this.patternData.shots >= 80) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'meteorStorm':
                // Rain of projectiles from above targeting player's area
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.meteors = this.patternData.meteors || 0;
                
                // Move around while casting
                if (this.target) {
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
                    this.velocity.x = Math.cos(angle) * this.maxSpeed * 0.5;
                    this.velocity.y = Math.sin(angle) * this.maxSpeed * 0.5;
                }
                
                if (this.patternData.timer > 0.12) {
                    this.patternData.timer = 0;
                    this.patternData.meteors++;
                    
                    // Random position near player
                    const offsetX = (Math.random() - 0.5) * 250;
                    const offsetY = (Math.random() - 0.5) * 250;
                    
                    // Create AOE at that location
                    this.pendingAttack = {
                        type: 'aoe',
                        damage: this.damage * 0.5,
                        x: this.target.x + offsetX,
                        y: this.target.y + offsetY,
                        targetX: this.target.x + offsetX,
                        targetY: this.target.y + offsetY,
                        radius: 45,
                        duration: 0.2,
                        owner: this
                    };
                    
                    if (this.patternData.meteors >= 25) {
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== DYNAMIC PROJECTILE PATTERNS ==========
            
            case 'bulletHellSpiral':
                // Beautiful spiral pattern that expands outward
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = (this.patternData.angle || 0);
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                // Fire 3 projectiles per interval at rotating angles
                if (this.patternData.timer > 0.05) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // Fire 3 projectiles in a rotating pattern
                    for (let i = 0; i < 3; i++) {
                        const angle = this.patternData.angle + (i * Math.PI * 2 / 3);
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 300,
                            targetY: this.y + Math.sin(angle) * 300,
                            speed: 200 + this.patternData.shots * 3, // Speed increases over time
                            width: 10,
                            height: 10,
                            owner: this
                        };
                    }
                    
                    this.patternData.angle += 0.15; // Rotate spiral
                    
                    if (this.patternData.shots >= 60) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'bulletHellFlower':
                // Multiple spirals creating a flower-like pattern
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = (this.patternData.angle || 0);
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // 5 petals of the flower
                    const petals = 5;
                    for (let p = 0; p < petals; p++) {
                        const petalAngle = this.patternData.angle + (p * Math.PI * 2 / petals);
                        // Alternate spiral direction per petal
                        const spiralMod = p % 2 === 0 ? 1 : -1;
                        const angle = petalAngle + Math.sin(this.patternData.shots * 0.2) * spiralMod * 0.5;
                        
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.2,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 300,
                            targetY: this.y + Math.sin(angle) * 300,
                            speed: 180,
                            width: 8,
                            height: 8,
                            owner: this
                        };
                    }
                    
                    this.patternData.angle += 0.08;
                    
                    if (this.patternData.shots >= 50) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'bouncingOrbs':
                // Projectiles that bounce off invisible walls
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.orbs = [];
                    
                    // Spawn 8 bouncing orbs
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        this.patternData.orbs.push({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * 200,
                            vy: Math.sin(angle) * 200,
                            bounces: 0,
                            maxBounces: 4,
                            alive: true
                        });
                    }
                    this.patternStep = 1;
                    this.patternData.timer = 0;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Update bouncing orbs
                    for (const orb of this.patternData.orbs) {
                        if (!orb.alive) continue;
                        
                        orb.x += orb.vx * dt;
                        orb.y += orb.vy * dt;
                        
                        // Bounce off boundaries (room bounds approximation)
                        const boundsX = 300;
                        const boundsY = 300;
                        if (Math.abs(orb.x - this.x) > boundsX) {
                            orb.vx *= -1;
                            orb.bounces++;
                        }
                        if (Math.abs(orb.y - this.y) > boundsY) {
                            orb.vy *= -1;
                            orb.bounces++;
                        }
                        
                        if (orb.bounces >= orb.maxBounces) {
                            orb.alive = false;
                        }
                        
                        // Create projectile at orb position
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: orb.x,
                            y: orb.y,
                            targetX: orb.x + orb.vx * 0.1,
                            targetY: orb.y + orb.vy * 0.1,
                            speed: 0,
                            width: 16,
                            height: 16,
                            duration: 0.1,
                            owner: this
                        };
                    }
                    
                    // Check if all orbs dead or timeout
                    const aliveOrbs = this.patternData.orbs.filter(o => o.alive).length;
                    if (aliveOrbs === 0 || this.patternData.timer > 6) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'laserSweep':
                // Rotating laser beam that sweeps across the arena
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = (this.patternData.angle || 0);
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                // Show telegraph
                this.showTelegraph = true;
                this.telegraphRadius = 40;
                
                // Fire a line of projectiles forming the laser
                if (this.patternData.timer > 0.03) {
                    this.patternData.timer = 0;
                    
                    // Create laser beam from multiple projectiles
                    for (let dist = 30; dist < 250; dist += 25) {
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.2,
                            x: this.x + Math.cos(this.patternData.angle) * dist,
                            y: this.y + Math.sin(this.patternData.angle) * dist,
                            targetX: this.x + Math.cos(this.patternData.angle) * (dist + 10),
                            targetY: this.y + Math.sin(this.patternData.angle) * (dist + 10),
                            speed: 50,
                            width: 12,
                            height: 12,
                            duration: 0.1,
                            owner: this
                        };
                    }
                }
                
                this.patternData.angle += dt * 1.5; // Rotate the laser
                
                if (this.patternData.angle > Math.PI * 4) { // Two full rotations
                    this.showTelegraph = false;
                    this.endBossPattern();
                }
                break;
                
            case 'homingMissileBarrage':
                // Fire missiles that home in on player
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.missiles = this.patternData.missiles || 0;
                
                // Move away from player while firing
                if (this.target) {
                    const dx = this.x - this.target.x;
                    const dy = this.y - this.target.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 0 && len < 200) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 0.8;
                        this.velocity.y = (dy / len) * this.maxSpeed * 0.8;
                    }
                }
                
                if (this.patternData.timer > 0.25) {
                    this.patternData.timer = 0;
                    this.patternData.missiles++;
                    
                    // Spawn a tracking orb that homes in
                    const angle = Math.random() * Math.PI * 2;
                    this.trackingOrbs.push({
                        x: this.x + Math.cos(angle) * 40,
                        y: this.y + Math.sin(angle) * 40,
                        speed: 250 + Math.random() * 100,
                        damage: this.damage * 0.4,
                        timer: 4,
                        phase: 'tracking',
                        lockRadius: 30
                    });
                    
                    if (this.patternData.missiles >= 12) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'voidRift':
                // Create a vortex that pulls player in and fires projectiles outward
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.riftX = this.target.x;
                    this.patternData.riftY = this.target.y;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Pull player towards rift center (handled via game physics)
                    // Fire projectiles outward from rift in expanding rings
                    if (Math.floor(this.patternData.timer * 4) > Math.floor((this.patternData.timer - dt) * 4)) {
                        const numProjectiles = 12;
                        for (let i = 0; i < numProjectiles; i++) {
                            const angle = (i / numProjectiles) * Math.PI * 2 + this.patternData.timer;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.patternData.riftX,
                                y: this.patternData.riftY,
                                targetX: this.patternData.riftX + Math.cos(angle) * 400,
                                targetY: this.patternData.riftY + Math.sin(angle) * 400,
                                speed: 150,
                                width: 14,
                                height: 14,
                                owner: this
                            };
                        }
                    }
                    
                    // Also create AOE damage at rift center
                    if (this.patternData.timer > 0.5 && Math.floor(this.patternData.timer * 2) > Math.floor((this.patternData.timer - dt) * 2)) {
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.4,
                            x: this.patternData.riftX,
                            y: this.patternData.riftY,
                            targetX: this.patternData.riftX,
                            targetY: this.patternData.riftY,
                            radius: 60,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.timer > 4) {
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== PHARAOH UNIQUE PATTERNS ==========
            
            case 'lightningChain':
                // Pharaoh dashes and leaves chain of lightning strikes behind
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.dashTarget = { x: this.target.x, y: this.target.y };
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Dash towards player, spawning lightning zones along path
                    const dx = this.patternData.dashTarget.x - this.x;
                    const dy = this.patternData.dashTarget.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 30) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 5;
                        this.velocity.y = (dy / len) * this.maxSpeed * 5;
                        
                        // Spawn lightning zones along the path
                        this.patternData.timer += dt;
                        if (this.patternData.timer > 0.08) {
                            this.patternData.timer = 0;
                            this.spawnLightningZone(this.x, this.y, 0.3, 50);
                        }
                    } else {
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'sandstormLightning':
                // Pharaoh creates random lightning strikes around the arena
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.strikes = this.patternData.strikes || 0;
                
                // Strafe while casting
                if (this.target) {
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
                    this.velocity.x = Math.cos(angle) * this.maxSpeed * 0.8;
                    this.velocity.y = Math.sin(angle) * this.maxSpeed * 0.8;
                }
                
                if (this.patternData.timer > 0.2) {
                    this.patternData.timer = 0;
                    this.patternData.strikes++;
                    
                    // Random position in arena around player
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 150;
                    this.spawnLightningZone(
                        this.target.x + Math.cos(angle) * dist,
                        this.target.y + Math.sin(angle) * dist,
                        0.4,
                        60
                    );
                    
                    if (this.patternData.strikes >= 15) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'pyramidStrike':
                // Pharaoh creates a triangle pattern of lightning around player
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.4) {
                        // Create triangle of lightning
                        for (let i = 0; i < 3; i++) {
                            const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                            const dist = 100;
                            this.spawnLightningZone(
                                this.target.x + Math.cos(angle) * dist,
                                this.target.y + Math.sin(angle) * dist,
                                0.5,
                                70
                            );
                        }
                        // And one directly on player
                        this.spawnLightningZone(this.target.x, this.target.y, 0.6, 50);
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'scarabSwarm':
                // Swarm of homing scarab projectiles
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.scarabs = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.15) {
                        this.patternData.timer = 0;
                        this.patternData.scarabs++;
                        
                        // Spawn tracking scarab orb
                        const angle = Math.random() * Math.PI * 2;
                        const offsetDist = 30 + Math.random() * 30;
                        this.trackingOrbs.push({
                            x: this.x + Math.cos(angle) * offsetDist,
                            y: this.y + Math.sin(angle) * offsetDist,
                            vx: 0,
                            vy: 0,
                            speed: 140 + Math.random() * 60,
                            damage: this.damage * 0.25,
                            timer: 4,
                            phase: 'tracking',
                            lockRadius: 35,
                            element: 'lightning'
                        });
                        
                        if (this.patternData.scarabs >= 12) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'sandTornado':
                // Spinning sand projectile tornado
                if (this.patternStep === 0) {
                    this.patternData.timer = 0;
                    this.patternData.spinAngle = 0;
                    this.patternData.shots = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.patternData.spinAngle += dt * 6;
                    
                    // Strafe around player
                    const strafeAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
                    this.velocity.x = Math.cos(strafeAngle) * this.maxSpeed;
                    this.velocity.y = Math.sin(strafeAngle) * this.maxSpeed;
                    
                    if (this.patternData.timer > 0.08) {
                        this.patternData.timer = 0;
                        this.patternData.shots++;
                        
                        // Spiral outward projectiles
                        for (let i = 0; i < 2; i++) {
                            const angle = this.patternData.spinAngle + i * Math.PI;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 350,
                                targetY: this.y + Math.sin(angle) * 350,
                                speed: 280,
                                element: 'lightning',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.shots >= 40) {
                            this.velocity.x = 0;
                            this.velocity.y = 0;
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'curseOfTheSun':
                // Large delayed sun AOE with radial projectiles
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.sunX = this.target.x;
                    this.patternData.sunY = this.target.y;
                    this.showTelegraph = true;
                    this.telegraphRadius = 120;
                    this.telegraphColor = 'rgba(255, 200, 0, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 1.2) {
                        this.showTelegraph = false;
                        
                        // Central sun explosion
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.7,
                            x: this.patternData.sunX,
                            y: this.patternData.sunY,
                            targetX: this.patternData.sunX,
                            targetY: this.patternData.sunY,
                            radius: 120,
                            element: 'fire',
                            owner: this
                        };
                        
                        // Radial lightning projectiles
                        for (let i = 0; i < 16; i++) {
                            const angle = (i / 16) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.patternData.sunX,
                                y: this.patternData.sunY,
                                targetX: this.patternData.sunX + Math.cos(angle) * 400,
                                targetY: this.patternData.sunY + Math.sin(angle) * 400,
                                speed: 300,
                                element: 'lightning',
                                owner: this
                            };
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== CERBERUS UNIQUE PATTERNS ==========
            
            case 'hellfireBreath':
                // Triple fire breath in cone
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.bursts = this.patternData.bursts || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.05) {
                    this.patternData.timer = 0;
                    this.patternData.bursts++;
                    
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    for (let i = -2; i <= 2; i++) {
                        const angle = baseAngle + i * 0.15;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 300,
                            targetY: this.y + Math.sin(angle) * 300,
                            speed: 400,
                            element: 'fire',
                            owner: this
                        };
                    }
                    
                    if (this.patternData.bursts >= 25) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'tripleChomp':
                // Three rapid dash-bites
                this.patternData.chomps = this.patternData.chomps || 0;
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.phase = this.patternData.phase || 'wind';
                
                if (this.patternData.phase === 'wind') {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    if (this.patternData.timer > 0.2) {
                        this.patternData.phase = 'dash';
                        this.patternData.timer = 0;
                        this.patternData.dashTarget = { x: this.target.x, y: this.target.y };
                    }
                } else if (this.patternData.phase === 'dash') {
                    const dx = this.patternData.dashTarget.x - this.x;
                    const dy = this.patternData.dashTarget.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 30 && this.patternData.timer < 0.4) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 6;
                        this.velocity.y = (dy / len) * this.maxSpeed * 6;
                        this.patternData.timer += dt;
                    } else {
                        this.pendingAttack = {
                            type: 'melee',
                            damage: this.damage * 1.2,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            range: 70,
                            element: 'fire',
                            owner: this
                        };
                        this.patternData.chomps++;
                        this.patternData.timer = 0;
                        
                        if (this.patternData.chomps >= 3) {
                            this.endBossPattern();
                        } else {
                            this.patternData.phase = 'wind';
                        }
                    }
                }
                break;
                
            case 'infernoCircle':
                // Create expanding ring of fire
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.5) {
                        for (let ring = 0; ring < 3; ring++) {
                            const projectiles = 12 + ring * 4;
                            for (let i = 0; i < projectiles; i++) {
                                const angle = (i / projectiles) * Math.PI * 2;
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.35,
                                    x: this.x,
                                    y: this.y,
                                    targetX: this.x + Math.cos(angle) * (200 + ring * 100),
                                    targetY: this.y + Math.sin(angle) * (200 + ring * 100),
                                    speed: 200 + ring * 50,
                                    element: 'fire',
                                    owner: this
                                };
                            }
                        }
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'spiralBounce':
                // Spinning spiral attack that bounces off 3 walls
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.spirals = this.patternData.spirals || 0;
                this.patternData.angle = this.patternData.angle || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.06) {
                    this.patternData.timer = 0;
                    this.patternData.spirals++;
                    this.patternData.angle += 0.25;
                    
                    // Fire spiraling projectile that bounces off walls
                    const speed = 350;
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.3,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(this.patternData.angle) * 400,
                        targetY: this.y + Math.sin(this.patternData.angle) * 400,
                        speed: speed,
                        element: 'fire',
                        bounces: 3, // Bounces off 3 walls before disappearing
                        owner: this
                    };
                    
                    if (this.patternData.spirals >= 36) { // Full spiral
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'splittingFlame':
                // Projectile that bounces and splits into 2 for half damage, up to 5 times
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.shots = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.5) {
                        this.patternData.timer = 0;
                        this.patternData.shots++;
                        
                        // Fire splitting flame at player
                        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.6,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            speed: 280,
                            element: 'fire',
                            bounces: 1, // Will bounce once
                            splitsRemaining: 5, // Can split up to 5 times
                            width: 20,
                            height: 20,
                            owner: this
                        };
                        
                        if (this.patternData.shots >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'fireWave':
                // Sweeping wave of fire across the arena
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waveDir = Math.random() > 0.5 ? 1 : -1; // Left or right
                    this.patternData.waveAngle = this.patternData.waveDir > 0 ? -Math.PI / 2 : Math.PI / 2;
                    this.showTelegraph = true;
                    this.telegraphRadius = 300;
                    this.telegraphColor = 'rgba(255, 100, 0, 0.2)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Fire a wall of projectiles that sweeps
                    if (this.patternData.timer > 0.04) {
                        this.patternData.timer = 0;
                        this.patternData.waveAngle += 0.05 * this.patternData.waveDir;
                        
                        // Create wall of fire projectiles
                        for (let dist = 50; dist <= 300; dist += 40) {
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: this.x + Math.cos(this.patternData.waveAngle) * dist,
                                y: this.y + Math.sin(this.patternData.waveAngle) * dist,
                                targetX: this.x + Math.cos(this.patternData.waveAngle) * (dist + 100),
                                targetY: this.y + Math.sin(this.patternData.waveAngle) * (dist + 100),
                                speed: 150,
                                element: 'fire',
                                width: 16,
                                height: 16,
                                owner: this
                            };
                        }
                        
                        // Check if wave complete (180 degree sweep)
                        if (Math.abs(this.patternData.waveAngle) > Math.PI / 2 + Math.PI) {
                            this.showTelegraph = false;
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'hellShockwave':
                // Ground-pound shockwave with fire trails
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 200;
                    this.telegraphColor = 'rgba(255, 60, 0, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.telegraphRadius = 200 + Math.sin(this.patternData.timer * 12) * 30;
                    
                    if (this.patternData.timer > 0.8) {
                        this.showTelegraph = false;
                        
                        // Central shockwave
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.8,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 200,
                            knockback: 150,
                            element: 'fire',
                            owner: this
                        };
                        
                        // Expanding fire ring
                        for (let i = 0; i < 24; i++) {
                            const angle = (i / 24) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.35,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 500,
                                targetY: this.y + Math.sin(angle) * 500,
                                speed: 300,
                                element: 'fire',
                                width: 18,
                                height: 18,
                                owner: this
                            };
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'lavaPools':
                // Create lava pool hazards around the arena
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.pools = this.patternData.pools || 0;
                
                // Move around while casting
                if (this.target) {
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
                    this.velocity.x = Math.cos(angle) * this.maxSpeed * 0.7;
                    this.velocity.y = Math.sin(angle) * this.maxSpeed * 0.7;
                }
                
                if (this.patternData.timer > 0.25) {
                    this.patternData.timer = 0;
                    this.patternData.pools++;
                    
                    // Create lava zone at player's predicted position
                    const predX = this.target.x + (this.target.velocity?.x || 0) * 0.5;
                    const predY = this.target.y + (this.target.velocity?.y || 0) * 0.5;
                    
                    // Lava pool persists as AOE
                    this.spawnLightningZone(predX, predY, 0.6, 60); // Using lightning zone system for timing
                    
                    if (this.patternData.pools >= 10) {
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== SPIDER QUEEN UNIQUE PATTERNS ==========
            
            case 'webTrap':
                // Create sticky web zones around arena
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.webs = this.patternData.webs || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.3) {
                    this.patternData.timer = 0;
                    this.patternData.webs++;
                    
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 80 + Math.random() * 120;
                    this.pendingAttack = {
                        type: 'aoe',
                        damage: this.damage * 0.3,
                        x: this.target.x + Math.cos(angle) * dist,
                        y: this.target.y + Math.sin(angle) * dist,
                        targetX: this.target.x + Math.cos(angle) * dist,
                        targetY: this.target.y + Math.sin(angle) * dist,
                        radius: 50,
                        duration: 3,
                        element: 'poison',
                        effects: [{ type: 'slow', amount: 0.5, duration: 2 }],
                        owner: this
                    };
                    
                    if (this.patternData.webs >= 6) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'venomSpray':
                // Spray poison in fan pattern
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.sprays = this.patternData.sprays || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.sprays++;
                    
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    const spread = (this.patternData.sprays % 2 === 0 ? 1 : -1) * 0.3;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.3,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(baseAngle + spread) * 250,
                        targetY: this.y + Math.sin(baseAngle + spread) * 250,
                        speed: 350,
                        element: 'poison',
                        effects: [{ type: 'poison', damage: 5, duration: 3 }],
                        owner: this
                    };
                    
                    if (this.patternData.sprays >= 20) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'spiderSwarm':
                // Spawn many small tracking orbs
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    
                    for (let i = 0; i < 8; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 50 + Math.random() * 50;
                        this.trackingOrbs.push({
                            x: this.x + Math.cos(angle) * dist,
                            y: this.y + Math.sin(angle) * dist,
                            speed: 100 + Math.random() * 50,
                            damage: this.damage * 0.25,
                            timer: 6,
                            phase: 'tracking',
                            lockRadius: 25
                        });
                    }
                    this.endBossPattern();
                }
                break;
            
            case 'cocoonBomb':
                // Drop cocoons that explode after delay
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.cocoons = 0;
                    this.patternData.cocoonPositions = [];
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Place cocoons around arena
                    if (this.patternData.timer > 0.25 && this.patternData.cocoons < 6) {
                        this.patternData.timer = 0;
                        this.patternData.cocoons++;
                        
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 60 + Math.random() * 100;
                        this.patternData.cocoonPositions.push({
                            x: this.target.x + Math.cos(angle) * dist,
                            y: this.target.y + Math.sin(angle) * dist,
                            timer: 1.5
                        });
                    }
                    
                    // Update and explode cocoons
                    for (let cocoon of this.patternData.cocoonPositions) {
                        cocoon.timer -= dt;
                        if (cocoon.timer <= 0 && !cocoon.exploded) {
                            cocoon.exploded = true;
                            
                            // Explosion + poison projectiles
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.5,
                                x: cocoon.x,
                                y: cocoon.y,
                                targetX: cocoon.x,
                                targetY: cocoon.y,
                                radius: 60,
                                element: 'poison',
                                owner: this
                            };
                            
                            for (let i = 0; i < 6; i++) {
                                const angle = (i / 6) * Math.PI * 2;
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.2,
                                    x: cocoon.x,
                                    y: cocoon.y,
                                    targetX: cocoon.x + Math.cos(angle) * 200,
                                    targetY: cocoon.y + Math.sin(angle) * 200,
                                    speed: 200,
                                    element: 'poison',
                                    owner: this
                                };
                            }
                        }
                    }
                    
                    // Check if all exploded
                    if (this.patternData.cocoonPositions.filter(c => c.exploded).length >= 6) {
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'silkLine':
                // Fire web lines that connect and trap player
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.lines = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.12) {
                        this.patternData.timer = 0;
                        this.patternData.lines++;
                        
                        // Fire crossing web projectiles
                        const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                        const offset = (this.patternData.lines % 2 === 0 ? 1 : -1) * 0.4;
                        
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(baseAngle + offset) * 350,
                            targetY: this.y + Math.sin(baseAngle + offset) * 350,
                            speed: 320,
                            element: 'poison',
                            effects: [{ type: 'slow', amount: 0.6, duration: 1.5 }],
                            owner: this
                        };
                        
                        if (this.patternData.lines >= 16) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'toxicBurst':
                // Poison explosion that leaves lingering clouds
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 100;
                    this.telegraphColor = 'rgba(100, 200, 50, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.7) {
                        this.showTelegraph = false;
                        
                        // Central toxic explosion
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.6,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 100,
                            element: 'poison',
                            effects: [{ type: 'poison', damage: 8, duration: 4 }],
                            owner: this
                        };
                        
                        // Spread poison clouds
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            const dist = 80;
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.3,
                                x: this.x + Math.cos(angle) * dist,
                                y: this.y + Math.sin(angle) * dist,
                                targetX: this.x + Math.cos(angle) * dist,
                                targetY: this.y + Math.sin(angle) * dist,
                                radius: 40,
                                duration: 2,
                                element: 'poison',
                                owner: this
                            };
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== ARCHANGEL UNIQUE PATTERNS ==========
            
            case 'holyRain':
                // Rain of holy light
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.beams = this.patternData.beams || 0;
                
                // Float around
                if (this.target) {
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
                    this.velocity.x = Math.cos(angle) * this.maxSpeed * 0.6;
                    this.velocity.y = Math.sin(angle) * this.maxSpeed * 0.6;
                }
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.beams++;
                    
                    const offsetX = (Math.random() - 0.5) * 200;
                    const offsetY = (Math.random() - 0.5) * 200;
                    
                    this.pendingAttack = {
                        type: 'aoe',
                        damage: this.damage * 0.4,
                        x: this.target.x + offsetX,
                        y: this.target.y + offsetY,
                        targetX: this.target.x + offsetX,
                        targetY: this.target.y + offsetY,
                        radius: 40,
                        element: 'holy',
                        owner: this
                    };
                    
                    if (this.patternData.beams >= 18) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'divineBeam':
                // Charge up then fire massive beam
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.8) {
                        // Fire beam
                        for (let i = 0; i < 30; i++) {
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.x + Math.cos(this.patternData.targetAngle) * (i * 15),
                                y: this.y + Math.sin(this.patternData.targetAngle) * (i * 15),
                                targetX: this.x + Math.cos(this.patternData.targetAngle) * 600,
                                targetY: this.y + Math.sin(this.patternData.targetAngle) * 600,
                                speed: 500,
                                element: 'holy',
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'purifyingLight':
                // Expanding rings of holy damage
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.rings = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.4) {
                        this.patternData.timer = 0;
                        this.patternData.rings++;
                        
                        const projectiles = 16;
                        for (let i = 0; i < projectiles; i++) {
                            const angle = (i / projectiles) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.35,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 400,
                                targetY: this.y + Math.sin(angle) * 400,
                                speed: 200,
                                element: 'holy',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.rings >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'lightPillars':
                // Create pillars of light that descend from above
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.pillars = 0;
                    this.patternData.pillarPositions = [];
                    
                    // Pre-calculate pillar positions in a pattern around player
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        const dist = 80 + Math.random() * 60;
                        this.patternData.pillarPositions.push({
                            x: this.target.x + Math.cos(angle) * dist,
                            y: this.target.y + Math.sin(angle) * dist,
                            delay: i * 0.15
                        });
                    }
                    // Add center pillar
                    this.patternData.pillarPositions.push({
                        x: this.target.x,
                        y: this.target.y,
                        delay: 1.2
                    });
                    
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Spawn pillars at their designated times
                    for (const pillar of this.patternData.pillarPositions) {
                        if (!pillar.spawned && this.patternData.timer >= pillar.delay) {
                            pillar.spawned = true;
                            
                            // Telegraph circle
                            this.spawnLightningZone(pillar.x, pillar.y, 0.6, 45);
                        }
                    }
                    
                    if (this.patternData.timer > 2) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'orbGridStrike':
                // Create light orbs in grid, then fire beams between adjacent orbs
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.orbs = [];
                    this.patternData.orbsPlaced = 0;
                    
                    // Create grid of orb positions (3x3, 4x4, or cross patterns)
                    const gridType = Math.floor(Math.random() * 3);
                    const centerX = this.target.x;
                    const centerY = this.target.y;
                    const spacing = 80;
                    
                    if (gridType === 0) {
                        // 3x3 grid
                        for (let gx = -1; gx <= 1; gx++) {
                            for (let gy = -1; gy <= 1; gy++) {
                                this.patternData.orbs.push({
                                    x: centerX + gx * spacing,
                                    y: centerY + gy * spacing,
                                    gx, gy, active: false
                                });
                            }
                        }
                    } else if (gridType === 1) {
                        // Cross pattern
                        const positions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]];
                        for (const [gx, gy] of positions) {
                            this.patternData.orbs.push({
                                x: centerX + gx * spacing,
                                y: centerY + gy * spacing,
                                gx, gy, active: false
                            });
                        }
                    } else {
                        // Diamond pattern
                        const positions = [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0]];
                        for (const [gx, gy] of positions) {
                            this.patternData.orbs.push({
                                x: centerX + gx * spacing * 0.7,
                                y: centerY + gy * spacing * 0.7,
                                gx, gy, active: false
                            });
                        }
                    }
                    
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Place orbs one by one
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.12 && this.patternData.orbsPlaced < this.patternData.orbs.length) {
                        this.patternData.timer = 0;
                        const orb = this.patternData.orbs[this.patternData.orbsPlaced];
                        orb.active = true;
                        this.patternData.orbsPlaced++;
                        
                        // Visual indicator - spawn small AOE to show orb position
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: 0, // Just visual
                            x: orb.x,
                            y: orb.y,
                            targetX: orb.x,
                            targetY: orb.y,
                            radius: 15,
                            duration: 1.5,
                            element: 'holy',
                            owner: this
                        };
                    }
                    
                    if (this.patternData.orbsPlaced >= this.patternData.orbs.length) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                    }
                } else if (this.patternStep === 2) {
                    // Wait then fire beams between adjacent orbs
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.5) {
                        // Fire beams between all adjacent orbs (within range)
                        for (let i = 0; i < this.patternData.orbs.length; i++) {
                            for (let j = i + 1; j < this.patternData.orbs.length; j++) {
                                const orb1 = this.patternData.orbs[i];
                                const orb2 = this.patternData.orbs[j];
                                const dist = Math.sqrt((orb2.x - orb1.x) ** 2 + (orb2.y - orb1.y) ** 2);
                                
                                // Only connect adjacent orbs (within ~100 units)
                                if (dist < 120) {
                                    // Fire beam from orb1 to orb2
                                    const steps = Math.ceil(dist / 20);
                                    for (let s = 0; s < steps; s++) {
                                        const t = s / steps;
                                        this.pendingAttack = {
                                            type: 'projectile',
                                            damage: this.damage * 0.2,
                                            x: orb1.x + (orb2.x - orb1.x) * t,
                                            y: orb1.y + (orb2.y - orb1.y) * t,
                                            targetX: orb2.x + (orb2.x - orb1.x) * 0.1,
                                            targetY: orb2.y + (orb2.y - orb1.y) * 0.1,
                                            speed: 50,
                                            element: 'holy',
                                            width: 12,
                                            height: 12,
                                            owner: this
                                        };
                                    }
                                }
                            }
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'celestialCross':
                // Fire beams in + and X patterns alternating
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.phase = this.patternData.phase || 0;
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // Alternate between + and X
                    const offset = (this.patternData.phase % 2 === 0) ? 0 : Math.PI / 4;
                    
                    for (let i = 0; i < 4; i++) {
                        const angle = (i / 4) * Math.PI * 2 + offset;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 400,
                            targetY: this.y + Math.sin(angle) * 400,
                            speed: 350,
                            element: 'holy',
                            owner: this
                        };
                    }
                    
                    if (this.patternData.shots % 4 === 0) {
                        this.patternData.phase++;
                    }
                    
                    if (this.patternData.shots >= 20) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'angelicDescent':
                // Float up, then slam down with holy explosion
                if (this.patternStep === 0) {
                    this.patternData.startY = this.y;
                    this.patternData.timer = 0;
                    this.velocity.x = 0;
                    this.velocity.y = -100; // Float up
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Rain holy projectiles while ascending
                    if (this.patternData.timer > 0.2) {
                        this.patternData.timer = 0;
                        const targetX = this.target.x + (Math.random() - 0.5) * 150;
                        const targetY = this.target.y + (Math.random() - 0.5) * 150;
                        
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: targetX,
                            y: this.y - 100,
                            targetX: targetX,
                            targetY: targetY + 200,
                            speed: 400,
                            element: 'holy',
                            owner: this
                        };
                    }
                    
                    if (this.y < this.patternData.startY - 80) {
                        this.patternStep = 2;
                        this.patternData.timer = 0;
                        this.patternData.slamTarget = { x: this.target.x, y: this.target.y };
                        this.showTelegraph = true;
                        this.telegraphRadius = 120;
                        this.telegraphColor = 'rgba(255, 255, 200, 0.4)';
                    }
                } else if (this.patternStep === 2) {
                    this.patternData.timer += dt;
                    
                    // Slam down after brief pause
                    if (this.patternData.timer > 0.4) {
                        this.x = this.patternData.slamTarget.x;
                        this.y = this.patternData.slamTarget.y;
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                        this.showTelegraph = false;
                        
                        // Holy explosion
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 1.2,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 120,
                            element: 'holy',
                            owner: this
                        };
                        
                        // Radiant burst
                        for (let i = 0; i < 12; i++) {
                            const angle = (i / 12) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 300,
                                targetY: this.y + Math.sin(angle) * 300,
                                speed: 250,
                                element: 'holy',
                                owner: this
                            };
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'radiantNova':
                // Expanding waves of holy light
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 50;
                    this.telegraphColor = 'rgba(255, 255, 150, 0.3)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Expanding telegraph
                    this.telegraphRadius = 50 + this.patternData.waves * 70;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // Create ring of projectiles at current radius
                        const radius = 50 + this.patternData.waves * 70;
                        const count = 8 + this.patternData.waves * 4;
                        
                        // Use pendingAttacks array for all projectiles
                        if (!this.pendingAttacks) this.pendingAttacks = [];
                        
                        for (let i = 0; i < count; i++) {
                            const angle = (i / count) * Math.PI * 2 + (this.patternData.waves % 2) * (Math.PI / count);
                            this.pendingAttacks.push({
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 400,
                                targetY: this.y + Math.sin(angle) * 400,
                                speed: 180 + this.patternData.waves * 30,
                                element: 'holy',
                                owner: this
                            });
                        }
                        
                        if (this.patternData.waves >= 5) {
                            this.showTelegraph = false;
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            // ========== MASTER AI UNIQUE PATTERNS ==========
            
            case 'laserGrid':
                // Create grid of lasers
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    if (this.patternData.timer > 0.3) {
                        // Use pendingAttacks array for all lasers
                        if (!this.pendingAttacks) this.pendingAttacks = [];
                        
                        // Horizontal lasers
                        for (let i = -3; i <= 3; i++) {
                            this.pendingAttacks.push({
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.x - 300,
                                y: this.y + i * 60,
                                targetX: this.x + 300,
                                targetY: this.y + i * 60,
                                speed: 400,
                                element: 'electric',
                                owner: this
                            });
                        }
                        // Vertical lasers
                        for (let i = -3; i <= 3; i++) {
                            this.pendingAttacks.push({
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.x + i * 60,
                                y: this.y - 300,
                                targetX: this.x + i * 60,
                                targetY: this.y + 300,
                                speed: 400,
                                element: 'electric',
                                owner: this
                            });
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'droneSwarm':
                // Spawn tracking drones
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        this.trackingOrbs.push({
                            x: this.x + Math.cos(angle) * 80,
                            y: this.y + Math.sin(angle) * 80,
                            speed: 150,
                            damage: this.damage * 0.35,
                            timer: 5,
                            phase: 'tracking',
                            lockRadius: 40
                        });
                    }
                    this.endBossPattern();
                }
                break;
                
            case 'systemHack':
                // Dash around firing rapid shots (was teleport)
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.dashes = this.patternData.dashes || 0;
                
                // Skip if currently dashing
                if (this.isDashing) break;
                
                if (this.patternData.timer > 0.5) {
                    this.patternData.timer = 0;
                    this.patternData.dashes++;
                    
                    // Dash to random position near player
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 100 + Math.random() * 80;
                    const targetX = this.target.x + Math.cos(angle) * dist;
                    const targetY = this.target.y + Math.sin(angle) * dist;
                    
                    this.doBossDashTo(targetX, targetY, 900, true);
                    
                    // Fire burst after short delay
                    setTimeout(() => {
                        if (!this.active || !this.target) return;
                        for (let i = 0; i < 4; i++) {
                            const shotAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + (i - 1.5) * 0.2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(shotAngle) * 200,
                                targetY: this.y + Math.sin(shotAngle) * 200,
                                speed: 450,
                                element: 'electric',
                                owner: this
                            };
                        }
                    }, 150);
                    
                    if (this.patternData.dashes >= 5) {
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'dataStorm':
                // Chaotic spray of electric projectiles in all directions
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.bursts = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.05) {
                        this.patternData.timer = 0;
                        this.patternData.bursts++;
                        
                        // Random direction burst
                        for (let i = 0; i < 3; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = 250 + Math.random() * 200;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.2,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 400,
                                targetY: this.y + Math.sin(angle) * 400,
                                speed: speed,
                                element: 'electric',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.bursts >= 30) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'firewall':
                // Create wall of damage zones that closes in
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.4) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // Create ring of fire walls that shrink
                        const radius = 250 - this.patternData.waves * 35;
                        const numWalls = 12;
                        for (let i = 0; i < numWalls; i++) {
                            const angle = (i / numWalls) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.35,
                                x: this.target.x + Math.cos(angle) * radius,
                                y: this.target.y + Math.sin(angle) * radius,
                                targetX: this.target.x + Math.cos(angle) * radius,
                                targetY: this.target.y + Math.sin(angle) * radius,
                                radius: 35,
                                element: 'electric',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.waves >= 6) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'virusInfection':
                // Homing corrupted orbs that split on timer
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.viruses = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.viruses++;
                        
                        // Spawn tracking virus
                        const angle = Math.random() * Math.PI * 2;
                        this.trackingOrbs.push({
                            x: this.x + Math.cos(angle) * 40,
                            y: this.y + Math.sin(angle) * 40,
                            vx: 0,
                            vy: 0,
                            speed: 130,
                            damage: this.damage * 0.35,
                            timer: 4,
                            phase: 'tracking',
                            lockRadius: 45,
                            element: 'electric'
                        });
                        
                        // Also fire corrupted projectile
                        const angleToPlayer = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angleToPlayer + (Math.random() - 0.5)) * 300,
                            targetY: this.y + Math.sin(angleToPlayer + (Math.random() - 0.5)) * 300,
                            speed: 280,
                            element: 'electric',
                            owner: this
                        };
                        
                        if (this.patternData.viruses >= 8) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            // ========== ANCIENT GOLEM UNIQUE PATTERNS ==========
            
            case 'earthquakeWave':
                // Create shockwave lines
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.waves = this.patternData.waves || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.5) {
                    this.patternData.timer = 0;
                    this.patternData.waves++;
                    
                    // Create line of AOE towards player
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    for (let i = 1; i <= 5; i++) {
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.4,
                            x: this.x + Math.cos(angle) * (i * 60),
                            y: this.y + Math.sin(angle) * (i * 60),
                            targetX: this.x + Math.cos(angle) * (i * 60),
                            targetY: this.y + Math.sin(angle) * (i * 60),
                            radius: 50,
                            duration: 0.1 + i * 0.1,
                            element: 'earth',
                            owner: this
                        };
                    }
                    
                    if (this.patternData.waves >= 4) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'boulderToss':
                // Throw large slow projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.boulders = this.patternData.boulders || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.6) {
                    this.patternData.timer = 0;
                    this.patternData.boulders++;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 1.5,
                        x: this.x,
                        y: this.y,
                        targetX: this.target.x,
                        targetY: this.target.y,
                        speed: 200,
                        width: 40,
                        height: 40,
                        element: 'earth',
                        owner: this
                    };
                    
                    if (this.patternData.boulders >= 4) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'stoneSkin':
                // Defensive stance - heal and become invulnerable briefly
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.invulnerable = true;
                    this.invulnerabilityTime = 2;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    // Heal a bit
                    this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.01 * dt);
                    
                    if (this.patternData.timer > 2) {
                        // End with burst
                        for (let i = 0; i < 12; i++) {
                            const angle = (i / 12) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.5,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 300,
                                targetY: this.y + Math.sin(angle) * 300,
                                speed: 250,
                                element: 'earth',
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'crystalSpikes':
                // Crystal spikes erupt from ground in radial pattern
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // Expanding ring of crystal damage
                        const numSpikes = 10 + this.patternData.waves * 2;
                        const radius = 60 + this.patternData.waves * 50;
                        for (let i = 0; i < numSpikes; i++) {
                            const angle = (i / numSpikes) * Math.PI * 2;
                            const spikeX = this.x + Math.cos(angle) * radius;
                            const spikeY = this.y + Math.sin(angle) * radius;
                            
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.4,
                                x: spikeX,
                                y: spikeY,
                                targetX: spikeX,
                                targetY: spikeY,
                                radius: 30,
                                element: 'earth',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.waves >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'rockyBarrier':
                // Create protective barrier that fires projectiles
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.shots = 0;
                    this.patternData.barrierAngle = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.patternData.barrierAngle += dt * 2;
                    
                    if (this.patternData.timer > 0.2) {
                        this.patternData.timer = 0;
                        this.patternData.shots++;
                        
                        // Fire from rotating barrier positions
                        for (let i = 0; i < 4; i++) {
                            const angle = this.patternData.barrierAngle + (i / 4) * Math.PI * 2;
                            const barrierX = this.x + Math.cos(angle) * 80;
                            const barrierY = this.y + Math.sin(angle) * 80;
                            
                            // Barrier fires outward
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: barrierX,
                                y: barrierY,
                                targetX: barrierX + Math.cos(angle) * 300,
                                targetY: barrierY + Math.sin(angle) * 300,
                                speed: 220,
                                element: 'earth',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.shots >= 12) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'seismicStomp':
                // Powerful stomp creating shockwaves in all directions
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 150;
                    this.telegraphColor = 'rgba(139, 90, 43, 0.5)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.8) {
                        this.showTelegraph = false;
                        
                        // Central stomp damage
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.7,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 100,
                            element: 'earth',
                            owner: this
                        };
                        
                        // Shockwave projectiles in 8 directions
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            // Fire line of projectiles in each direction
                            for (let j = 1; j <= 4; j++) {
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.3,
                                    x: this.x + Math.cos(angle) * (j * 40),
                                    y: this.y + Math.sin(angle) * (j * 40),
                                    targetX: this.x + Math.cos(angle) * 400,
                                    targetY: this.y + Math.sin(angle) * 400,
                                    speed: 200 + j * 30,
                                    element: 'earth',
                                    owner: this
                                };
                            }
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== SKELETON KING UNIQUE PATTERNS ==========
            
            case 'boneStorm':
                // Swirling bone projectiles that spiral outward
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.bones = this.patternData.bones || 0;
                this.patternData.angle = this.patternData.angle || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.bones++;
                    this.patternData.angle += 0.3;
                    
                    // Fire spiraling bone projectile
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.35,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(this.patternData.angle) * 400,
                        targetY: this.y + Math.sin(this.patternData.angle) * 400,
                        speed: 200 + this.patternData.bones * 3,
                        element: 'dark',
                        owner: this
                    };
                    
                    if (this.patternData.bones >= 40) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'graveRise':
                // Skeleton hands emerge from ground in pattern
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // Create expanding ring of ground attacks
                        const radius = 50 + this.patternData.waves * 40;
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.4,
                                x: this.x + Math.cos(angle) * radius,
                                y: this.y + Math.sin(angle) * radius,
                                targetX: this.x + Math.cos(angle) * radius,
                                targetY: this.y + Math.sin(angle) * radius,
                                radius: 35,
                                duration: 0.3,
                                element: 'dark',
                                owner: this
                            };
                        }
                        
                        if (this.patternData.waves >= 5) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'royalExecution':
                // Dash strike with bone projectile burst
                if (this.patternStep === 0) {
                    this.patternData.timer = 0;
                    this.patternData.dashTarget = { x: this.target.x, y: this.target.y };
                    this.showTelegraph = true;
                    this.telegraphRadius = 100;
                    this.telegraphColor = 'rgba(200, 180, 140, 0.5)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    // Quick dash to player
                    const dx = this.patternData.dashTarget.x - this.x;
                    const dy = this.patternData.dashTarget.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 40) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 4;
                        this.velocity.y = (dy / len) * this.maxSpeed * 4;
                    } else {
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                        this.showTelegraph = false;
                        
                        // Melee strike
                        this.pendingAttack = {
                            type: 'melee',
                            damage: this.damage * 1.3,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            radius: 80,
                            owner: this
                        };
                        
                        // Burst of bones in all directions
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.4,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 250,
                                targetY: this.y + Math.sin(angle) * 250,
                                speed: 300,
                                element: 'dark',
                                owner: this
                            };
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'boneWall':
                // Create a wall of bones that closes in on player
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.wallAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.1) {
                        this.patternData.timer = 0;
                        
                        // Fire bones in a line perpendicular to player direction
                        const perpAngle = this.patternData.wallAngle + Math.PI / 2;
                        for (let i = -4; i <= 4; i++) {
                            const offsetX = Math.cos(perpAngle) * i * 30;
                            const offsetY = Math.sin(perpAngle) * i * 30;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.35,
                                x: this.x + offsetX,
                                y: this.y + offsetY,
                                targetX: this.target.x + offsetX,
                                targetY: this.target.y + offsetY,
                                speed: 280,
                                element: 'dark',
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'skeletonRush':
                // Dash through player leaving bone projectiles behind
                if (this.patternStep === 0) {
                    this.patternData.timer = 0;
                    this.patternData.startPos = { x: this.x, y: this.y };
                    const angleToPlayer = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    this.patternData.endPos = {
                        x: this.target.x + Math.cos(angleToPlayer) * 150,
                        y: this.target.y + Math.sin(angleToPlayer) * 150
                    };
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Rush towards end position
                    const dx = this.patternData.endPos.x - this.x;
                    const dy = this.patternData.endPos.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 30) {
                        this.velocity.x = (dx / dist) * this.maxSpeed * 5;
                        this.velocity.y = (dy / dist) * this.maxSpeed * 5;
                        
                        // Leave bone trail
                        if (Math.random() > 0.7) {
                            const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
                            for (let side = -1; side <= 1; side += 2) {
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.25,
                                    x: this.x,
                                    y: this.y,
                                    targetX: this.x + Math.cos(perpAngle) * side * 200,
                                    targetY: this.y + Math.sin(perpAngle) * side * 200,
                                    speed: 200,
                                    element: 'dark',
                                    owner: this
                                };
                            }
                        }
                    } else {
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'curseOfDeath':
                // Curse zone that expands and deals damage over time
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.curseX = this.target.x;
                    this.patternData.curseY = this.target.y;
                    this.patternData.waves = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 80;
                    this.telegraphColor = 'rgba(100, 0, 100, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.telegraphRadius = 80 + this.patternData.waves * 40;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // Expanding dark pulse
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.3,
                            x: this.patternData.curseX,
                            y: this.patternData.curseY,
                            targetX: this.patternData.curseX,
                            targetY: this.patternData.curseY,
                            radius: 80 + this.patternData.waves * 40,
                            element: 'dark',
                            owner: this
                        };
                        
                        if (this.patternData.waves >= 5) {
                            this.showTelegraph = false;
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            // ========== DRAGON LORD UNIQUE PATTERNS ==========
            
            case 'fireBreathSweep':
                // Sweeping fire breath attack
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = this.patternData.angle ?? Math.atan2(this.target.y - this.y, this.target.x - this.x) - Math.PI / 4;
                this.patternData.direction = this.patternData.direction || 1;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.05) {
                    this.patternData.timer = 0;
                    this.patternData.angle += 0.08 * this.patternData.direction;
                    
                    // Fire breath cone
                    for (let i = 0; i < 3; i++) {
                        const spread = (i - 1) * 0.1;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(this.patternData.angle + spread) * 300,
                            targetY: this.y + Math.sin(this.patternData.angle + spread) * 300,
                            speed: 350,
                            element: 'fire',
                            owner: this
                        };
                    }
                    
                    // Check if sweep complete
                    const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 4;
                    if (this.patternData.angle >= targetAngle) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'wingBlast':
                // Knockback wind attack + fire trails
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.showTelegraph = true;
                    this.telegraphRadius = 150;
                    this.telegraphColor = 'rgba(255, 100, 0, 0.3)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.telegraphRadius = 150 + Math.sin(this.patternData.timer * 8) * 20;
                    
                    if (this.patternData.timer > 0.8) {
                        this.showTelegraph = false;
                        
                        // Large AOE knockback
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.6,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 150,
                            knockback: 200,
                            element: 'fire',
                            owner: this
                        };
                        
                        // Fire trails in X pattern
                        for (let i = 0; i < 4; i++) {
                            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
                            for (let j = 1; j <= 4; j++) {
                                this.pendingAttack = {
                                    type: 'aoe',
                                    damage: this.damage * 0.3,
                                    x: this.x + Math.cos(angle) * (j * 50),
                                    y: this.y + Math.sin(angle) * (j * 50),
                                    targetX: this.x + Math.cos(angle) * (j * 50),
                                    targetY: this.y + Math.sin(angle) * (j * 50),
                                    radius: 30,
                                    duration: 0.1 + j * 0.15,
                                    element: 'fire',
                                    owner: this
                                };
                            }
                        }
                        
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'dragonFury':
                // Rapid fireball barrage + tail swipe
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.fireballs = this.patternData.fireballs || 0;
                
                // Strafe while firing
                if (this.target) {
                    const strafeAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
                    this.velocity.x = Math.cos(strafeAngle) * this.maxSpeed * 0.6;
                    this.velocity.y = Math.sin(strafeAngle) * this.maxSpeed * 0.6;
                }
                
                if (this.patternData.timer > 0.12) {
                    this.patternData.timer = 0;
                    this.patternData.fireballs++;
                    
                    // Fast fireballs at player
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.35,
                        x: this.x,
                        y: this.y,
                        targetX: this.target.x + (Math.random() - 0.5) * 60,
                        targetY: this.target.y + (Math.random() - 0.5) * 60,
                        speed: 400,
                        element: 'fire',
                        owner: this
                    };
                    
                    if (this.patternData.fireballs >= 15) {
                        // Tail swipe finisher
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.8,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 100,
                            element: 'fire',
                            owner: this
                        };
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'meteorRain':
                // Rain meteors from above with telegraphed landing zones
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.meteors = 0;
                    this.patternData.meteorTargets = [];
                    // Generate meteor landing positions
                    for (let i = 0; i < 12; i++) {
                        this.patternData.meteorTargets.push({
                            x: this.target.x + (Math.random() - 0.5) * 400,
                            y: this.target.y + (Math.random() - 0.5) * 400,
                            delay: i * 0.2
                        });
                    }
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Drop meteors at their scheduled times
                    for (let meteor of this.patternData.meteorTargets) {
                        if (!meteor.fired && this.patternData.timer > meteor.delay) {
                            meteor.fired = true;
                            this.patternData.meteors++;
                            
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.5,
                                x: meteor.x,
                                y: meteor.y,
                                targetX: meteor.x,
                                targetY: meteor.y,
                                radius: 60,
                                element: 'fire',
                                owner: this
                            };
                        }
                    }
                    
                    if (this.patternData.meteors >= 12) {
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'flameVortex':
                // Spinning fire tornado that follows player
                if (this.patternStep === 0) {
                    this.patternData.timer = 0;
                    this.patternData.vortexAngle = 0;
                    this.patternData.vortexX = this.x;
                    this.patternData.vortexY = this.y;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.patternData.vortexAngle += dt * 8;
                    
                    // Vortex chases player slowly
                    const dx = this.target.x - this.patternData.vortexX;
                    const dy = this.target.y - this.patternData.vortexY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 10) {
                        this.patternData.vortexX += (dx / dist) * 100 * dt;
                        this.patternData.vortexY += (dy / dist) * 100 * dt;
                    }
                    
                    // Emit spinning fire projectiles
                    if (Math.floor(this.patternData.timer * 15) > Math.floor((this.patternData.timer - dt) * 15)) {
                        for (let i = 0; i < 3; i++) {
                            const angle = this.patternData.vortexAngle + (i / 3) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: this.patternData.vortexX,
                                y: this.patternData.vortexY,
                                targetX: this.patternData.vortexX + Math.cos(angle) * 300,
                                targetY: this.patternData.vortexY + Math.sin(angle) * 300,
                                speed: 180,
                                element: 'fire',
                                owner: this
                            };
                        }
                    }
                    
                    if (this.patternData.timer > 4) {
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'dragonRoar':
                // Massive knockback cone + stun effect
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.roarAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    this.showTelegraph = true;
                    this.telegraphRadius = 200;
                    this.telegraphColor = 'rgba(255, 100, 0, 0.3)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.8) {
                        this.showTelegraph = false;
                        
                        // Fire cone of fire projectiles
                        const coneSpread = Math.PI / 3; // 60 degree cone
                        for (let i = 0; i < 15; i++) {
                            const angle = this.patternData.roarAngle + (i / 14 - 0.5) * coneSpread;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.4,
                                x: this.x,
                                y: this.y,
                                targetX: this.x + Math.cos(angle) * 400,
                                targetY: this.y + Math.sin(angle) * 400,
                                speed: 350,
                                element: 'fire',
                                owner: this
                            };
                        }
                        
                        // Central knockback AOE
                        this.pendingAttack = {
                            type: 'aoe',
                            damage: this.damage * 0.6,
                            x: this.x,
                            y: this.y,
                            targetX: this.x,
                            targetY: this.y,
                            radius: 120,
                            element: 'fire',
                            owner: this
                        };
                        
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== LICH KING UNIQUE PATTERNS ==========
            
            case 'soulDrain':
                // Beam attack that slows and damages
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.beams = this.patternData.beams || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.beams++;
                    
                    // Fast beam projectile at player
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.2,
                        x: this.x,
                        y: this.y,
                        targetX: this.target.x,
                        targetY: this.target.y,
                        speed: 500,
                        element: 'dark',
                        slow: 0.3,
                        slowDuration: 2,
                        owner: this
                    };
                    
                    if (this.patternData.beams >= 12) {
                        // Heal from "drained souls"
                        this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.03);
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'frostTomb':
                // Create ice prison around player
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.prisonX = this.target.x;
                    this.patternData.prisonY = this.target.y;
                    
                    // Create warning ring
                    this.showTelegraph = true;
                    this.telegraphRadius = 80;
                    this.telegraphColor = 'rgba(100, 200, 255, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 1) {
                        this.showTelegraph = false;
                        
                        // Ring of ice projectiles
                        for (let i = 0; i < 12; i++) {
                            const angle = (i / 12) * Math.PI * 2;
                            const radius = 100;
                            // Projectiles fly INWARD
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.patternData.prisonX + Math.cos(angle) * radius,
                                y: this.patternData.prisonY + Math.sin(angle) * radius,
                                targetX: this.patternData.prisonX,
                                targetY: this.patternData.prisonY,
                                speed: 200,
                                element: 'ice',
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'deathCoil':
                // Bouncing projectiles that home slightly
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.coils = this.patternData.coils || 0;
                
                // Back away while casting
                if (this.target) {
                    const dx = this.x - this.target.x;
                    const dy = this.y - this.target.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len < 200 && len > 0) {
                        this.velocity.x = (dx / len) * this.maxSpeed * 0.5;
                        this.velocity.y = (dy / len) * this.maxSpeed * 0.5;
                    }
                }
                
                if (this.patternData.timer > 0.25) {
                    this.patternData.timer = 0;
                    this.patternData.coils++;
                    
                    // Launch tracking orb
                    const angleToPlayer = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    const spread = (Math.random() - 0.5) * 0.5;
                    this.trackingOrbs.push({
                        x: this.x,
                        y: this.y,
                        vx: 0,
                        vy: 0,
                        speed: 180,
                        damage: this.damage * 0.4,
                        timer: 4,
                        phase: 'tracking',
                        lockRadius: 40,
                        element: 'dark'
                    });
                    
                    if (this.patternData.coils >= 6) {
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'iceSpikes':
                // Ice spikes erupt from ground in patterns
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.patternData.spikeRadius = 60;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // Expanding ring of ice spikes around player
                        const numSpikes = 8 + this.patternData.waves * 2;
                        for (let i = 0; i < numSpikes; i++) {
                            const angle = (i / numSpikes) * Math.PI * 2;
                            const spikeX = this.target.x + Math.cos(angle) * this.patternData.spikeRadius;
                            const spikeY = this.target.y + Math.sin(angle) * this.patternData.spikeRadius;
                            
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.35,
                                x: spikeX,
                                y: spikeY,
                                targetX: spikeX,
                                targetY: spikeY,
                                radius: 25,
                                element: 'ice',
                                owner: this
                            };
                        }
                        
                        this.patternData.spikeRadius += 50;
                        
                        if (this.patternData.waves >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            case 'phantomGrasp':
                // Ghostly hands reach from the ground
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.hands = 0;
                    this.patternData.handPositions = [];
                    // Generate hand positions around player
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2;
                        const dist = 80 + Math.random() * 60;
                        this.patternData.handPositions.push({
                            x: this.target.x + Math.cos(angle) * dist,
                            y: this.target.y + Math.sin(angle) * dist,
                            delay: i * 0.15,
                            fired: false
                        });
                    }
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    for (let hand of this.patternData.handPositions) {
                        if (!hand.fired && this.patternData.timer > hand.delay) {
                            hand.fired = true;
                            this.patternData.hands++;
                            
                            // Hand erupts and fires projectile toward player
                            const angleToPlayer = Math.atan2(this.target.y - hand.y, this.target.x - hand.x);
                            this.pendingAttack = {
                                type: 'aoe',
                                damage: this.damage * 0.3,
                                x: hand.x,
                                y: hand.y,
                                targetX: hand.x,
                                targetY: hand.y,
                                radius: 35,
                                element: 'dark',
                                owner: this
                            };
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: hand.x,
                                y: hand.y,
                                targetX: this.target.x,
                                targetY: this.target.y,
                                speed: 250,
                                element: 'dark',
                                owner: this
                            };
                        }
                    }
                    
                    if (this.patternData.hands >= 8) {
                        this.endBossPattern();
                    }
                }
                break;
            
            case 'necromanticRift':
                // Portal that spawns homing projectiles
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.spawns = 0;
                    this.patternData.riftX = (this.x + this.target.x) / 2;
                    this.patternData.riftY = (this.y + this.target.y) / 2;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.4) {
                        this.patternData.timer = 0;
                        this.patternData.spawns++;
                        
                        // Spawn homing dark orb from rift
                        this.trackingOrbs.push({
                            x: this.patternData.riftX + (Math.random() - 0.5) * 40,
                            y: this.patternData.riftY + (Math.random() - 0.5) * 40,
                            vx: 0,
                            vy: 0,
                            speed: 160,
                            damage: this.damage * 0.35,
                            timer: 5,
                            phase: 'tracking',
                            lockRadius: 30,
                            element: 'dark'
                        });
                        
                        // Also fire regular projectile
                        const angle = Math.random() * Math.PI * 2;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.2,
                            x: this.patternData.riftX,
                            y: this.patternData.riftY,
                            targetX: this.patternData.riftX + Math.cos(angle) * 300,
                            targetY: this.patternData.riftY + Math.sin(angle) * 300,
                            speed: 200,
                            element: 'dark',
                            owner: this
                        };
                        
                        if (this.patternData.spawns >= 8) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
            
            // NEW PROJECTILE PATTERNS
            case 'waveProjectiles':
                // Fire waves of projectiles that move in sine patterns
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.waves = this.patternData.waves || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.4) {
                    this.patternData.timer = 0;
                    this.patternData.waves++;
                    
                    // Fire a wave of 5 projectiles in an arc toward player
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    for (let i = -2; i <= 2; i++) {
                        const angle = baseAngle + i * 0.25;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.35,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 400,
                            targetY: this.y + Math.sin(angle) * 400,
                            speed: 300 + Math.abs(i) * 30,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.waves >= 5) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'scatterShot':
                // Rapid burst of random-direction projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.03) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    const spreadAngle = baseAngle + (Math.random() - 0.5) * 1.2;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.2,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(spreadAngle) * 300,
                        targetY: this.y + Math.sin(spreadAngle) * 300,
                        speed: 350 + Math.random() * 150,
                        owner: this
                    };
                    
                    if (this.patternData.shots >= 40) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'ricochetBurst':
                // Fire projectiles that create secondary projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.bursts = this.patternData.bursts || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.5) {
                    this.patternData.timer = 0;
                    this.patternData.bursts++;
                    
                    // Fire 6 projectiles in a hexagonal pattern
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.5,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 250,
                            targetY: this.y + Math.sin(angle) * 250,
                            speed: 280,
                            owner: this,
                            splits: true
                        };
                    }
                    
                    if (this.patternData.bursts >= 4) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'arcingVolley':
                // Fire arcing projectiles that fall toward player
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.volleys = this.patternData.volleys || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.6) {
                    this.patternData.timer = 0;
                    this.patternData.volleys++;
                    
                    // Fire 3 projectiles with different arcs
                    for (let i = 0; i < 3; i++) {
                        const offset = (i - 1) * 40;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.6,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x + offset,
                            targetY: this.target.y,
                            speed: 200,
                            arc: true,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.volleys >= 5) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'seekerMissiles':
                // Fire slow but homing projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.missiles = this.patternData.missiles || 0;
                
                // Move while firing
                const seekerAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.velocity.x = Math.cos(seekerAngle + Math.PI/2) * this.maxSpeed * 0.8;
                this.velocity.y = Math.sin(seekerAngle + Math.PI/2) * this.maxSpeed * 0.8;
                
                if (this.patternData.timer > 0.4) {
                    this.patternData.timer = 0;
                    this.patternData.missiles++;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.7,
                        x: this.x,
                        y: this.y,
                        targetX: this.target.x,
                        targetY: this.target.y,
                        speed: 150,
                        homing: true,
                        owner: this
                    };
                    
                    if (this.patternData.missiles >= 8) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'homingBarrage':
                // Rapid fire homing projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.shots = this.patternData.shots || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    const randomOffset = (Math.random() - 0.5) * Math.PI;
                    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x) + randomOffset;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.3,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + Math.cos(angle) * 100,
                        targetY: this.y + Math.sin(angle) * 100,
                        speed: 200,
                        homing: true,
                        owner: this
                    };
                    
                    if (this.patternData.shots >= 20) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'novaBlast':
                // Charge up then release expanding ring
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 1.5) {
                    // Release the nova
                    for (let i = 0; i < 24; i++) {
                        const angle = (i / 24) * Math.PI * 2;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.6,
                            x: this.x,
                            y: this.y,
                            targetX: this.x + Math.cos(angle) * 400,
                            targetY: this.y + Math.sin(angle) * 400,
                            speed: 400,
                            width: 16,
                            height: 16,
                            owner: this
                        };
                    }
                    this.endBossPattern();
                }
                break;
                
            case 'chainLightning':
                // Fire lightning that chains between positions
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.chains = this.patternData.chains || 0;
                
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.3) {
                    this.patternData.timer = 0;
                    this.patternData.chains++;
                    
                    // Fire toward player with chain effect
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.5,
                        x: this.x,
                        y: this.y,
                        targetX: this.target.x + (Math.random() - 0.5) * 80,
                        targetY: this.target.y + (Math.random() - 0.5) * 80,
                        speed: 500,
                        element: 'lightning',
                        owner: this
                    };
                    
                    if (this.patternData.chains >= 10) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'spinSlash':
                // Spin attack with ranged slashes
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.spins = this.patternData.spins || 0;
                this.patternData.spinAngle = (this.patternData.spinAngle || 0) + dt * 8;
                
                // Spin in place
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.2) {
                    this.patternData.timer = 0;
                    this.patternData.spins++;
                    
                    // Fire slashes in spin direction
                    for (let i = 0; i < 2; i++) {
                        const angle = this.patternData.spinAngle + i * Math.PI;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.6,
                            x: this.x + Math.cos(angle) * 40,
                            y: this.y + Math.sin(angle) * 40,
                            targetX: this.x + Math.cos(angle) * 200,
                            targetY: this.y + Math.sin(angle) * 200,
                            speed: 350,
                            width: 30,
                            height: 10,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.spins >= 12) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'annihilationBeam':
                // Powerful sustained beam attack
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.beamTimer = (this.patternData.beamTimer || 0) + dt;
                
                // Track player slowly
                const beamAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.facing.x = Math.cos(beamAngle);
                this.facing.y = Math.sin(beamAngle);
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.beamTimer > 0.05) {
                    this.patternData.beamTimer = 0;
                    
                    // Fire rapid beam projectiles
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.15,
                        x: this.x,
                        y: this.y,
                        targetX: this.x + this.facing.x * 500,
                        targetY: this.y + this.facing.y * 500,
                        speed: 600,
                        width: 20,
                        height: 20,
                        owner: this
                    };
                }
                
                if (this.patternData.timer >= 3) {
                    this.endBossPattern();
                }
                break;
                
            case 'circleDashStrike':
                // Dash in a circle around the player for style, then strike
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.phase = this.patternData.phase || 'start';
                this.patternData.circleAngle = this.patternData.circleAngle || 0;
                this.patternData.dashes = this.patternData.dashes || 0;
                
                if (this.patternData.phase === 'start') {
                    // Calculate starting angle (position relative to player)
                    const dx = this.x - this.target.x;
                    const dy = this.y - this.target.y;
                    this.patternData.circleAngle = Math.atan2(dy, dx);
                    this.patternData.circleRadius = 180; // Circle around player at this distance
                    this.patternData.phase = 'circling';
                    this.isBossDashing = true;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                } else if (this.patternData.phase === 'circling') {
                    // Dash around the player in 4-6 quick dashes
                    if (this.patternData.timer > 0.12) {
                        this.patternData.timer = 0;
                        this.patternData.dashes++;
                        
                        // Advance angle by 60-90 degrees per dash
                        this.patternData.circleAngle += (Math.PI / 3) + (Math.random() * Math.PI / 6);
                        
                        // Calculate next position on circle
                        const nextX = this.target.x + Math.cos(this.patternData.circleAngle) * this.patternData.circleRadius;
                        const nextY = this.target.y + Math.sin(this.patternData.circleAngle) * this.patternData.circleRadius;
                        
                        // Add afterimage at current position
                        this.bossDashTrail.push({
                            x: this.x,
                            y: this.y,
                            alpha: 0.8,
                            time: 0.3,
                            color: this.color
                        });
                        
                        // Teleport/dash to next position
                        this.x = nextX;
                        this.y = nextY;
                        this.playDashSound = true;
                        
                        // Face the player during circling
                        const toPlayerAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                        this.facing.x = Math.cos(toPlayerAngle);
                        this.facing.y = Math.sin(toPlayerAngle);
                        
                        // After 5 dashes around, prepare to strike
                        if (this.patternData.dashes >= 5) {
                            this.patternData.phase = 'windUp';
                            this.patternData.timer = 0;
                        }
                    }
                } else if (this.patternData.phase === 'windUp') {
                    // Brief pause before striking - telegraph
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    
                    if (this.patternData.timer > 0.25) {
                        this.patternData.phase = 'strike';
                        this.patternData.timer = 0;
                        // Lock target position
                        this.patternData.strikeTarget = { x: this.target.x, y: this.target.y };
                    }
                } else if (this.patternData.phase === 'strike') {
                    // Dash directly at the player
                    const dx = this.patternData.strikeTarget.x - this.x;
                    const dy = this.patternData.strikeTarget.y - this.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len > 30) {
                        // Super fast dash towards player
                        this.velocity.x = (dx / len) * this.maxSpeed * 10;
                        this.velocity.y = (dy / len) * this.maxSpeed * 10;
                        this.facing.x = dx / len;
                        this.facing.y = dy / len;
                        
                        // Trail effect during strike dash
                        if (Math.random() < 0.6) {
                            this.bossDashTrail.push({
                                x: this.x,
                                y: this.y,
                                alpha: 0.5,
                                time: 0.2,
                                color: '#ff4444'
                            });
                        }
                    } else {
                        // Arrived - powerful melee strike with knockback
                        this.pendingAttack = {
                            type: 'melee',
                            damage: this.damage * 1.8,
                            x: this.x,
                            y: this.y,
                            targetX: this.target.x,
                            targetY: this.target.y,
                            range: 80,
                            knockback: 200,
                            owner: this
                        };
                        this.isBossDashing = false;
                        this.endBossPattern();
                    }
                }
                break;
            
            // ========== NEW CREATIVE SPAWN PATTERNS ==========
            // Projectiles that spawn from walls, floor, ceiling, geometric shapes
            
            case 'wallBarrage':
                // Projectiles spawn from all four walls and fire inward
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.waves = this.patternData.waves || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.4) {
                    this.patternData.timer = 0;
                    this.patternData.waves++;
                    
                    const roomWidth = 600;
                    const roomHeight = 450;
                    const centerX = this.target.x;
                    const centerY = this.target.y;
                    
                    // Spawn from each wall
                    for (let i = 0; i < 5; i++) {
                        const offset = (i - 2) * 60;
                        // Top wall
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: centerX + offset, y: centerY - roomHeight/2,
                            targetX: centerX + offset, targetY: centerY,
                            speed: 300, owner: this
                        };
                        // Bottom wall
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: centerX + offset, y: centerY + roomHeight/2,
                            targetX: centerX + offset, targetY: centerY,
                            speed: 300, owner: this
                        };
                        // Left wall
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: centerX - roomWidth/2, y: centerY + offset,
                            targetX: centerX, targetY: centerY + offset,
                            speed: 300, owner: this
                        };
                        // Right wall
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.3,
                            x: centerX + roomWidth/2, y: centerY + offset,
                            targetX: centerX, targetY: centerY + offset,
                            speed: 300, owner: this
                        };
                    }
                    
                    if (this.patternData.waves >= 4) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'ceilingRain':
                // Projectiles rain down from above in waves
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.drops = this.patternData.drops || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.drops++;
                    
                    // Random x position above player area
                    const spawnX = this.target.x + (Math.random() - 0.5) * 400;
                    const spawnY = this.target.y - 300;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.25,
                        x: spawnX, y: spawnY,
                        targetX: spawnX, targetY: spawnY + 600,
                        speed: 350 + Math.random() * 150,
                        owner: this
                    };
                    
                    if (this.patternData.drops >= 50) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'floorEruption':
                // Projectiles erupt from ground in lines
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.lines = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.lines++;
                        
                        // Line of eruptions from boss toward player
                        const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                        for (let i = 1; i <= 8; i++) {
                            const dist = i * 50;
                            const eruptX = this.x + Math.cos(angle) * dist;
                            const eruptY = this.y + Math.sin(angle) * dist;
                            
                            // Projectile shoots upward from that point
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.35,
                                x: eruptX, y: eruptY + 20,
                                targetX: eruptX + (Math.random() - 0.5) * 60,
                                targetY: eruptY - 150,
                                speed: 250,
                                owner: this
                            };
                        }
                        
                        if (this.patternData.lines >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'pentagramStrike':
                // Create a pentagram with projectiles at each point firing at player
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.points = [];
                    
                    // Calculate pentagram points around player
                    for (let i = 0; i < 5; i++) {
                        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
                        this.patternData.points.push({
                            x: this.target.x + Math.cos(angle) * 180,
                            y: this.target.y + Math.sin(angle) * 180
                        });
                    }
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.8) {
                        // Fire from all 5 points toward player
                        for (const point of this.patternData.points) {
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.5,
                                x: point.x, y: point.y,
                                targetX: this.target.x,
                                targetY: this.target.y,
                                speed: 400,
                                owner: this
                            };
                        }
                        // Also draw lines between points
                        for (let i = 0; i < 5; i++) {
                            const p1 = this.patternData.points[i];
                            const p2 = this.patternData.points[(i + 2) % 5];
                            const steps = 5;
                            for (let s = 0; s < steps; s++) {
                                const t = s / steps;
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.2,
                                    x: p1.x + (p2.x - p1.x) * t,
                                    y: p1.y + (p2.y - p1.y) * t,
                                    targetX: this.target.x,
                                    targetY: this.target.y,
                                    speed: 200 + s * 40,
                                    owner: this
                                };
                            }
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'hexagonalGrid':
                // Hexagonal grid of projectiles forms then collapses
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.hexPoints = [];
                    
                    // Generate hexagonal grid around player
                    const rings = 3;
                    const spacing = 70;
                    this.patternData.hexPoints.push({x: this.target.x, y: this.target.y});
                    
                    for (let ring = 1; ring <= rings; ring++) {
                        for (let i = 0; i < 6 * ring; i++) {
                            const segment = Math.floor(i / ring);
                            const offset = i % ring;
                            const angle = segment * Math.PI / 3;
                            const cornerX = this.target.x + Math.cos(angle) * spacing * ring;
                            const cornerY = this.target.y + Math.sin(angle) * spacing * ring;
                            const nextAngle = (segment + 1) * Math.PI / 3;
                            const nextX = this.target.x + Math.cos(nextAngle) * spacing * ring;
                            const nextY = this.target.y + Math.sin(nextAngle) * spacing * ring;
                            const t = offset / ring;
                            this.patternData.hexPoints.push({
                                x: cornerX + (nextX - cornerX) * t,
                                y: cornerY + (nextY - cornerY) * t
                            });
                        }
                    }
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 1.2) {
                        // Fire all hex points toward player
                        for (const point of this.patternData.hexPoints) {
                            const dist = Math.sqrt((point.x - this.target.x)**2 + (point.y - this.target.y)**2);
                            if (dist > 20) { // Skip center point
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.25,
                                    x: point.x, y: point.y,
                                    targetX: this.target.x,
                                    targetY: this.target.y,
                                    speed: 280,
                                    owner: this
                                };
                            }
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'spiralGalaxy':
                // Two spiral arms of projectiles rotating outward
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = (this.patternData.angle || 0);
                this.patternData.shots = this.patternData.shots || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.04) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    this.patternData.angle += 0.12;
                    
                    // Two spiral arms
                    for (let arm = 0; arm < 2; arm++) {
                        const armAngle = this.patternData.angle + arm * Math.PI;
                        const spawnDist = 40 + this.patternData.shots * 2;
                        const spawnX = this.x + Math.cos(armAngle) * spawnDist;
                        const spawnY = this.y + Math.sin(armAngle) * spawnDist;
                        
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.2,
                            x: spawnX, y: spawnY,
                            targetX: spawnX + Math.cos(armAngle) * 200,
                            targetY: spawnY + Math.sin(armAngle) * 200,
                            speed: 180,
                            owner: this
                        };
                    }
                    
                    if (this.patternData.shots >= 80) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'cornerTrap':
                // Projectiles spawn from corners and converge on player
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.5) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        // 4 corners around player
                        const corners = [
                            {x: this.target.x - 250, y: this.target.y - 200},
                            {x: this.target.x + 250, y: this.target.y - 200},
                            {x: this.target.x - 250, y: this.target.y + 200},
                            {x: this.target.x + 250, y: this.target.y + 200}
                        ];
                        
                        for (const corner of corners) {
                            // Fan of projectiles from each corner
                            for (let i = 0; i < 3; i++) {
                                const spread = (i - 1) * 0.15;
                                const angle = Math.atan2(this.target.y - corner.y, this.target.x - corner.x) + spread;
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.3,
                                    x: corner.x, y: corner.y,
                                    targetX: corner.x + Math.cos(angle) * 400,
                                    targetY: corner.y + Math.sin(angle) * 400,
                                    speed: 350,
                                    owner: this
                                };
                            }
                        }
                        
                        if (this.patternData.waves >= 5) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'zigzagVolley':
                // Projectiles that move in zigzag patterns
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.volleys = this.patternData.volleys || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.volleys++;
                    
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    const zigzag = Math.sin(this.patternData.volleys * 0.5) * 0.4;
                    
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.35,
                        x: this.x, y: this.y,
                        targetX: this.x + Math.cos(baseAngle + zigzag) * 400,
                        targetY: this.y + Math.sin(baseAngle + zigzag) * 400,
                        speed: 320,
                        owner: this
                    };
                    
                    if (this.patternData.volleys >= 25) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'orbitalBombardment':
                // Projectiles orbit boss then launch outward
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.orbiters = [];
                    
                    // Create orbiting projectiles
                    for (let i = 0; i < 12; i++) {
                        this.patternData.orbiters.push({
                            angle: (i / 12) * Math.PI * 2,
                            radius: 100,
                            launched: false
                        });
                    }
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    // Orbit phase - rotate projectiles
                    for (const orb of this.patternData.orbiters) {
                        orb.angle += dt * 4;
                    }
                    
                    if (this.patternData.timer > 1.5) {
                        // Launch all toward player!
                        for (const orb of this.patternData.orbiters) {
                            if (!orb.launched) {
                                orb.launched = true;
                                const orbX = this.x + Math.cos(orb.angle) * orb.radius;
                                const orbY = this.y + Math.sin(orb.angle) * orb.radius;
                                
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.4,
                                    x: orbX, y: orbY,
                                    targetX: this.target.x,
                                    targetY: this.target.y,
                                    speed: 400,
                                    owner: this
                                };
                            }
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'convergeExpand':
                // Projectiles converge to point then explode outward
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.centerX = (this.x + this.target.x) / 2;
                    this.patternData.centerY = (this.y + this.target.y) / 2;
                    
                    // Fire converging projectiles
                    for (let i = 0; i < 16; i++) {
                        const angle = (i / 16) * Math.PI * 2;
                        const spawnDist = 200;
                        this.pendingAttack = {
                            type: 'projectile',
                            damage: this.damage * 0.25,
                            x: this.patternData.centerX + Math.cos(angle) * spawnDist,
                            y: this.patternData.centerY + Math.sin(angle) * spawnDist,
                            targetX: this.patternData.centerX,
                            targetY: this.patternData.centerY,
                            speed: 200,
                            owner: this
                        };
                    }
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 1.0) {
                        // Explosion outward from center
                        for (let i = 0; i < 24; i++) {
                            const angle = (i / 24) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.3,
                                x: this.patternData.centerX,
                                y: this.patternData.centerY,
                                targetX: this.patternData.centerX + Math.cos(angle) * 400,
                                targetY: this.patternData.centerY + Math.sin(angle) * 400,
                                speed: 350,
                                owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'diamondCage':
                // Diamond shape forms around player then fires inward
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.fired = false;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 1.0 && !this.patternData.fired) {
                        this.patternData.fired = true;
                        
                        // Diamond points
                        const dist = 180;
                        const points = [
                            {x: this.target.x, y: this.target.y - dist}, // Top
                            {x: this.target.x + dist, y: this.target.y}, // Right
                            {x: this.target.x, y: this.target.y + dist}, // Bottom
                            {x: this.target.x - dist, y: this.target.y}  // Left
                        ];
                        
                        // Fire from each edge of diamond
                        for (let i = 0; i < 4; i++) {
                            const p1 = points[i];
                            const p2 = points[(i + 1) % 4];
                            for (let t = 0; t <= 1; t += 0.2) {
                                const px = p1.x + (p2.x - p1.x) * t;
                                const py = p1.y + (p2.y - p1.y) * t;
                                this.pendingAttack = {
                                    type: 'projectile',
                                    damage: this.damage * 0.3,
                                    x: px, y: py,
                                    targetX: this.target.x,
                                    targetY: this.target.y,
                                    speed: 300,
                                    owner: this
                                };
                            }
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'starBurst':
                // 8-pointed star pattern radiating from boss
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.bursts = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.2) {
                        this.patternData.timer = 0;
                        this.patternData.bursts++;
                        
                        // 8 directions + 8 diagonal for star effect
                        for (let i = 0; i < 16; i++) {
                            const angle = (i / 16) * Math.PI * 2;
                            // Alternate long/short rays for star shape
                            const rayLength = i % 2 === 0 ? 400 : 250;
                            const speed = i % 2 === 0 ? 350 : 250;
                            
                            this.pendingAttack = {
                                type: 'projectile',
                                damage: this.damage * 0.25,
                                x: this.x, y: this.y,
                                targetX: this.x + Math.cos(angle) * rayLength,
                                targetY: this.y + Math.sin(angle) * rayLength,
                                speed: speed,
                                owner: this
                            };
                        }
                        
                        if (this.patternData.bursts >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'crossfireTrap':
                // Projectiles from left/right then top/bottom in sequence
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.phase = 'horizontal';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.6) {
                        this.patternData.timer = 0;
                        
                        if (this.patternData.phase === 'horizontal') {
                            // Fire from left and right
                            for (let i = 0; i < 8; i++) {
                                const offset = (i - 3.5) * 30;
                                // From left
                                this.pendingAttack = {
                                    type: 'projectile', damage: this.damage * 0.3,
                                    x: this.target.x - 300, y: this.target.y + offset,
                                    targetX: this.target.x + 300, targetY: this.target.y + offset,
                                    speed: 400, owner: this
                                };
                                // From right
                                this.pendingAttack = {
                                    type: 'projectile', damage: this.damage * 0.3,
                                    x: this.target.x + 300, y: this.target.y + offset,
                                    targetX: this.target.x - 300, targetY: this.target.y + offset,
                                    speed: 400, owner: this
                                };
                            }
                            this.patternData.phase = 'vertical';
                        } else {
                            // Fire from top and bottom
                            for (let i = 0; i < 8; i++) {
                                const offset = (i - 3.5) * 30;
                                // From top
                                this.pendingAttack = {
                                    type: 'projectile', damage: this.damage * 0.3,
                                    x: this.target.x + offset, y: this.target.y - 250,
                                    targetX: this.target.x + offset, targetY: this.target.y + 250,
                                    speed: 400, owner: this
                                };
                                // From bottom
                                this.pendingAttack = {
                                    type: 'projectile', damage: this.damage * 0.3,
                                    x: this.target.x + offset, y: this.target.y + 250,
                                    targetX: this.target.x + offset, targetY: this.target.y - 250,
                                    speed: 400, owner: this
                                };
                            }
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'clockworkSpiral':
                // Clock-like spiral with projectiles at "hours"
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.hour = this.patternData.hour || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.15) {
                    this.patternData.timer = 0;
                    this.patternData.hour++;
                    
                    const hourAngle = ((this.patternData.hour % 12) / 12) * Math.PI * 2 - Math.PI / 2;
                    const handLength = 150;
                    const handEndX = this.x + Math.cos(hourAngle) * handLength;
                    const handEndY = this.y + Math.sin(hourAngle) * handLength;
                    
                    // Fire from hand end toward player
                    this.pendingAttack = {
                        type: 'projectile',
                        damage: this.damage * 0.35,
                        x: handEndX, y: handEndY,
                        targetX: this.target.x,
                        targetY: this.target.y,
                        speed: 350,
                        owner: this
                    };
                    
                    if (this.patternData.hour >= 36) { // 3 full rotations
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'mirrorImage':
                // Projectiles from boss mirrored on opposite side
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.shots = this.patternData.shots || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.12) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                    const spread = (Math.random() - 0.5) * 0.6;
                    
                    // Original shot
                    this.pendingAttack = {
                        type: 'projectile', damage: this.damage * 0.3,
                        x: this.x, y: this.y,
                        targetX: this.x + Math.cos(baseAngle + spread) * 300,
                        targetY: this.y + Math.sin(baseAngle + spread) * 300,
                        speed: 300, owner: this
                    };
                    
                    // Mirror shot from opposite side
                    const mirrorX = this.target.x * 2 - this.x;
                    const mirrorY = this.target.y * 2 - this.y;
                    const mirrorAngle = Math.atan2(this.target.y - mirrorY, this.target.x - mirrorX);
                    
                    this.pendingAttack = {
                        type: 'projectile', damage: this.damage * 0.3,
                        x: mirrorX, y: mirrorY,
                        targetX: mirrorX + Math.cos(mirrorAngle + spread) * 300,
                        targetY: mirrorY + Math.sin(mirrorAngle + spread) * 300,
                        speed: 300, owner: this
                    };
                    
                    if (this.patternData.shots >= 20) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'pulseWave':
                // Expanding pulse rings from boss
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.pulses = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.4) {
                        this.patternData.timer = 0;
                        this.patternData.pulses++;
                        
                        // Expanding ring of projectiles
                        const count = 16 + this.patternData.pulses * 4;
                        const rotOffset = this.patternData.pulses * 0.1;
                        
                        for (let i = 0; i < count; i++) {
                            const angle = (i / count) * Math.PI * 2 + rotOffset;
                            this.pendingAttack = {
                                type: 'projectile', damage: this.damage * 0.25,
                                x: this.x, y: this.y,
                                targetX: this.x + Math.cos(angle) * 400,
                                targetY: this.y + Math.sin(angle) * 400,
                                speed: 200 + this.patternData.pulses * 30,
                                owner: this
                            };
                        }
                        
                        if (this.patternData.pulses >= 5) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'snakePattern':
                // Wavy snake-like stream of projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.segments = this.patternData.segments || 0;
                this.patternData.baseAngle = this.patternData.baseAngle ?? Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.06) {
                    this.patternData.timer = 0;
                    this.patternData.segments++;
                    
                    const wave = Math.sin(this.patternData.segments * 0.3) * 0.5;
                    const angle = this.patternData.baseAngle + wave;
                    
                    this.pendingAttack = {
                        type: 'projectile', damage: this.damage * 0.25,
                        x: this.x, y: this.y,
                        targetX: this.x + Math.cos(angle) * 400,
                        targetY: this.y + Math.sin(angle) * 400,
                        speed: 280, owner: this
                    };
                    
                    if (this.patternData.segments >= 50) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'vortexSuck':
                // Create vortex at player position that pulls then explodes
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.vortexX = this.target.x;
                    this.patternData.vortexY = this.target.y;
                    this.showTelegraph = true;
                    this.telegraphRadius = 100;
                    this.telegraphColor = 'rgba(100, 0, 150, 0.4)';
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.telegraphRadius = 100 - this.patternData.timer * 50;
                    
                    if (this.patternData.timer > 1.5) {
                        this.showTelegraph = false;
                        
                        // Explosion from vortex center
                        for (let i = 0; i < 20; i++) {
                            const angle = (i / 20) * Math.PI * 2;
                            this.pendingAttack = {
                                type: 'projectile', damage: this.damage * 0.35,
                                x: this.patternData.vortexX,
                                y: this.patternData.vortexY,
                                targetX: this.patternData.vortexX + Math.cos(angle) * 400,
                                targetY: this.patternData.vortexY + Math.sin(angle) * 400,
                                speed: 350, owner: this
                            };
                        }
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'encircle':
                // Ring of projectiles forms around player then tightens
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.radius = 200;
                    this.patternData.waves = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.5) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        this.patternData.radius -= 30;
                        
                        // Ring of projectiles at current radius
                        for (let i = 0; i < 16; i++) {
                            const angle = (i / 16) * Math.PI * 2;
                            const spawnX = this.target.x + Math.cos(angle) * this.patternData.radius;
                            const spawnY = this.target.y + Math.sin(angle) * this.patternData.radius;
                            
                            this.pendingAttack = {
                                type: 'projectile', damage: this.damage * 0.3,
                                x: spawnX, y: spawnY,
                                targetX: this.target.x,
                                targetY: this.target.y,
                                speed: 200, owner: this
                            };
                        }
                        
                        if (this.patternData.waves >= 5 || this.patternData.radius <= 50) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'sineWave':
                // Horizontal sine wave of projectiles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.shots = this.patternData.shots || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // Fire from left, projectile moves right with sine wave Y
                    const startY = this.y + Math.sin(this.patternData.shots * 0.4) * 80;
                    
                    this.pendingAttack = {
                        type: 'projectile', damage: this.damage * 0.3,
                        x: this.x - 50, y: startY,
                        targetX: this.x + 400, targetY: startY,
                        speed: 300, owner: this
                    };
                    
                    if (this.patternData.shots >= 40) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'triangleFormation':
                // Triangle of projectiles that rotate and fire
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.rotation = 0;
                    this.patternData.volleys = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    this.patternData.rotation += dt * 2;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.volleys++;
                        
                        // Three points of triangle
                        for (let i = 0; i < 3; i++) {
                            const angle = this.patternData.rotation + (i / 3) * Math.PI * 2;
                            const pointX = this.x + Math.cos(angle) * 120;
                            const pointY = this.y + Math.sin(angle) * 120;
                            
                            // Fire toward player from each triangle point
                            const toPlayer = Math.atan2(this.target.y - pointY, this.target.x - pointX);
                            this.pendingAttack = {
                                type: 'projectile', damage: this.damage * 0.35,
                                x: pointX, y: pointY,
                                targetX: pointX + Math.cos(toPlayer) * 300,
                                targetY: pointY + Math.sin(toPlayer) * 300,
                                speed: 320, owner: this
                            };
                        }
                        
                        if (this.patternData.volleys >= 10) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'pillarsOfDoom':
                // Vertical pillars of projectiles sweep across arena
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.pillarX = this.x - 200;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.15) {
                        this.patternData.timer = 0;
                        this.patternData.pillarX += 40;
                        
                        // Vertical line of projectiles at pillarX
                        for (let i = -4; i <= 4; i++) {
                            const y = this.y + i * 40;
                            this.pendingAttack = {
                                type: 'projectile', damage: this.damage * 0.25,
                                x: this.patternData.pillarX, y: y - 200,
                                targetX: this.patternData.pillarX, targetY: y + 200,
                                speed: 350, owner: this
                            };
                        }
                        
                        if (this.patternData.pillarX > this.x + 200) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'chaosOrbs':
                // Random projectiles spawning all around
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.orbs = this.patternData.orbs || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.1) {
                    this.patternData.timer = 0;
                    this.patternData.orbs++;
                    
                    // Random spawn point around player
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const spawnDist = 150 + Math.random() * 100;
                    const spawnX = this.target.x + Math.cos(spawnAngle) * spawnDist;
                    const spawnY = this.target.y + Math.sin(spawnAngle) * spawnDist;
                    
                    // Fire toward player
                    this.pendingAttack = {
                        type: 'projectile', damage: this.damage * 0.3,
                        x: spawnX, y: spawnY,
                        targetX: this.target.x + (Math.random() - 0.5) * 60,
                        targetY: this.target.y + (Math.random() - 0.5) * 60,
                        speed: 250 + Math.random() * 150,
                        owner: this
                    };
                    
                    if (this.patternData.orbs >= 30) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'laserFence':
                // Create laser fence lines that sweep across
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.lines = 0;
                    this.patternData.horizontal = Math.random() > 0.5;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.3) {
                        this.patternData.timer = 0;
                        this.patternData.lines++;
                        
                        // Create line of projectiles
                        if (this.patternData.horizontal) {
                            const y = this.target.y + (this.patternData.lines % 2 === 0 ? -100 : 100);
                            for (let x = -250; x <= 250; x += 30) {
                                this.pendingAttack = {
                                    type: 'projectile', damage: this.damage * 0.2,
                                    x: this.target.x + x, y: y,
                                    targetX: this.target.x + x, 
                                    targetY: this.target.y + (this.patternData.lines % 2 === 0 ? 200 : -200),
                                    speed: 300, owner: this
                                };
                            }
                        } else {
                            const x = this.target.x + (this.patternData.lines % 2 === 0 ? -100 : 100);
                            for (let y = -200; y <= 200; y += 30) {
                                this.pendingAttack = {
                                    type: 'projectile', damage: this.damage * 0.2,
                                    x: x, y: this.target.y + y,
                                    targetX: this.target.x + (this.patternData.lines % 2 === 0 ? 200 : -200),
                                    targetY: this.target.y + y,
                                    speed: 300, owner: this
                                };
                            }
                        }
                        
                        if (this.patternData.lines >= 6) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'galaxyArms':
                // 4 spiral arms like a galaxy
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.angle = (this.patternData.angle || 0);
                this.patternData.shots = this.patternData.shots || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.05) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    this.patternData.angle += 0.1;
                    
                    // 4 arms
                    for (let arm = 0; arm < 4; arm++) {
                        const armAngle = this.patternData.angle + arm * Math.PI / 2;
                        this.pendingAttack = {
                            type: 'projectile', damage: this.damage * 0.2,
                            x: this.x, y: this.y,
                            targetX: this.x + Math.cos(armAngle) * 400,
                            targetY: this.y + Math.sin(armAngle) * 400,
                            speed: 220, owner: this
                        };
                    }
                    
                    if (this.patternData.shots >= 60) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'arrowRain':
                // Arrows rain from multiple angles
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.arrows = this.patternData.arrows || 0;
                this.patternData.angle = this.patternData.angle ?? -Math.PI / 4;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.arrows++;
                    
                    // Arrows come from angle above
                    const spawnDist = 300;
                    const spawnX = this.target.x + Math.cos(this.patternData.angle) * spawnDist + (Math.random() - 0.5) * 100;
                    const spawnY = this.target.y + Math.sin(this.patternData.angle) * spawnDist;
                    
                    this.pendingAttack = {
                        type: 'projectile', damage: this.damage * 0.3,
                        x: spawnX, y: spawnY,
                        targetX: this.target.x + (Math.random() - 0.5) * 80,
                        targetY: this.target.y + (Math.random() - 0.5) * 80,
                        speed: 400, owner: this
                    };
                    
                    // Slowly sweep angle
                    this.patternData.angle += 0.02;
                    
                    if (this.patternData.arrows >= 40) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'pinwheel':
                // Rotating pinwheel pattern
                this.patternData.timer = (this.patternData.timer || 0) + dt;
                this.patternData.rotation = (this.patternData.rotation || 0) + dt * 3;
                this.patternData.shots = this.patternData.shots || 0;
                this.velocity.x = 0;
                this.velocity.y = 0;
                
                if (this.patternData.timer > 0.08) {
                    this.patternData.timer = 0;
                    this.patternData.shots++;
                    
                    // 6 blades of pinwheel
                    for (let blade = 0; blade < 6; blade++) {
                        const bladeAngle = this.patternData.rotation + blade * Math.PI / 3;
                        // Each blade fires curved
                        const curveOffset = Math.sin(this.patternData.shots * 0.3) * 0.3;
                        
                        this.pendingAttack = {
                            type: 'projectile', damage: this.damage * 0.2,
                            x: this.x, y: this.y,
                            targetX: this.x + Math.cos(bladeAngle + curveOffset) * 350,
                            targetY: this.y + Math.sin(bladeAngle + curveOffset) * 350,
                            speed: 250, owner: this
                        };
                    }
                    
                    if (this.patternData.shots >= 40) {
                        this.endBossPattern();
                    }
                }
                break;
                
            case 'checkerboard':
                // Checkerboard pattern of projectiles
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.phase = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.6) {
                        this.patternData.timer = 0;
                        this.patternData.phase++;
                        
                        // Checkerboard - alternate squares
                        const gridSize = 60;
                        const offset = this.patternData.phase % 2;
                        
                        for (let gx = -3; gx <= 3; gx++) {
                            for (let gy = -3; gy <= 3; gy++) {
                                if ((gx + gy + offset) % 2 === 0) {
                                    const px = this.target.x + gx * gridSize;
                                    const py = this.target.y + gy * gridSize;
                                    
                                    this.pendingAttack = {
                                        type: 'aoe', damage: this.damage * 0.35,
                                        x: px, y: py, targetX: px, targetY: py,
                                        radius: 25, duration: 0.3, owner: this
                                    };
                                }
                            }
                        }
                        
                        if (this.patternData.phase >= 4) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            case 'crescentMoon':
                // Crescent-shaped projectile wave
                if (this.patternStep === 0) {
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.patternData.timer = 0;
                    this.patternData.waves = 0;
                    this.patternStep = 1;
                } else if (this.patternStep === 1) {
                    this.patternData.timer += dt;
                    
                    if (this.patternData.timer > 0.5) {
                        this.patternData.timer = 0;
                        this.patternData.waves++;
                        
                        const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                        
                        // Crescent shape - arc of projectiles
                        for (let i = 0; i < 9; i++) {
                            const arcAngle = baseAngle + (i - 4) * 0.15;
                            // Varying distance for crescent shape
                            const dist = 60 + Math.abs(i - 4) * 10;
                            const startX = this.x + Math.cos(arcAngle) * dist;
                            const startY = this.y + Math.sin(arcAngle) * dist;
                            
                            this.pendingAttack = {
                                type: 'projectile', damage: this.damage * 0.3,
                                x: startX, y: startY,
                                targetX: startX + Math.cos(arcAngle) * 300,
                                targetY: startY + Math.sin(arcAngle) * 300,
                                speed: 280, owner: this
                            };
                        }
                        
                        if (this.patternData.waves >= 5) {
                            this.endBossPattern();
                        }
                    }
                }
                break;
                
            default:
                this.endBossPattern();
        }
    }
    
    endBossPattern() {
        this.currentPattern = null;
        this.patternStep = 0;
        this.patternData = {};
        this.attackTimer = 0.4; // Very brief pause - bosses are relentless
        this.idleTimer = 0; // Reset idle timer
    }
    
    doBossDodge() {
        const angle = Math.atan2(this.y - this.target.y, this.x - this.target.x);
        const dodgeDistance = 100;
        
        this.velocity.x = Math.cos(angle) * this.maxSpeed * 3;
        this.velocity.y = Math.sin(angle) * this.maxSpeed * 3;
        
        this.dodgeTimer = 1.5;
        
        // Change strafe direction after dodge
        this.strafeDirection *= -1;
    }
    
    findTarget() {
        if (!this.scene) return;
        
        const players = this.scene.getEntitiesByTag('player');
        let closest = null;
        
        // Bosses are always bloodlusted - no range limit
        let closestDist = this.isBoss ? Infinity : this.aggroRange;
        
        for (const player of players) {
            if (!player.active) continue;
            const dist = this.distanceTo(player);
            if (dist < closestDist) {
                closest = player;
                closestDist = dist;
            }
        }
        
        this.target = closest;
        
        // Bosses never de-aggro - always chase
        if (this.isBoss && this.target) {
            this.state = 'chase';
        }
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
            // Pick new wander target - more frequently and further
            const angle = Math.random() * Math.PI * 2;
            const dist = 50 + Math.random() * (this.maxWanderDistance || 150);
            
            this.wanderTarget = {
                x: this.homePosition.x + Math.cos(angle) * dist,
                y: this.homePosition.y + Math.sin(angle) * dist
            };
            this.pathTimer = Utils.random(1, 3); // Faster wandering decisions
            
            // Occasional idle dash while wandering
            if (this.mobDashCooldown <= 0 && Math.random() < 0.1) {
                const dashDist = 30 + Math.random() * 30;
                this.x += Math.cos(angle) * dashDist;
                this.y += Math.sin(angle) * dashDist;
                this.mobDashCooldown = 4;
            }
        }
        
        const dist = Utils.distance(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y);
        
        if (dist > 10) {
            const angle = Utils.angle(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y);
            // Move faster while wandering
            this.velocity.x = Math.cos(angle) * this.maxSpeed * 0.5;
            this.velocity.y = Math.sin(angle) * this.maxSpeed * 0.5;
            this.facing.x = Math.cos(angle);
            this.facing.y = Math.sin(angle);
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
        
        // Basic attack - bosses get knockback on melee
        const isBoss = this.type === 'boss' || this.enemyType === 'boss' || this.bossPhase;
        this.pendingAttack = {
            type: 'melee',
            damage: this.damage,
            x: this.x,
            y: this.y,
            targetX: this.target.x,
            targetY: this.target.y,
            range: this.attackRange,
            knockback: isBoss ? 200 : 0,
            owner: this
        };
        return this.pendingAttack;
    }
    
    takeDamage(amount, source = null, hitX = null, hitY = null) {
        if (this.invulnerable) return 0;
        
        // Check if shadow clone pattern is active - player might hit a fake clone
        if (this.shadowCloneActive && this.patternData?.clones) {
            // Use hit position if provided, otherwise use source position
            const checkX = hitX !== null ? hitX : (source?.x || null);
            const checkY = hitY !== null ? hitY : (source?.y || null);
            
            if (checkX !== null && checkY !== null) {
                // Check if any FAKE clone is closer to the hit than the real boss
                const distToRealBoss = Math.sqrt((checkX - this.x) ** 2 + (checkY - this.y) ** 2);
                
                for (let i = 0; i < this.patternData.clones.length; i++) {
                    const clone = this.patternData.clones[i];
                    if (!clone.alive || clone.isReal) continue;
                    
                    const distToClone = Math.sqrt((checkX - clone.x) ** 2 + (checkY - clone.y) ** 2);
                    
                    // If hit is closer to this fake clone, destroy the clone instead
                    if (distToClone < distToRealBoss && distToClone < 60) {
                        // Destroy fake clone
                        clone.alive = false;
                        clone.alpha = 0;
                        
                        // Update visual clone
                        if (this.shadowClones[i]) {
                            this.shadowClones[i].alive = false;
                            this.shadowClones[i].alpha = 0;
                        }
                        
                        // Return 0 damage - didn't hit real boss
                        return 0;
                    }
                }
            }
        }
        
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
        
        // Render lightning warning zones first (under everything)
        if (this.isBoss && this.lightningZones) {
            this.renderLightningZones(ctx);
        }
        
        // Render ring attack indicator (forming ring that locks position)
        if (this.isBoss && this.showRingIndicator) {
            this.renderRingIndicator(ctx);
        }
        
        // Render attack telegraph warning
        if (this.showTelegraph && this.telegraphRadius) {
            this.renderTelegraph(ctx);
        }
        
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        if (this.isBoss || this.type === 'boss') {
            // Upgraded boss rendering with unique sprites per boss type
            this.renderBossSprite(ctx);
        } else {
            // Normal enemy rendering
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            
            // Draw facing indicator
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(this.facing.x * 12, this.facing.y * 12);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Health bar
        this.renderHealthBar(ctx);
        
        // Status effect indicators
        this.renderStatusEffects(ctx);
        
        // Render tracking orbs
        if (this.trackingOrbs && this.trackingOrbs.length > 0) {
            this.renderTrackingOrbs(ctx);
        }
        
        // Render boss dash trail
        if (this.isBoss && this.bossDashTrail && this.bossDashTrail.length > 0) {
            this.renderBossDashTrail(ctx);
        }
        
        // Render dash afterimages (from new dash system)
        if (this.isBoss && this.dashAfterimages && this.dashAfterimages.length > 0) {
            this.renderDashAfterimages(ctx);
        }
        
        // Render shadow clones
        if (this.isBoss && this.shadowCloneActive && this.shadowClones && this.shadowClones.length > 0) {
            this.renderShadowClones(ctx);
        }
    }
    
    // Render shadow clones for the clone pattern
    renderShadowClones(ctx) {
        const elementColor = this.getElementColor(this.bossElement);
        
        for (const clone of this.shadowClones) {
            if (!clone.alive || clone.isReal) continue; // Don't render the real one separately - it's the boss
            
            ctx.save();
            ctx.globalAlpha = clone.alpha * 0.7;
            ctx.translate(clone.x + this.width / 2, clone.y + this.height / 2);
            
            // Draw shadowy clone silhouette
            ctx.fillStyle = elementColor;
            ctx.shadowColor = elementColor;
            ctx.shadowBlur = 25;
            
            // Clone shape - same as boss but with transparency
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner darker core
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width / 3, this.height / 3, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Flickering outline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = clone.alpha * 0.3 + Math.sin(Date.now() / 50) * 0.2;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width / 2 + 5, this.height / 2 + 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    // Render afterimages from dash system
    renderDashAfterimages(ctx) {
        for (const img of this.dashAfterimages) {
            ctx.save();
            ctx.globalAlpha = img.alpha;
            ctx.translate(img.x + this.width / 2, img.y + this.height / 2);
            
            // Draw ghost silhouette
            ctx.fillStyle = img.color;
            ctx.shadowColor = img.color;
            ctx.shadowBlur = 15;
            
            // Simple boss shape
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }
    
    renderBossSprite(ctx) {
        const time = Date.now() * 0.001;
        const pulseScale = 1 + Math.sin(time * 3) * 0.03;
        
        // Get elemental color for this boss
        const elementColor = this.getElementColor(this.bossElement);
        const elementGlow = this.getElementGlow(this.bossElement);
        
        // Phase-based intensity
        const phaseIntensity = (this.bossPhase || 1) * 0.3;
        
        // Outer aura glow
        ctx.shadowColor = elementGlow;
        ctx.shadowBlur = 20 + phaseIntensity * 15;
        
        // Base body
        ctx.fillStyle = this.color;
        
        // Draw boss-specific shapes
        if (this.enemyType === 'pharaoh' || this.name === 'Pharaoh') {
            this.renderPharaohSprite(ctx, pulseScale, elementColor);
        } else if (this.enemyType === 'cerberus' || this.name === 'Cerberus') {
            this.renderCerberusSprite(ctx, pulseScale, elementColor);
        } else if (this.enemyType === 'queenSpider' || this.name === 'Spider Queen') {
            this.renderSpiderQueenSprite(ctx, pulseScale, elementColor);
        } else if (this.enemyType === 'archangel' || this.name === 'Archangel') {
            this.renderArchangelSprite(ctx, pulseScale, elementColor);
        } else if (this.enemyType === 'masterAI' || this.name === 'Master A.I.') {
            this.renderMasterAISprite(ctx, pulseScale, elementColor);
        } else if (this.enemyType === 'ancientGolem' || this.name === 'Ancient Golem') {
            this.renderGolemSprite(ctx, pulseScale, elementColor);
        } else {
            // Default boss rendering
            ctx.fillRect(-this.width / 2 * pulseScale, -this.height / 2 * pulseScale, 
                         this.width * pulseScale, this.height * pulseScale);
            ctx.strokeStyle = elementColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.width / 2 * pulseScale, -this.height / 2 * pulseScale, 
                           this.width * pulseScale, this.height * pulseScale);
        }
        
        ctx.shadowBlur = 0;
        
        // Health-based enrage effect
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent < 0.25) {
            // Red pulsing aura when low health
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(time * 8) * 0.3})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, this.width * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    renderPharaohSprite(ctx, scale, elementColor) {
        const w = this.width * scale;
        const h = this.height * scale;
        const time = Date.now() * 0.001;
        
        // Body - Egyptian gold
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(-w / 2, -h / 3, w, h * 0.8);
        
        // Crown/Headdress - blue and gold stripes
        ctx.fillStyle = '#1a237e';
        ctx.beginPath();
        ctx.moveTo(-w / 2 - 5, -h / 3);
        ctx.lineTo(0, -h / 2 - 10);
        ctx.lineTo(w / 2 + 5, -h / 3);
        ctx.closePath();
        ctx.fill();
        
        // Crown accent
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, -h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes - glowing with lightning
        ctx.shadowColor = elementColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = elementColor;
        ctx.fillRect(-w / 4 - 3, -h / 6, 8, 4);
        ctx.fillRect(w / 4 - 5, -h / 6, 8, 4);
        
        // Ankh symbol on chest
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, h / 6, 8, 0, Math.PI * 2);
        ctx.moveTo(0, h / 6 + 8);
        ctx.lineTo(0, h / 2 - 5);
        ctx.moveTo(-8, h / 3);
        ctx.lineTo(8, h / 3);
        ctx.stroke();
        
        // Lightning crackling effect
        if (Math.random() < 0.3) {
            ctx.strokeStyle = elementColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            const startX = (Math.random() - 0.5) * w;
            const startY = (Math.random() - 0.5) * h;
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX + (Math.random() - 0.5) * 20, startY + (Math.random() - 0.5) * 20);
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderCerberusSprite(ctx, scale, elementColor) {
        const w = this.width * scale;
        const h = this.height * scale;
        const time = Date.now() * 0.001;
        
        // Main body
        ctx.fillStyle = '#2a0a0a';
        ctx.beginPath();
        ctx.ellipse(0, h / 6, w / 2, h / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Three heads
        for (let head = -1; head <= 1; head++) {
            ctx.fillStyle = '#1a0505';
            ctx.beginPath();
            ctx.ellipse(head * (w / 3), -h / 4, w / 5, h / 4, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Eyes - fiery
            ctx.shadowColor = elementColor;
            ctx.shadowBlur = 10;
            ctx.fillStyle = elementColor;
            ctx.beginPath();
            ctx.arc(head * (w / 3) - 5, -h / 4 - 5, 4, 0, Math.PI * 2);
            ctx.arc(head * (w / 3) + 5, -h / 4 - 5, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Flame breath hint
            if (Math.random() < 0.2) {
                ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, 0.6)`;
                ctx.beginPath();
                ctx.moveTo(head * (w / 3), -h / 4 + 10);
                ctx.lineTo(head * (w / 3) - 5, -h / 4 + 25);
                ctx.lineTo(head * (w / 3) + 5, -h / 4 + 25);
                ctx.closePath();
                ctx.fill();
            }
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderSpiderQueenSprite(ctx, scale, elementColor) {
        const w = this.width * scale;
        const h = this.height * scale;
        const time = Date.now() * 0.001;
        
        // Abdomen
        ctx.fillStyle = '#1a3a1a';
        ctx.beginPath();
        ctx.ellipse(0, h / 4, w / 2.5, h / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Thorax
        ctx.fillStyle = '#0a2a0a';
        ctx.beginPath();
        ctx.ellipse(0, -h / 8, w / 4, h / 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Legs (8)
        ctx.strokeStyle = '#1a3a1a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
            const legAngle = (i / 4) * Math.PI - Math.PI / 2 + Math.sin(time * 5 + i) * 0.1;
            // Left legs
            ctx.beginPath();
            ctx.moveTo(-w / 5, -h / 8);
            ctx.lineTo(-w / 2 - 10 + Math.cos(legAngle) * 15, -h / 4 + i * 15);
            ctx.stroke();
            // Right legs
            ctx.beginPath();
            ctx.moveTo(w / 5, -h / 8);
            ctx.lineTo(w / 2 + 10 - Math.cos(legAngle) * 15, -h / 4 + i * 15);
            ctx.stroke();
        }
        
        // Eyes (8 small ones)
        ctx.shadowColor = elementColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = elementColor;
        for (let i = 0; i < 8; i++) {
            const eyeX = (i % 4 - 1.5) * 6;
            const eyeY = -h / 4 - 5 + Math.floor(i / 4) * 6;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderArchangelSprite(ctx, scale, elementColor) {
        const w = this.width * scale;
        const h = this.height * scale;
        const time = Date.now() * 0.001;
        
        // Wings
        ctx.fillStyle = 'rgba(255, 255, 220, 0.8)';
        ctx.shadowColor = elementColor;
        ctx.shadowBlur = 20;
        
        // Left wing
        ctx.beginPath();
        ctx.moveTo(-w / 6, 0);
        ctx.quadraticCurveTo(-w / 2 - 20, -h / 3, -w / 2 - 30, -h / 2 - 10);
        ctx.quadraticCurveTo(-w / 2 - 10, -h / 4, -w / 6, h / 4);
        ctx.closePath();
        ctx.fill();
        
        // Right wing
        ctx.beginPath();
        ctx.moveTo(w / 6, 0);
        ctx.quadraticCurveTo(w / 2 + 20, -h / 3, w / 2 + 30, -h / 2 - 10);
        ctx.quadraticCurveTo(w / 2 + 10, -h / 4, w / 6, h / 4);
        ctx.closePath();
        ctx.fill();
        
        // Body - robed
        ctx.fillStyle = '#ffffee';
        ctx.beginPath();
        ctx.moveTo(0, -h / 3);
        ctx.lineTo(-w / 4, h / 2);
        ctx.lineTo(w / 4, h / 2);
        ctx.closePath();
        ctx.fill();
        
        // Head/Halo
        ctx.fillStyle = '#ffe4b5';
        ctx.beginPath();
        ctx.arc(0, -h / 3, w / 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Halo
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, -h / 2 + 5, w / 5, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // Holy glow particles
        ctx.fillStyle = `rgba(255, 255, 200, ${0.3 + Math.sin(time * 4) * 0.2})`;
        for (let i = 0; i < 5; i++) {
            const angle = time * 2 + (i / 5) * Math.PI * 2;
            const dist = 40 + Math.sin(time * 3 + i) * 10;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist - h / 4, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderMasterAISprite(ctx, scale, elementColor) {
        const w = this.width * scale;
        const h = this.height * scale;
        const time = Date.now() * 0.001;
        
        // Core body - hexagonal
        ctx.fillStyle = '#1a1a2a';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const px = Math.cos(angle) * w / 2.2;
            const py = Math.sin(angle) * h / 2.2;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        
        // Circuit lines
        ctx.strokeStyle = elementColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = elementColor;
        ctx.shadowBlur = 10;
        
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-w / 3 + i * 15, -h / 3);
            ctx.lineTo(-w / 3 + i * 15, h / 3);
            ctx.stroke();
        }
        
        // Central eye
        ctx.fillStyle = elementColor;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Scanning beam effect
        const scanAngle = time * 2;
        ctx.strokeStyle = `rgba(0, 170, 255, ${0.5 + Math.sin(time * 5) * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(scanAngle) * w, Math.sin(scanAngle) * h);
        ctx.stroke();
        
        // Data particles
        for (let i = 0; i < 6; i++) {
            const pAngle = time * 3 + (i / 6) * Math.PI * 2;
            const pDist = 25 + Math.sin(time * 4 + i) * 10;
            ctx.fillStyle = i % 2 === 0 ? '#00ff88' : elementColor;
            ctx.fillRect(Math.cos(pAngle) * pDist - 2, Math.sin(pAngle) * pDist - 2, 4, 4);
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderGolemSprite(ctx, scale, elementColor) {
        const w = this.width * scale;
        const h = this.height * scale;
        const time = Date.now() * 0.001;
        
        // Rocky body - irregular shape
        ctx.fillStyle = '#4a4550';
        
        // Main body
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 5, -h / 3);
        ctx.lineTo(-w / 2, h / 3);
        ctx.lineTo(-w / 4, h / 2);
        ctx.lineTo(w / 4, h / 2);
        ctx.lineTo(w / 2, h / 3);
        ctx.lineTo(w / 2 - 5, -h / 3);
        ctx.closePath();
        ctx.fill();
        
        // Head
        ctx.fillStyle = '#3a3540';
        ctx.beginPath();
        ctx.moveTo(-w / 4, -h / 3);
        ctx.lineTo(-w / 5, -h / 2);
        ctx.lineTo(w / 5, -h / 2);
        ctx.lineTo(w / 4, -h / 3);
        ctx.closePath();
        ctx.fill();
        
        // Crystal veins
        ctx.strokeStyle = elementColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = elementColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(-w / 3, 0);
        ctx.lineTo(-w / 6, -h / 4);
        ctx.lineTo(0, h / 6);
        ctx.lineTo(w / 6, -h / 6);
        ctx.lineTo(w / 3, h / 4);
        ctx.stroke();
        
        // Eyes - deep purple glow
        ctx.fillStyle = elementColor;
        ctx.beginPath();
        ctx.arc(-w / 8, -h / 2.5, 5, 0, Math.PI * 2);
        ctx.arc(w / 8, -h / 2.5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Rock particles floating
        ctx.fillStyle = '#5a5560';
        for (let i = 0; i < 4; i++) {
            const pAngle = time + (i / 4) * Math.PI * 2;
            const pDist = 35 + Math.sin(time * 2 + i) * 8;
            const size = 4 + Math.sin(time * 3 + i) * 2;
            ctx.fillRect(
                Math.cos(pAngle) * pDist - size / 2,
                Math.sin(pAngle) * pDist - h / 4 - size / 2,
                size, size
            );
        }
        
        ctx.shadowBlur = 0;
    }
    
    renderLightningZones(ctx) {
        for (const zone of this.lightningZones) {
            ctx.save();
            ctx.translate(zone.x, zone.y);
            
            if (zone.struck) {
                // Lightning strike effect
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#ffff00';
                ctx.shadowBlur = 30;
                
                // Draw lightning bolt
                ctx.beginPath();
                ctx.moveTo(0, -200);
                let y = -200;
                while (y < 0) {
                    const nextY = y + 20 + Math.random() * 30;
                    const xOff = (Math.random() - 0.5) * 40;
                    ctx.lineTo(xOff, nextY);
                    y = nextY;
                }
                ctx.lineTo(0, 0);
                ctx.stroke();
                
                // Impact flash
                ctx.fillStyle = `rgba(255, 255, 100, ${zone.strikeTime * 2})`;
                ctx.beginPath();
                ctx.arc(0, 0, zone.radius * 1.2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Warning zone - pulsing circle
                const warningIntensity = 1 - (zone.timer / this.lightningStrikeDelay);
                ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + warningIntensity * 0.5})`;
                ctx.lineWidth = 2 + warningIntensity * 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(0, 0, zone.radius * (0.8 + warningIntensity * 0.2), 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Inner glow
                ctx.fillStyle = `rgba(255, 255, 0, ${warningIntensity * 0.3})`;
                ctx.beginPath();
                ctx.arc(0, 0, zone.radius * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
    
    renderRingIndicator(ctx) {
        // Draw the forming ring around the boss
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const radius = this.patternData?.orbRadius || 120;
        const progress = this.ringIndicatorProgress || 0;
        const elementColor = this.getElementColor(this.bossElement);
        
        ctx.save();
        
        // Draw the ring arc based on progress
        ctx.strokeStyle = elementColor;
        ctx.lineWidth = 4;
        ctx.shadowColor = elementColor;
        ctx.shadowBlur = 20;
        
        // Outer forming ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2 * progress);
        ctx.stroke();
        
        // Pulsing glow effect
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 100);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 8;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2 * progress);
        ctx.stroke();
        
        // Draw orb positions that will spawn
        if (progress > 0.1) {
            const orbCount = this.patternData?.orbCount || 12;
            const orbsToDraw = Math.floor(orbCount * progress);
            
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = elementColor;
            
            for (let i = 0; i < orbsToDraw; i++) {
                const angle = (i / orbCount) * Math.PI * 2;
                const orbX = centerX + Math.cos(angle) * radius;
                const orbY = centerY + Math.sin(angle) * radius;
                
                ctx.beginPath();
                ctx.arc(orbX, orbY, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw targeting lines to player when ring is almost complete
        if (progress > 0.7 && this.target) {
            const orbCount = this.patternData?.orbCount || 12;
            ctx.globalAlpha = (progress - 0.7) / 0.3 * 0.5; // Fade in from 0.7 to 1.0
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 10;
            
            for (let i = 0; i < orbCount; i++) {
                const angle = (i / orbCount) * Math.PI * 2;
                const orbX = centerX + Math.cos(angle) * radius;
                const orbY = centerY + Math.sin(angle) * radius;
                
                ctx.beginPath();
                ctx.moveTo(orbX, orbY);
                ctx.lineTo(this.target.x, this.target.y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        
        // Warning text
        if (progress > 0.5) {
            ctx.globalAlpha = 1;
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#ff4444';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 5;
            ctx.textAlign = 'center';
            ctx.fillText('DODGE!', centerX, centerY - radius - 20);
        }
        
        ctx.restore();
    }
    
    renderTrackingOrbs(ctx) {
        const elementColor = this.getElementColor(this.bossElement);
        
        for (const orb of this.trackingOrbs) {
            ctx.save();
            ctx.translate(orb.x, orb.y);
            
            ctx.shadowColor = elementColor;
            ctx.shadowBlur = 15;
            ctx.fillStyle = elementColor;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Trail
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }
    
    renderBossDashTrail(ctx) {
        for (let i = this.bossDashTrail.length - 1; i >= 0; i--) {
            const trail = this.bossDashTrail[i];
            trail.time -= 0.016; // Assume 60fps
            trail.alpha = trail.time / 0.4;
            
            if (trail.time <= 0) {
                this.bossDashTrail.splice(i, 1);
                continue;
            }
            
            ctx.save();
            ctx.globalAlpha = trail.alpha * 0.6;
            ctx.translate(trail.x + this.width / 2, trail.y + this.height / 2);
            ctx.fillStyle = trail.color || this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        }
    }
    
    getElementColor(element) {
        const colors = {
            lightning: '#ffff00',
            fire: '#ff4400',
            poison: '#44ff44',
            holy: '#ffffaa',
            electric: '#00aaff',
            earth: '#9966cc',
            arcane: '#aa44ff',
            ice: '#88ccff',
            dark: '#6622aa'
        };
        return colors[element] || '#ffffff';
    }
    
    getElementGlow(element) {
        const glows = {
            lightning: '#ffff88',
            fire: '#ff6600',
            poison: '#22ff22',
            holy: '#ffffdd',
            electric: '#44ccff',
            earth: '#bb88ee',
            arcane: '#cc66ff',
            ice: '#aaddff',
            dark: '#8844cc'
        };
        return glows[element] || '#ffffff';
    }
    
    renderTelegraph(ctx) {
        const time = Date.now() * 0.001;
        const pulseIntensity = 0.5 + Math.sin(time * 12) * 0.3;
        
        ctx.save();
        
        // Draw warning circle
        ctx.strokeStyle = `rgba(255, 0, 0, ${pulseIntensity})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.telegraphRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Inner fill
        ctx.fillStyle = `rgba(255, 50, 50, ${pulseIntensity * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.telegraphRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Warning text
        ctx.fillStyle = `rgba(255, 255, 0, ${pulseIntensity})`;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('!', this.x, this.y - this.telegraphRadius - 10);
        
        ctx.restore();
    }
    
    renderHealthBar(ctx) {
        if (this.health >= this.maxHealth) return;
        
        const barWidth = this.isBoss ? this.width + 40 : this.width + 10;
        const barHeight = this.isBoss ? 8 : 4;
        const x = this.x + (this.width - barWidth) / 2;
        const y = this.y - (this.isBoss ? 20 : 10);
        
        // Background
        ctx.fillStyle = '#222';
        ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        const healthPercent = this.health / this.maxHealth;
        
        // Health color based on phase
        let healthColor = this.isBoss ? '#ff4444' : '#aa4444';
        if (this.isBoss) {
            if (healthPercent <= 0.33) {
                healthColor = '#ff0000'; // Enraged red
            } else if (healthPercent <= 0.66) {
                healthColor = '#ff6600'; // Orange warning
            }
        }
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Boss health bar thirds markers
        if (this.isBoss) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            
            // Draw third markers
            for (let i = 1; i <= 2; i++) {
                const markerX = x + (barWidth * i / 3);
                ctx.beginPath();
                ctx.moveTo(markerX, y - 2);
                ctx.lineTo(markerX, y + barHeight + 2);
                ctx.stroke();
            }
            
            // Outer border
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 1, y - 1, barWidth + 2, barHeight + 2);
            
            // Boss name above health bar
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name || 'Boss', this.x + this.width / 2, y - 8);
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

// ============================================
// FLOOR-THEMED ENEMIES
// ============================================

// Egypt themed enemies
export const EgyptEnemies = {
    mummy: {
        name: 'Mummy',
        health: 150,
        damage: 18,
        defense: 5,
        speed: 50,
        attackRange: 120,
        aggroRange: 250,
        attackCooldown: 1.2,
        expValue: 30,
        goldValue: 15,
        color: '#c4a870',
        width: 32,
        height: 32,
        soundType: 'zombie',
        abilities: [
            { name: 'Curse Bolt', damage: 12, cooldown: 2, useChance: 0.6, type: 'projectile' }
        ]
    },
    scarab: {
        name: 'Scarab Swarm',
        health: 60,
        damage: 10,
        defense: 0,
        speed: 140,
        attackRange: 80,
        aggroRange: 300,
        attackCooldown: 0.4,
        expValue: 15,
        goldValue: 8,
        color: '#2a4a3a',
        width: 20,
        height: 20,
        soundType: 'swarm',
        abilities: [
            { name: 'Swarm Shot', damage: 6, cooldown: 1, useChance: 0.5, type: 'projectile' }
        ]
    },
    anubisGuard: {
        name: 'Anubis Guard',
        health: 200,
        damage: 28,
        defense: 10,
        speed: 65,
        attackRange: 150,
        aggroRange: 200,
        attackCooldown: 1.4,
        expValue: 40,
        goldValue: 25,
        color: '#1a1a2a',
        width: 36,
        height: 36,
        soundType: 'wolfBite'
    },
    sandElemental: {
        name: 'Sand Elemental',
        health: 90,
        damage: 18,
        defense: 5,
        speed: 45,
        attackRange: 60,
        aggroRange: 180,
        attackCooldown: 1.8,
        expValue: 35,
        goldValue: 20,
        color: '#d4b87a',
        width: 40,
        height: 40,
        soundType: 'earth'
    }
};

export const EgyptBoss = {
    pharaoh: {
        name: 'Pharaoh',
        type: 'boss',
        health: 2500,
        damage: 45,
        defense: 18,
        speed: 50,
        attackRange: 120,
        aggroRange: 500,
        attackCooldown: 1.2,
        expValue: 500,
        goldValue: 400,
        color: '#ffd700',
        width: 72,
        height: 72,
        soundType: 'largeMagic',
        abilities: [
            { name: 'Summon Mummies', cooldown: 12, useChance: 0.4, type: 'summon', count: 3 },
            { name: 'Sandstorm', damage: 35, cooldown: 8, useChance: 0.5, type: 'aoe', radius: 120 }
        ]
    }
};

// Hades themed enemies
export const HadesEnemies = {
    demon: {
        name: 'Demon',
        health: 160,
        damage: 24,
        defense: 5,
        speed: 80,
        attackRange: 140,
        aggroRange: 280,
        attackCooldown: 0.9,
        expValue: 35,
        goldValue: 22,
        color: '#8a2020',
        width: 34,
        height: 34,
        soundType: 'fire',
        abilities: [
            { name: 'Fireball', damage: 18, cooldown: 1.5, useChance: 0.7, type: 'projectile' }
        ]
    },
    hellhound: {
        name: 'Hellhound',
        health: 120,
        damage: 20,
        defense: 3,
        speed: 130,
        attackRange: 100,
        aggroRange: 300,
        attackCooldown: 0.6,
        expValue: 30,
        goldValue: 18,
        color: '#4a1010',
        width: 30,
        height: 30,
        soundType: 'wolfBite',
        abilities: [
            { name: 'Fire Breath', damage: 12, cooldown: 2, useChance: 0.5, type: 'projectile' }
        ]
    },
    lostSoul: {
        name: 'Lost Soul',
        health: 80,
        damage: 22,
        defense: 0,
        speed: 100,
        attackRange: 160,
        aggroRange: 300,
        attackCooldown: 0.8,
        expValue: 25,
        goldValue: 14,
        color: '#6666aa',
        width: 28,
        height: 28,
        soundType: 'ghost',
        abilities: [
            { name: 'Soul Bolt', damage: 15, cooldown: 1, useChance: 0.8, type: 'projectile' }
        ]
    },
    infernalGuard: {
        name: 'Infernal Guard',
        health: 220,
        damage: 32,
        defense: 14,
        speed: 55,
        attackRange: 160,
        aggroRange: 250,
        attackCooldown: 1.2,
        expValue: 55,
        goldValue: 40,
        color: '#5a1515',
        width: 42,
        height: 42,
        soundType: 'fire',
        abilities: [
            { name: 'Inferno Blast', damage: 25, cooldown: 2, useChance: 0.6, type: 'projectile' }
        ]
    }
};

export const HadesBoss = {
    cerberus: {
        name: 'Cerberus',
        type: 'boss',
        health: 3200,
        damage: 60,
        defense: 22,
        speed: 60,
        attackRange: 130,
        aggroRange: 550,
        attackCooldown: 1.2,
        expValue: 700,
        goldValue: 550,
        color: '#2a0a0a',
        width: 90,
        height: 90,
        soundType: 'wolfBite',
        abilities: [
            { name: 'Triple Bite', damage: 35, cooldown: 5, useChance: 0.6, type: 'multi', hits: 3 },
            { name: 'Hellfire', damage: 50, cooldown: 10, useChance: 0.5, type: 'aoe', radius: 160 }
        ]
    }
};

// Jungle themed enemies
export const JungleEnemies = {
    venomSpider: {
        name: 'Venom Spider',
        health: 100,
        damage: 16,
        defense: 2,
        speed: 120,
        attackRange: 120,
        aggroRange: 280,
        attackCooldown: 0.5,
        expValue: 22,
        goldValue: 12,
        color: '#2a4a2a',
        width: 26,
        height: 26,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Web Shot', damage: 10, cooldown: 1, useChance: 0.7, type: 'projectile', slow: 0.5 },
            { name: 'Poison Spit', damage: 8, cooldown: 2, useChance: 0.5, type: 'projectile' }
        ]
    },
    jungleTroll: {
        name: 'Jungle Troll',
        health: 200,
        damage: 28,
        defense: 8,
        speed: 50,
        attackRange: 140,
        aggroRange: 220,
        attackCooldown: 1.4,
        expValue: 50,
        goldValue: 32,
        color: '#3a5a3a',
        width: 44,
        height: 44,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Rock Throw', damage: 20, cooldown: 2, useChance: 0.6, type: 'projectile' }
        ]
    },
    poisonDart: {
        name: 'Poison Dart Frog',
        health: 60,
        damage: 14,
        defense: 0,
        speed: 150,
        attackRange: 180,
        aggroRange: 280,
        attackCooldown: 0.8,
        expValue: 18,
        goldValue: 14,
        color: '#00aa44',
        width: 18,
        height: 18,
        soundType: 'slime',
        abilities: [
            { name: 'Poison Dart', damage: 12, cooldown: 0.5, useChance: 0.9, type: 'projectile' }
        ]
    },
    carnivore: {
        name: 'Carnivorous Plant',
        health: 180,
        damage: 35,
        defense: 4,
        speed: 0,
        attackRange: 150,
        aggroRange: 160,
        attackCooldown: 1.5,
        expValue: 40,
        goldValue: 25,
        color: '#1a4a1a',
        width: 48,
        height: 48,
        soundType: 'slime',
        abilities: [
            { name: 'Acid Spray', damage: 20, cooldown: 1.5, useChance: 0.8, type: 'projectile' }
        ]
    }
};

export const JungleBoss = {
    queenSpider: {
        name: 'Spider Queen',
        type: 'boss',
        health: 2800,
        damage: 40,
        defense: 14,
        speed: 70,
        attackRange: 110,
        aggroRange: 450,
        attackCooldown: 1.0,
        expValue: 600,
        goldValue: 450,
        color: '#1a3a1a',
        width: 80,
        height: 80,
        soundType: 'swarm',
        abilities: [
            { name: 'Web Shot', damage: 25, cooldown: 4, useChance: 0.6, type: 'projectile', slow: 0.7 },
            { name: 'Spawn Spiderlings', cooldown: 12, useChance: 0.4, type: 'summon', count: 6 }
        ]
    }
};

// Light themed enemies
export const LightEnemies = {
    holyKnight: {
        name: 'Holy Knight',
        health: 180,
        damage: 24,
        defense: 15,
        speed: 60,
        attackRange: 140,
        aggroRange: 250,
        attackCooldown: 1.2,
        expValue: 40,
        goldValue: 30,
        color: '#e8e8d0',
        width: 36,
        height: 36,
        soundType: 'largeMagic',
        abilities: [
            { name: 'Holy Lance', damage: 18, cooldown: 1.5, useChance: 0.7, type: 'projectile' }
        ]
    },
    seraph: {
        name: 'Seraph',
        health: 120,
        damage: 30,
        defense: 5,
        speed: 100,
        attackRange: 180,
        aggroRange: 280,
        attackCooldown: 1.2,
        expValue: 45,
        goldValue: 35,
        color: '#ffffcc',
        width: 32,
        height: 32,
        soundType: 'largeMagic',
        abilities: [
            { name: 'Light Beam', damage: 22, cooldown: 1, useChance: 0.8, type: 'projectile' }
        ]
    },
    lightWarden: {
        name: 'Light Warden',
        health: 220,
        damage: 28,
        defense: 18,
        speed: 45,
        attackRange: 160,
        aggroRange: 260,
        attackCooldown: 1.4,
        expValue: 55,
        goldValue: 40,
        color: '#ffd080',
        width: 40,
        height: 40,
        soundType: 'largeMagic',
        abilities: [
            { name: 'Radiant Bolt', damage: 25, cooldown: 1.5, useChance: 0.6, type: 'projectile' }
        ]
    },
    pureSpirit: {
        name: 'Pure Spirit',
        health: 100,
        damage: 22,
        defense: 0,
        speed: 130,
        attackRange: 150,
        aggroRange: 280,
        attackCooldown: 0.6,
        expValue: 30,
        goldValue: 25,
        color: '#ffffff',
        width: 28,
        height: 28,
        soundType: 'ghost',
        abilities: [
            { name: 'Spirit Bolt', damage: 15, cooldown: 0.8, useChance: 0.9, type: 'projectile' }
        ]
    }
};

export const LightBoss = {
    archangel: {
        name: 'Archangel',
        type: 'boss',
        health: 3500,
        damage: 55,
        defense: 25,
        speed: 65,
        attackRange: 140,
        aggroRange: 550,
        attackCooldown: 1.2,
        expValue: 800,
        goldValue: 650,
        color: '#ffffaa',
        width: 85,
        height: 85,
        soundType: 'largeMagic',
        abilities: [
            { name: 'Divine Smite', damage: 70, cooldown: 6, useChance: 0.6, type: 'aoe', radius: 120 },
            { name: 'Holy Shield', cooldown: 18, useChance: 0.3, type: 'buff', defense: 40, duration: 5 }
        ]
    }
};

// Cyber themed enemies
export const CyberEnemies = {
    securityDrone: {
        name: 'Security Drone',
        health: 100,
        damage: 18,
        defense: 8,
        speed: 130,
        attackRange: 200,
        aggroRange: 300,
        attackCooldown: 0.5,
        expValue: 25,
        goldValue: 15,
        color: '#4488aa',
        width: 24,
        height: 24,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Pulse Shot', damage: 12, cooldown: 0.6, useChance: 0.9, type: 'projectile' }
        ]
    },
    combatBot: {
        name: 'Combat Bot',
        health: 180,
        damage: 24,
        defense: 12,
        speed: 70,
        attackRange: 160,
        aggroRange: 260,
        attackCooldown: 1.0,
        expValue: 40,
        goldValue: 28,
        color: '#5a5a6a',
        width: 38,
        height: 38,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Plasma Bolt', damage: 20, cooldown: 1.2, useChance: 0.7, type: 'projectile' }
        ]
    },
    hackUnit: {
        name: 'Hack Unit',
        health: 80,
        damage: 16,
        defense: 2,
        speed: 90,
        attackRange: 220,
        aggroRange: 300,
        attackCooldown: 1.0,
        expValue: 35,
        goldValue: 25,
        color: '#00ff88',
        width: 26,
        height: 26,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Data Spike', damage: 14, cooldown: 0.8, useChance: 0.8, type: 'projectile' },
            { name: 'Disrupt', cooldown: 6, useChance: 0.4, type: 'debuff', slow: 0.5, duration: 2 }
        ]
    },
    laserTurret: {
        name: 'Laser Turret',
        health: 140,
        damage: 35,
        defense: 15,
        speed: 0,
        attackRange: 280,
        aggroRange: 320,
        attackCooldown: 1.5,
        expValue: 30,
        goldValue: 20,
        color: '#aa0000',
        width: 32,
        height: 32,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Laser Beam', damage: 30, cooldown: 1.2, useChance: 0.9, type: 'projectile' }
        ]
    }
};

export const CyberBoss = {
    masterAI: {
        name: 'Master A.I.',
        type: 'boss',
        health: 4000,
        damage: 50,
        defense: 28,
        speed: 80,
        attackRange: 160,
        aggroRange: 550,
        attackCooldown: 1.0,
        expValue: 900,
        goldValue: 750,
        color: '#00aaff',
        width: 70,
        height: 70,
        soundType: 'smallMonsterAttack',
        abilities: [
            { name: 'Laser Array', damage: 55, cooldown: 4, useChance: 0.6, type: 'multi', hits: 5 },
            { name: 'Deploy Drones', cooldown: 10, useChance: 0.4, type: 'summon', count: 5 },
            { name: 'System Override', cooldown: 18, useChance: 0.3, type: 'debuff', stun: 2 }
        ]
    }
};

// Stone themed enemies
export const StoneEnemies = {
    golem: {
        name: 'Stone Golem',
        health: 250,
        damage: 28,
        defense: 20,
        speed: 35,
        attackRange: 150,
        aggroRange: 220,
        attackCooldown: 1.5,
        expValue: 50,
        goldValue: 30,
        color: '#5a5a60',
        width: 46,
        height: 46,
        soundType: 'earth',
        abilities: [
            { name: 'Boulder Toss', damage: 25, cooldown: 2, useChance: 0.7, type: 'projectile' }
        ]
    },
    rockElemental: {
        name: 'Rock Elemental',
        health: 160,
        damage: 24,
        defense: 15,
        speed: 50,
        attackRange: 140,
        aggroRange: 240,
        attackCooldown: 1.3,
        expValue: 40,
        goldValue: 25,
        color: '#4a4a50',
        width: 38,
        height: 38,
        soundType: 'earth',
        abilities: [
            { name: 'Rock Shard', damage: 18, cooldown: 1.2, useChance: 0.7, type: 'projectile' }
        ]
    },
    crystalGuard: {
        name: 'Crystal Guard',
        health: 130,
        damage: 26,
        defense: 10,
        speed: 65,
        attackRange: 160,
        aggroRange: 260,
        attackCooldown: 1.1,
        expValue: 35,
        goldValue: 35,
        color: '#9966cc',
        width: 34,
        height: 34,
        soundType: 'largeMagic',
        abilities: [
            { name: 'Crystal Spike', damage: 22, cooldown: 1, useChance: 0.8, type: 'projectile' }
        ]
    },
    shadowDweller: {
        name: 'Shadow Dweller',
        health: 100,
        damage: 20,
        defense: 3,
        speed: 110,
        attackRange: 150,
        aggroRange: 280,
        attackCooldown: 0.7,
        expValue: 30,
        goldValue: 20,
        color: '#2a2a3a',
        width: 30,
        height: 30,
        soundType: 'ghost',
        abilities: [
            { name: 'Shadow Bolt', damage: 15, cooldown: 0.8, useChance: 0.9, type: 'projectile' }
        ]
    }
};

export const StoneBoss = {
    ancientGolem: {
        name: 'Ancient Golem',
        type: 'boss',
        health: 5000,
        damage: 65,
        defense: 35,
        speed: 35,
        attackRange: 150,
        aggroRange: 450,
        attackCooldown: 1.8,
        expValue: 1000,
        goldValue: 800,
        color: '#3a3a4a',
        width: 100,
        height: 100,
        soundType: 'earth',
        abilities: [
            { name: 'Earthquake', damage: 50, cooldown: 7, useChance: 0.5, type: 'aoe', radius: 200 },
            { name: 'Rock Throw', damage: 65, cooldown: 3, useChance: 0.6, type: 'projectile' },
            { name: 'Stone Form', cooldown: 22, useChance: 0.25, type: 'buff', defense: 60, duration: 5 }
        ]
    }
};

// Floor enemy mapping - maps floor themes to their enemy pools
export const FloorEnemies = {
    egypt: { enemies: EgyptEnemies, boss: EgyptBoss },
    hades: { enemies: HadesEnemies, boss: HadesBoss },
    jungle: { enemies: JungleEnemies, boss: JungleBoss },
    light: { enemies: LightEnemies, boss: LightBoss },
    cyber: { enemies: CyberEnemies, boss: CyberBoss },
    stone: { enemies: StoneEnemies, boss: StoneBoss }
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
