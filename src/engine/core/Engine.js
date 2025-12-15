/**
 * Into The Deluge - Custom Game Engine
 * Core Engine Module
 */

// Camera class with all needed methods
class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0;
        this.y = 0;
        this.width = canvas ? canvas.width : 1280;
        this.height = canvas ? canvas.height : 720;
        this.zoom = 1;
        this.targetZoom = 1;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.targetX = 0;
        this.targetY = 0;
        
        // Cinematic effects
        this.impactZoom = 1; // Momentary zoom on big hits
        this.impactZoomDecay = 0;
        this.slowMotion = 1; // Time scale (1 = normal)
        this.slowMotionDuration = 0;
    }
    
    centerOn(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
    }
    
    smoothFollow(x, y, speed, dt) {
        this.targetX = x;
        this.targetY = y;
        this.x += (this.targetX - this.x) * speed * dt;
        this.y += (this.targetY - this.y) * speed * dt;
    }
    
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }
    
    // Cinematic impact zoom - brief zoom in on big hits
    impactEffect(zoomAmount = 1.1, duration = 0.15) {
        this.impactZoom = zoomAmount;
        this.impactZoomDecay = duration;
    }
    
    // Slow motion effect
    slowMo(scale = 0.3, duration = 0.2) {
        this.slowMotion = scale;
        this.slowMotionDuration = duration;
    }
    
    // Get effective time scale for slow motion
    getTimeScale() {
        return this.slowMotion;
    }
    
    update(dt) {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
        }
        
        // Update impact zoom
        if (this.impactZoomDecay > 0) {
            this.impactZoomDecay -= dt;
            if (this.impactZoomDecay <= 0) {
                this.impactZoom = 1;
            }
        }
        
        // Update slow motion
        if (this.slowMotionDuration > 0) {
            this.slowMotionDuration -= dt;
            if (this.slowMotionDuration <= 0) {
                this.slowMotion = 1;
            }
        }
        
        // Smooth zoom interpolation
        this.zoom += (this.targetZoom * this.impactZoom - this.zoom) * 5 * dt;
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: screenX / this.zoom + this.x - this.canvas.width / 2 / this.zoom,
            y: screenY / this.zoom + this.y - this.canvas.height / 2 / this.zoom
        };
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x + this.canvas.width / 2 / this.zoom) * this.zoom,
            y: (worldY - this.y + this.canvas.height / 2 / this.zoom) * this.zoom
        };
    }
    
    getShakeOffset() {
        if (this.shakeDuration <= 0) return { x: 0, y: 0 };
        return {
            x: (Math.random() - 0.5) * this.shakeIntensity,
            y: (Math.random() - 0.5) * this.shakeIntensity
        };
    }
}

export class Engine {
    constructor(canvasId, width = 1280, height = 720) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Hide the system cursor
        this.canvas.style.cursor = 'none';
        
        this.running = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;
        
        // Core systems
        this.systems = new Map();
        this.scenes = new Map();
        this.currentScene = null;
        
        // Input state
        this.input = {
            keys: new Set(),
            keysJustPressed: new Set(),
            keysJustReleased: new Set(),
            mouse: { x: 0, y: 0, buttons: new Set() },
            mouseJustPressed: new Set(),
            mouseJustReleased: new Set()
        };
        
        // Camera
        this.camera = new Camera(this.canvas);
        
        // Custom update/render callbacks
        this.customUpdate = null;
        this.customRender = null;
        
