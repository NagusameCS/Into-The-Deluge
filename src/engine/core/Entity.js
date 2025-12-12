/**
 * Entity Component System
 */

export class Entity {
    static nextId = 0;
    
    constructor(x = 0, y = 0) {
        this.id = Entity.nextId++;
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.rotation = 0;
        this.scale = { x: 1, y: 1 };
        
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.friction = 0.9;
        this.maxSpeed = 200;
        
        this.components = new Map();
        this.tags = new Set();
        this.active = true;
        this.visible = true;
        this.scene = null;
        
        this.sprite = null;
        this.color = '#ffffff';
        this.layer = 0;
    }
    
    addTag(tag) {
        this.tags.add(tag);
        return this;
    }
    
    hasTag(tag) {
        return this.tags.has(tag);
    }
    
    addComponent(component) {
        component.entity = this;
        this.components.set(component.constructor.name, component);
        component.onAttach();
        return this;
    }
    
    getComponent(type) {
        return this.components.get(type.name);
    }
    
    hasComponent(type) {
        return this.components.has(type.name);
    }
    
    removeComponent(type) {
        const component = this.components.get(type.name);
        if (component) {
            component.onDetach();
            this.components.delete(type.name);
        }
        return this;
    }
    
    update(dt) {
        if (!this.active) return;
        
        // Update components
        for (const component of this.components.values()) {
            if (component.active) {
                component.update(dt);
            }
        }
        
        // Apply physics
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        
        // Apply friction
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        
        // Clamp speed
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }
        
        // Move
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
    }
    
    render(ctx) {
        if (!this.visible) return;
        
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale.x, this.scale.y);
        
        // Render components
        for (const component of this.components.values()) {
            if (component.visible) {
                component.render(ctx);
            }
        }
        
        // Default render (placeholder sprite)
        if (!this.sprite) {
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        
        ctx.restore();
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height,
            centerX: this.x + this.width / 2,
            centerY: this.y + this.height / 2
        };
    }
    
    collidesWith(other) {
        const a = this.getBounds();
        const b = other.getBounds();
        return a.left < b.right && a.right > b.left && 
               a.top < b.bottom && a.bottom > b.top;
    }
    
    distanceTo(other) {
        const dx = (this.x + this.width/2) - (other.x + other.width/2);
        const dy = (this.y + this.height/2) - (other.y + other.height/2);
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    angleTo(other) {
        const dx = (other.x + other.width/2) - (this.x + this.width/2);
        const dy = (other.y + other.height/2) - (this.y + this.height/2);
        return Math.atan2(dy, dx);
    }
    
    destroy() {
        this.active = false;
        if (this.scene) {
            this.scene.removeEntity(this);
        }
    }
}

export class Component {
    constructor() {
        this.entity = null;
        this.active = true;
        this.visible = true;
    }
    
    onAttach() {}
    onDetach() {}
    update(dt) {}
    render(ctx) {}
}

// Useful built-in components
export class SpriteComponent extends Component {
    constructor(color = '#ffffff', shape = 'rect') {
        super();
        this.color = color;
        this.shape = shape;
        this.outlineColor = null;
        this.outlineWidth = 2;
    }
    
    render(ctx) {
        const e = this.entity;
        ctx.fillStyle = this.color;
        
        if (this.shape === 'rect') {
            ctx.fillRect(-e.width / 2, -e.height / 2, e.width, e.height);
            if (this.outlineColor) {
                ctx.strokeStyle = this.outlineColor;
                ctx.lineWidth = this.outlineWidth;
                ctx.strokeRect(-e.width / 2, -e.height / 2, e.width, e.height);
            }
        } else if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, e.width / 2, 0, Math.PI * 2);
            ctx.fill();
            if (this.outlineColor) {
                ctx.strokeStyle = this.outlineColor;
                ctx.lineWidth = this.outlineWidth;
                ctx.stroke();
            }
        } else if (this.shape === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(0, -e.height / 2);
            ctx.lineTo(-e.width / 2, e.height / 2);
            ctx.lineTo(e.width / 2, e.height / 2);
            ctx.closePath();
            ctx.fill();
        }
    }
}

export class AnimationComponent extends Component {
    constructor() {
        super();
        this.animations = new Map();
        this.currentAnimation = null;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.loop = true;
        this.playing = false;
    }
    
    addAnimation(name, frames, frameTime = 0.1) {
        this.animations.set(name, { frames, frameTime });
        return this;
    }
    
    play(name, loop = true) {
        if (this.currentAnimation !== name) {
            this.currentAnimation = name;
            this.frameIndex = 0;
            this.frameTimer = 0;
            this.loop = loop;
            this.playing = true;
        }
    }
    
    stop() {
        this.playing = false;
    }
    
    update(dt) {
        if (!this.playing || !this.currentAnimation) return;
        
        const anim = this.animations.get(this.currentAnimation);
        if (!anim) return;
        
        this.frameTimer += dt;
        if (this.frameTimer >= anim.frameTime) {
            this.frameTimer = 0;
            this.frameIndex++;
            
            if (this.frameIndex >= anim.frames.length) {
                if (this.loop) {
                    this.frameIndex = 0;
                } else {
                    this.frameIndex = anim.frames.length - 1;
                    this.playing = false;
                }
            }
        }
    }
    
    getCurrentFrame() {
        if (!this.currentAnimation) return null;
        const anim = this.animations.get(this.currentAnimation);
        return anim ? anim.frames[this.frameIndex] : null;
    }
}

export class HealthComponent extends Component {
    constructor(maxHealth = 100) {
        super();
        this.maxHealth = maxHealth;
        this.health = maxHealth;
        this.invulnerable = false;
        this.invulnerabilityTime = 0;
        this.flashTimer = 0;
        this.onDeath = null;
        this.onDamage = null;
    }
    
    takeDamage(amount, source = null) {
        if (this.invulnerable || this.health <= 0) return false;
        
        this.health = Math.max(0, this.health - amount);
        
        if (this.onDamage) {
            this.onDamage(amount, source);
        }
        
        if (this.health <= 0) {
            if (this.onDeath) {
                this.onDeath(source);
            }
            return true;
        }
        
        return false;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
    
    setInvulnerable(duration) {
        this.invulnerable = true;
        this.invulnerabilityTime = duration;
    }
    
    update(dt) {
        if (this.invulnerabilityTime > 0) {
            this.invulnerabilityTime -= dt;
            this.flashTimer += dt;
            if (this.invulnerabilityTime <= 0) {
                this.invulnerable = false;
            }
        }
    }
    
    getHealthPercent() {
        return this.health / this.maxHealth;
    }
}

export class ColliderComponent extends Component {
    constructor(type = 'rect', offsetX = 0, offsetY = 0, width = null, height = null) {
        super();
        this.type = type;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.width = width;
        this.height = height;
        this.isTrigger = false;
        this.layer = 0;
        this.onCollision = null;
    }
    
    getBounds() {
        const e = this.entity;
        return {
            x: e.x + this.offsetX,
            y: e.y + this.offsetY,
            width: this.width || e.width,
            height: this.height || e.height
        };
    }
    
    checkCollision(other) {
        if (other instanceof ColliderComponent) {
            const a = this.getBounds();
            const b = other.getBounds();
            
            if (this.type === 'rect' && other.type === 'rect') {
                return a.x < b.x + b.width && a.x + a.width > b.x &&
                       a.y < b.y + b.height && a.y + a.height > b.y;
            }
            // Add circle collision if needed
        }
        return false;
    }
}
