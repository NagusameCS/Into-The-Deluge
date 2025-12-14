/**
 * Utility Functions and Math Helpers
 */

export const Utils = {
    // Random number between min and max
    random(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    // Random integer between min and max (inclusive)
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    // Random item from array
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    // Shuffle array in place
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    
    // Clamp value between min and max
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    // Linear interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    
    // Smooth step interpolation
    smoothStep(a, b, t) {
        t = t * t * (3 - 2 * t);
        return a + (b - a) * t;
    },
    
    // Distance between two points
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },
    
    // Angle between two points
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },
    
    // Degrees to radians
    degToRad(degrees) {
        return degrees * (Math.PI / 180);
    },
    
    // Radians to degrees
    radToDeg(radians) {
        return radians * (180 / Math.PI);
    },
    
    // Normalize angle to -PI to PI
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    },
    
    // Vector operations
    vec: {
        add(a, b) {
            return { x: a.x + b.x, y: a.y + b.y };
        },
        sub(a, b) {
            return { x: a.x - b.x, y: a.y - b.y };
        },
        mul(v, scalar) {
            return { x: v.x * scalar, y: v.y * scalar };
        },
        div(v, scalar) {
            return { x: v.x / scalar, y: v.y / scalar };
        },
        length(v) {
            return Math.sqrt(v.x * v.x + v.y * v.y);
        },
        normalize(v) {
            const len = this.length(v);
            if (len === 0) return { x: 0, y: 0 };
            return { x: v.x / len, y: v.y / len };
        },
        dot(a, b) {
            return a.x * b.x + a.y * b.y;
        },
        rotate(v, angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: v.x * cos - v.y * sin,
                y: v.x * sin + v.y * cos
            };
        },
        fromAngle(angle, length = 1) {
            return {
                x: Math.cos(angle) * length,
                y: Math.sin(angle) * length
            };
        }
    },
    
    // Color utilities
    color: {
        // HSL to RGB
        hslToRgb(h, s, l) {
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        },
        
        // Interpolate between two hex colors
        lerp(color1, color2, t) {
            const r1 = parseInt(color1.slice(1, 3), 16);
            const g1 = parseInt(color1.slice(3, 5), 16);
            const b1 = parseInt(color1.slice(5, 7), 16);
            const r2 = parseInt(color2.slice(1, 3), 16);
            const g2 = parseInt(color2.slice(3, 5), 16);
            const b2 = parseInt(color2.slice(5, 7), 16);
            
            const r = Math.round(r1 + (r2 - r1) * t);
            const g = Math.round(g1 + (g2 - g1) * t);
            const b = Math.round(b1 + (b2 - b1) * t);
            
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        },
        
        // Add alpha to hex color
        withAlpha(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    },
    
    // Timer/Cooldown helper
    createTimer(duration) {
        return {
            elapsed: 0,
            duration: duration,
            finished: false,
            update(dt) {
                if (!this.finished) {
                    this.elapsed += dt;
                    if (this.elapsed >= this.duration) {
                        this.finished = true;
                    }
                }
                return this.finished;
            },
            reset() {
                this.elapsed = 0;
                this.finished = false;
            },
            getProgress() {
                return Math.min(1, this.elapsed / this.duration);
            }
        };
    },
    
    // Object pool for performance
    createPool(factory, initialSize = 10) {
        const pool = [];
        const active = [];
        
        for (let i = 0; i < initialSize; i++) {
            pool.push(factory());
        }
        
        return {
            get() {
                let obj = pool.pop();
                if (!obj) {
                    obj = factory();
                }
                active.push(obj);
                return obj;
            },
            release(obj) {
                const index = active.indexOf(obj);
                if (index > -1) {
                    active.splice(index, 1);
                    pool.push(obj);
                }
            },
            getActive() {
                return active;
            },
            clear() {
                while (active.length > 0) {
                    pool.push(active.pop());
                }
            }
        };
    }
};

// Named exports for convenience
export const randomFloat = Utils.random;
export const randomInt = Utils.randomInt;
export const clamp = Utils.clamp;
export const lerp = Utils.lerp;
export const distance = Utils.distance;

// Vector2 class for compatibility
export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mul(s) { return new Vector2(this.x * s, this.y * s); }
    div(s) { return new Vector2(this.x / s, this.y / s); }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const len = this.length();
        return len > 0 ? this.div(len) : new Vector2();
    }
    dot(v) { return this.x * v.x + this.y * v.y; }
    clone() { return new Vector2(this.x, this.y); }
    
    static distance(a, b) {
        return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }
}

export default Utils;