        this.setupInputListeners();
    }
    
    setupInputListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.input.keys.has(e.code)) {
                this.input.keysJustPressed.add(e.code);
            }
            this.input.keys.add(e.code);
            e.preventDefault();
        });
        
        window.addEventListener('keyup', (e) => {
            this.input.keys.delete(e.code);
            this.input.keysJustReleased.add(e.code);
            e.preventDefault();
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.input.mouse.x = e.clientX - rect.left;
            this.input.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            this.input.mouse.buttons.add(e.button);
            this.input.mouseJustPressed.add(e.button);
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.input.mouse.buttons.delete(e.button);
            this.input.mouseJustReleased.add(e.button);
        });
        
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    // Input helpers
    isKeyDown(key) {
        return this.input.keys.has(key);
    }
    
    isKeyPressed(key) {
        return this.input.keys.has(key);
    }
    
    isKeyJustPressed(key) {
        return this.input.keysJustPressed.has(key);
    }
    
    wasKeyJustPressed(key) {
        return this.input.keysJustPressed.has(key);
    }
    
    isMouseDown(button = 0) {
        return this.input.mouse.buttons.has(button);
    }
    
    isMousePressed(button = 0) {
        return this.input.mouse.buttons.has(button);
    }
    
    isMouseJustPressed(button = 0) {
        return this.input.mouseJustPressed.has(button);
    }
    
    wasMouseJustPressed(button = 0) {
        return this.input.mouseJustPressed.has(button);
    }
    
    getMousePosition() {
        return { x: this.input.mouse.x, y: this.input.mouse.y };
    }
    
    // Camera methods
    setCameraPosition(x, y) {
        this.camera.x = x;
        this.camera.y = y;
    }
    
    centerCameraOn(entity) {
        this.camera.x = entity.x - this.canvas.width / 2 / this.camera.zoom;
        this.camera.y = entity.y - this.canvas.height / 2 / this.camera.zoom;
    }
    
    shakeCamera(intensity, duration) {
        this.camera.shake.intensity = intensity;
        this.camera.shake.duration = duration;
    }
    
    // Scene management
    addScene(name, scene) {
        this.scenes.set(name, scene);
        scene.engine = this;
    }
    
    setScene(name) {
        if (this.currentScene) {
            this.currentScene.onExit();
        }
        this.currentScene = this.scenes.get(name);
        if (this.currentScene) {
            this.currentScene.onEnter();
        }
    }
    
    // Main game loop
    start(updateCallback = null, renderCallback = null) {
        this.customUpdate = updateCallback;
        this.customRender = renderCallback;
        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    stop() {
        this.running = false;
    }
    
    gameLoop(currentTime = performance.now()) {
        if (!this.running) return;
        
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Cap delta time to prevent physics issues
        if (this.deltaTime > 0.1) this.deltaTime = 0.1;
        
        // FPS calculation
        this.frameCount++;
        this.fpsTimer += this.deltaTime;
        if (this.fpsTimer >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }
        
        // Update
        this.update(this.deltaTime);
        
        // Render
        this.render();
        
        // Clear just-pressed inputs
        this.input.keysJustPressed.clear();
        this.input.keysJustReleased.clear();
        this.input.mouseJustPressed.clear();
        this.input.mouseJustReleased.clear();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    update(dt) {
        // Update camera shake
        this.camera.update(dt);
        
        // Custom update callback (used by Game.js)
        if (this.customUpdate) {
            this.customUpdate(dt);
        }
        
        // Update current scene
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Custom render callback (used by Game.js)
        if (this.customRender) {
            this.customRender(this.ctx);
        } else if (this.currentScene) {
            // Apply camera transform
            this.ctx.save();
            
            // Apply shake
            const shake = this.camera.getShakeOffset();
            
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.ctx.translate(
                -this.camera.x + this.canvas.width / 2 / this.camera.zoom + shake.x,
                -this.camera.y + this.canvas.height / 2 / this.camera.zoom + shake.y
            );
            
            // Render current scene
            this.currentScene.render(this.ctx);
            
            this.ctx.restore();
            
            // Render UI (not affected by camera)
            this.currentScene.renderUI(this.ctx);
        }
        
        // Debug info
        if (this.debug) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px monospace';
            this.ctx.fillText(`FPS: ${this.fps}`, 10, 20);
        }
    }
}

export class Scene {
    constructor() {
        this.engine = null;
        this.entities = [];
    }
    
    onEnter() {}
    onExit() {}
    update(dt) {}
    render(ctx) {}
    renderUI(ctx) {}
    
    addEntity(entity) {
        this.entities.push(entity);
        entity.scene = this;
        return entity;
    }
    
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
    }
    
    getEntitiesByTag(tag) {
        return this.entities.filter(e => e.tags && e.tags.has(tag));
    }
}
