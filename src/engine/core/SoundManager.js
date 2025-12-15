/**
 * Sound Manager - Handles all game audio with variations, heartbeat, and floor-specific sounds
 */

// Sound categories and their files
const SOUND_LIBRARY = {
    // Chest sounds (variations)
    chest: ['Chest1.mp3', 'Chest2.mp3', 'Chest3.mp3'],
    
    // Fire sounds (variations)
    fire: ['Fire1.mp3', 'Fire2.mp3', 'Fire3.mp3'],
    
    // Footstep sounds (variations)
    footstep: ['Footstep1.mp3', 'Footstep2.mp3', 'Footstep3.mp3', 'Footstep4.mp3'],
    
    // Ghost sounds (variations)
    ghost: ['Ghost1.mp3', 'Ghost2.mp3', 'Ghost3.mp3', 'Ghost4.mp3', 'Ghost5.mp3'],
    
    // Slime sounds (variations)
    slime: ['Slime1.mp3', 'Slime2.mp3', 'Slime3.mp3'],
    
    // Zombie sounds (variations)
    zombie: ['Zombie1.mp3', 'Zombie2.mp3'],
    
    // Slash hit sounds (variations)
    slashHit: ['SlashHit1.mp3', 'SlashHit2.mp3'],
    
    // Swing miss sounds (variations)
    swingMiss: ['SwingNoHit1.mp3', 'SwingNoHit2.mp3'],
    
    // NPC Female sounds (variations)
    npcFemale: ['NPCFemaleInteract1.mp3', 'NPCFemaleInteract2.mp3', 'NPCFemaleInteract3.mp3', 
                'NPCFemaleInteract4.mp3', 'NPCFemaleInteract5.mp3', 'NPCFemaleInteract6.mp3', 
                'NPCFemaleInteract7.mp3'],
    
    // NPC Male sounds (variations)
    npcMale: ['NPCMaleInteract1.mp3', 'NPCMaleInteract2.mp3', 'NPCMaleInteract3.mp3',
              'NPCMaleInteract4.mp3', 'NPCMaleInteract5.mp3', 'NPCMaleInteract6.mp3',
              'NPCMaleInteract7.mp3'],
    
    // Coin sounds (variations)
    coin: ['Coin1.mp3', 'Coin2.mp3', 'Coin3.mp3', 'Coin4.mp3', 'Coin5.mp3'],
    
    // Demon ambient sounds (variations)
    demonAmbient: ['DemonAmbient.mp3', 'DemonAmbient2.mp3'],
    
    // Single sounds
    death: ['Death.mp3'],
    hurt: ['Hurt.mp3'],
    heal: ['Heal.mp3'],
    heart: ['Heart.mp3'],
    save: ['Save.mp3'],
    pageTurn: ['PageTurn.mp3'],
    goblinDeath: ['GoblinDeath.mp3'],
    goblinLaugh: ['GoblinLaugh.mp3'],
    monsterBreathing: ['MonsterBreathing.mp3'],
    largeMagic: ['LargeMagic.mp3'],
    slashLight: ['SlashLight.mp3'],
    wolfBite: ['WolfBite.mp3'],
    swarm: ['Swarm.mp3'],
    wind: ['Wind.mp3'],
    oroboros: ['Oroboros.mp3'],
    reaper: ['Reaper.mp3', 'TheReaper.mp3'],
    darkMagic: ['DarkMagic.mp3'],
    earth: ['earth.mp3'],
    smallMonsterAttack: ['small-monster-attack-195712.mp3'],
    sleepingDragon: ['SleepingDragon.mp3'],
    purgatory: ['Purgatory.mp3'],
    theFall: ['TheFall.mp3'],
    ambience: ['ambience.mp3'],
    dash: ['Dash.mp3'],
    arrow: ['Arrow.mp3'],
    dragonAwaken: ['DragonAwaken.mp3'],
    angelAttack: ['AngelAttack.mp3'],
    musketShot: ['MusketShot.mp3'],
    
    // Boss themes per floor type
    bossThemeEgypt: ['BossThemeEgypt.mp3'],
    bossThemeHades: ['BossThemeHades.mp3'],
    bossThemeJungle: ['BossThemeJungle.mp3'],
    bossThemeLight: ['BossThemeLight.mp3'],
    bossThemeCyber: ['BossThemeCyber.mp3'],
    bossThemeStone: ['BossThemeStone.mp3']
};

// Floor types and their associated sounds/enemies
export const FLOOR_THEMES = {
    egypt: {
        name: 'Egypt',
        bossTheme: 'bossThemeEgypt',
        ambientSounds: ['wind'],
        mobSounds: ['zombie', 'monsterBreathing'],
        enemies: ['mummy', 'scarab', 'anubisGuard', 'sandElemental'],
        boss: 'pharaoh',
        colors: {
            void: '#1a1508',
            floor: '#c4a35a',
            wall: '#8b7355',
            door: '#6b5344',
            accent: '#d4af37',
            highlight: '#f0d890'
        }
    },
    hades: {
        name: 'Hades',
        bossTheme: 'bossThemeHades',
        ambientSounds: ['fire', 'monsterBreathing'],
        mobSounds: ['ghost', 'reaper'],
        enemies: ['demon', 'hellhound', 'lostSoul', 'infernalGuard'],
        boss: 'cerberus',
        colors: {
            void: '#0a0000',
            floor: '#3a1a1a',
            wall: '#5a2020',
            door: '#4a1515',
            accent: '#ff4444',
            highlight: '#ff8866'
        }
    },
    jungle: {
        name: 'Jungle',
        bossTheme: 'bossThemeJungle',
        ambientSounds: ['swarm', 'monsterBreathing'],
        mobSounds: ['slime', 'smallMonsterAttack'],
        enemies: ['venomSpider', 'jungleTroll', 'poisonDart', 'carnivore'],
        boss: 'queenSpider',
        colors: {
            void: '#050a05',
            floor: '#2a3a2a',
            wall: '#3a4a3a',
            door: '#2a3525',
            accent: '#4a8a4a',
            highlight: '#6aba6a'
        }
    },
    light: {
        name: 'Light',
        bossTheme: 'bossThemeLight',
        ambientSounds: ['wind'],
        mobSounds: ['largeMagic'],
        enemies: ['holyKnight', 'seraph', 'lightWarden', 'pureSpirit'],
        boss: 'archangel',
        colors: {
            void: '#1a1a1a',
            floor: '#e8e8e0',
            wall: '#d4d4cc',
            door: '#c8c0a8',
            accent: '#ffd700',
            highlight: '#ffffee'
        }
    },
    cyber: {
        name: 'Cyber',
        bossTheme: 'bossThemeCyber',
        ambientSounds: ['monsterBreathing'],
        mobSounds: ['smallMonsterAttack'],
        enemies: ['securityDrone', 'combatBot', 'hackUnit', 'laserTurret'],
        boss: 'masterAI',
        colors: {
            void: '#0a0a0a',
            floor: '#3a3a3a',
            wall: '#4a4a4a',
            door: '#353535',
            accent: '#00aaff',
            highlight: '#88ccff'
        }
    },
    stone: {
        name: 'Stone',
        bossTheme: 'bossThemeStone',
        ambientSounds: ['earth', 'monsterBreathing'],
        mobSounds: ['earth'],
        enemies: ['golem', 'rockElemental', 'crystalGuard', 'shadowDweller'],
        boss: 'ancientGolem',
        colors: {
            void: '#0a0808',
            floor: '#3a3540',
            wall: '#4a4550',
            door: '#353040',
            accent: '#9966cc',
            highlight: '#bb99ee'
        }
    }
};

// Floor theme order
export const FLOOR_ORDER = ['egypt', 'hades', 'jungle', 'light', 'cyber', 'stone'];

export class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.masterVolume = 1.0;
        this.muted = false;
        
        // Currently playing music
        this.currentMusic = null;
        this.currentMusicKey = null;
        
        // Heartbeat system
        this.heartbeatAudio = null;
        this.heartbeatInterval = null;
        this.currentHeartRate = 60; // BPM
        this.minHeartRate = 60;
        this.maxHeartRate = 180;
        this.heartbeatEnabled = false;
        
        // Ambient sound
        this.ambientAudio = null;
        this.ambientSounds = [];
        this.ambientPlaying = false;
        
        // Sound path
        this.basePath = 'sound/';
        
        // Active sound tracking to prevent looping/stacking
        this.activeSounds = new Map(); // soundKey -> array of playing audios
        this.maxConcurrentSounds = 3; // Max same sound playing at once
        
        // Attack sound throttling
        this.lastAttackSoundTime = {};
        
        // Audio context for proper browser audio handling
        // Browsers suspend audio until user interaction
        this.audioContext = null;
        this.audioUnlocked = false;
        this.pendingSounds = []; // Queue sounds if audio not yet unlocked
        
        // Initialize audio context on first user interaction
        this.initAudioContext();
        
        // Preload common sounds
        this.preloadSounds();
    }
    
    // Initialize audio context and set up unlock listeners
    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
                
                // Check if already unlocked
                if (this.audioContext.state === 'running') {
                    this.audioUnlocked = true;
                }
                
                // Listen for state changes
                this.audioContext.onstatechange = () => {
                    if (this.audioContext.state === 'running') {
                        this.audioUnlocked = true;
                        this.flushPendingSounds();
                    }
                };
            }
        } catch (e) {
            console.warn('AudioContext not available:', e);
            // Fallback: assume audio works
            this.audioUnlocked = true;
        }
        
        // Add unlock listeners for user interaction
        const unlockAudio = () => {
            if (!this.audioUnlocked) {
                this.unlockAudio();
            }
        };
        
        // Multiple events to catch various interaction types
        ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
            document.addEventListener(event, unlockAudio, { once: false, passive: true });
        });
    }
    
    // Unlock audio context after user interaction
    unlockAudio() {
        if (this.audioUnlocked) return;
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.audioUnlocked = true;
                this.flushPendingSounds();
            }).catch(e => {
                console.warn('Failed to resume audio context:', e);
            });
        } else {
            this.audioUnlocked = true;
            this.flushPendingSounds();
        }
        
        // Play a silent sound to fully unlock on iOS
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        silentAudio.volume = 0;
        silentAudio.play().catch(() => {});
    }
    
    // Flush any sounds that were queued before audio was unlocked
    flushPendingSounds() {
        // Clear pending sounds - they're too old to play now
        // This prevents the "all sounds play at once" bug
        this.pendingSounds = [];
    }
    
    // Stop all combat-related sounds (call when combat ends)
    stopCombatSounds() {
        const combatKeys = ['slashHit', 'swingMiss', 'hurt'];
        for (const key of combatKeys) {
            const actives = this.activeSounds.get(key);
            if (actives) {
                for (const audio of actives) {
                    audio.pause();
                    audio.currentTime = 0;
                }
                actives.length = 0;
            }
        }
    }
    
    preloadSounds() {
        // Preload all sounds
        for (const [key, files] of Object.entries(SOUND_LIBRARY)) {
            this.sounds.set(key, files.map(file => {
                const audio = new Audio(this.basePath + file);
                audio.preload = 'auto';
                audio.loop = false; // Ensure no looping
                return audio;
            }));
        }
    }
    
    // Clean up finished sounds
    cleanupSounds(soundKey) {
        const actives = this.activeSounds.get(soundKey);
        if (!actives) return;
        
        // Remove finished sounds
        for (let i = actives.length - 1; i >= 0; i--) {
            if (actives[i].ended || actives[i].paused) {
                actives.splice(i, 1);
            }
        }
    }
    
    // Play a sound with optional variations
    play(soundKey, volume = 1.0) {
        if (this.muted) return null;
        
        // If audio isn't unlocked yet, drop the sound (don't queue it)
        // This prevents the "all sounds play at once" bug
        if (!this.audioUnlocked) {
            // Try to unlock on this attempt
            this.unlockAudio();
            return null; // Drop this sound, don't queue it
        }
        
        const sounds = this.sounds.get(soundKey);
        if (!sounds || sounds.length === 0) {
            console.warn(`Sound not found: ${soundKey}`);
            return null;
        }
        
        // Clean up finished sounds first
        this.cleanupSounds(soundKey);
        
        // Check if too many of this sound are playing
        let actives = this.activeSounds.get(soundKey);
        if (!actives) {
            actives = [];
            this.activeSounds.set(soundKey, actives);
        }
        
        if (actives.length >= this.maxConcurrentSounds) {
            // Stop oldest sound to make room
            const oldest = actives.shift();
            if (oldest) {
                oldest.pause();
                oldest.currentTime = 0;
            }
        }
        
        // Pick random variation
        const audio = sounds[Math.floor(Math.random() * sounds.length)].cloneNode();
        audio.volume = volume * this.sfxVolume * this.masterVolume;
        audio.loop = false; // Ensure no looping
        
        // Track this sound
        actives.push(audio);
        
        // Clean up when ended
        audio.onended = () => {
            const idx = actives.indexOf(audio);
            if (idx >= 0) actives.splice(idx, 1);
        };
        
        // Play immediately - audio should be unlocked by now
        audio.play().catch(e => {
            // If play fails, it's likely due to audio context being suspended
            // Don't log a warning for expected browser behavior
            if (e.name !== 'NotAllowedError') {
                console.warn('Audio play failed:', e);
            }
        });
        
        return audio;
    }
    
    // Play attack sound (hit or miss) - with throttling to prevent sound spam
    playAttackSound(hit) {
        const now = Date.now();
        const soundKey = hit ? 'slashHit' : 'swingMiss';
        
        // Throttle attack sounds - minimum 50ms between same type
        if (!this.lastAttackSoundTime) this.lastAttackSoundTime = {};
        const lastTime = this.lastAttackSoundTime[soundKey] || 0;
        if (now - lastTime < 50) return; // Too soon, skip
        
        this.lastAttackSoundTime[soundKey] = now;
        
        if (hit) {
            this.play('slashHit', 0.6);
        } else {
            this.play('swingMiss', 0.5);
        }
    }
    
    // Play hurt sound
    playHurt() {
        this.play('hurt', 0.7);
    }
    
    // Play death sound
    playDeath() {
        this.play('death', 0.8);
    }
    
    // Play heal sound
    playHeal() {
        this.play('heal', 0.6);
    }
    
    // Play chest open sound
    playChest() {
        this.play('chest', 0.7);
    }
    
    // Play footstep (should be called while moving)
    playFootstep() {
        this.play('footstep', 0.15);
    }
    
    // Play dash sound
    playDash() {
        this.play('dash', 0.5);
    }
    
    // Play coin pickup sound
    playCoin() {
        this.play('coin', 0.4);
    }
    
    // Play arrow sound
    playArrow() {
        this.play('arrow', 0.5);
    }
    
    // Play musket shot sound
    playMusketShot() {
        this.play('musketShot', 0.6);
    }
    
    // Play NPC female interaction sound
    playNPCFemale() {
        this.play('npcFemale', 0.6);
    }
    
    // Play NPC male interaction sound
    playNPCMale() {
        this.play('npcMale', 0.6);
    }
    
    // Play random NPC sound (male or female)
    playNPCInteract(isFemale = Math.random() > 0.5) {
        if (isFemale) {
            this.playNPCFemale();
        } else {
            this.playNPCMale();
        }
    }
    
    // Play sound by name (for class-specific sounds)
    playSound(soundName, volume = 0.5) {
        this.play(soundName, volume);
    }
    
    // Play enemy sound by type
    playEnemySound(enemyType) {
        // Map enemy types to sound categories
        const soundMap = {
            ghost: 'ghost',
            zombie: 'zombie',
            mummy: 'zombie',
            slime: 'slime',
            goblin: 'goblinLaugh',
            demon: 'fire',
            hellhound: 'wolfBite',
            lostSoul: 'ghost',
            venomSpider: 'smallMonsterAttack',
            jungleTroll: 'smallMonsterAttack',
            golem: 'earth',
            rockElemental: 'earth',
            shadowDweller: 'ghost',
            securityDrone: 'smallMonsterAttack',
            combatBot: 'smallMonsterAttack',
            seraph: 'largeMagic',
            lightWarden: 'largeMagic'
        };
        
        const soundKey = soundMap[enemyType] || 'smallMonsterAttack';
        this.play(soundKey, 0.4);
    }
    
    // Play boss theme based on floor theme
    playBossTheme(floorTheme) {
        const theme = FLOOR_THEMES[floorTheme];
        if (!theme) return;
        
        // Try to play the theme's boss music, with fallbacks
        const bossThemeKey = theme.bossTheme;
        const fallbacks = ['oroboros', 'darkMagic', 'reaper', 'largeMagic'];
        
        // Try main theme first
        if (this.playMusic(bossThemeKey)) return;
        
        // Try fallbacks
        for (const fallback of fallbacks) {
            if (this.playMusic(fallback)) return;
        }
        
        console.warn(`No boss music available for floor: ${floorTheme}`);
    }
    
    // Play music (looping) - returns true if successful
    playMusic(musicKey) {
        // Stop current music
        this.stopMusic();
        
        const sounds = this.sounds.get(musicKey);
        if (!sounds || sounds.length === 0) {
            // Don't warn here, let caller handle fallback
            return false;
        }
        
        this.currentMusic = sounds[0].cloneNode();
        this.currentMusic.volume = this.musicVolume * this.masterVolume;
        this.currentMusic.loop = true;
        this.currentMusicKey = musicKey;
        this.currentMusic.play().catch(e => console.warn('Music play failed:', e));
        return true;
    }
    
    // Stop current music
    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
            this.currentMusicKey = null;
        }
    }
    
    // Fade out current music over duration (in ms)
    fadeMusic(duration = 2000) {
        if (!this.currentMusic) return;
        
        const audio = this.currentMusic;
        const startVolume = audio.volume;
        const fadeSteps = 30;
        const stepDuration = duration / fadeSteps;
        const volumeStep = startVolume / fadeSteps;
        let currentStep = 0;
        
        const fadeInterval = setInterval(() => {
            currentStep++;
            audio.volume = Math.max(0, startVolume - (volumeStep * currentStep));
            
            if (currentStep >= fadeSteps) {
                clearInterval(fadeInterval);
                this.stopMusic();
            }
        }, stepDuration);
    }
    
    // Heartbeat system - rate adjusts based on health percentage
    startHeartbeat() {
        this.heartbeatEnabled = true;
        this.playHeartbeat();
    }
    
    stopHeartbeat() {
        this.heartbeatEnabled = false;
        if (this.heartbeatInterval) {
            clearTimeout(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    playHeartbeat() {
        if (!this.heartbeatEnabled || this.muted) return;
        
        // Play heartbeat sound
        const sounds = this.sounds.get('heart');
        if (sounds && sounds.length > 0) {
            const audio = sounds[0].cloneNode();
            // Volume increases as heart rate increases (louder when dying)
            // Increased base volume for audibility
            const volumeScale = 0.8 + (this.currentHeartRate - this.minHeartRate) / 
                               (this.maxHeartRate - this.minHeartRate) * 0.2;
            audio.volume = volumeScale * this.sfxVolume * this.masterVolume;
            audio.play().catch(e => {});
        }
        
        // Calculate interval based on BPM
        // 60 BPM = 1000ms between beats, 180 BPM = 333ms
        const interval = 60000 / this.currentHeartRate;
        
        this.heartbeatInterval = setTimeout(() => this.playHeartbeat(), interval);
    }
    
    // Update heartbeat rate based on health percentage
    updateHeartbeat(healthPercent) {
        // Inverse relationship: lower health = higher heart rate
        // At 100% health: 60 BPM (resting)
        // At 0% health: 180 BPM (maximum)
        this.currentHeartRate = Math.floor(
            this.minHeartRate + (1 - healthPercent) * (this.maxHeartRate - this.minHeartRate)
        );
    }
    
    // Set volumes
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume * this.masterVolume;
        }
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume * this.masterVolume;
        }
    }
    
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }
    
    toggleMute() {
        this.muted = !this.muted;
        if (this.currentMusic) {
            this.currentMusic.muted = this.muted;
        }
        if (this.ambientAudio) {
            this.ambientAudio.muted = this.muted;
        }
        if (this.muted) {
            this.stopHeartbeat();
        }
        return this.muted;
    }
    
    // Start ambient loop
    startAmbient() {
        if (this.ambientPlaying) return;
        
        const sounds = this.sounds.get('ambience');
        if (!sounds || sounds.length === 0) {
            console.warn('Ambient sound not found');
            return;
        }
        
        this.ambientAudio = sounds[0].cloneNode();
        this.ambientAudio.volume = 0.8 * this.masterVolume;
        this.ambientAudio.loop = true;
        this.ambientPlaying = true;
        this.ambientAudio.play().catch(e => {
            console.warn('Ambient play failed (autoplay policy):', e);
            // Retry on first user interaction
            const retryAmbient = () => {
                if (this.ambientAudio && !this.ambientAudio.paused) return;
                this.ambientAudio.play().catch(() => {});
                document.removeEventListener('click', retryAmbient);
                document.removeEventListener('keydown', retryAmbient);
            };
            document.addEventListener('click', retryAmbient, { once: true });
            document.addEventListener('keydown', retryAmbient, { once: true });
        });
    }
    
    // Stop ambient loop
    stopAmbient() {
        if (this.ambientAudio) {
            this.ambientAudio.pause();
            this.ambientAudio.currentTime = 0;
            this.ambientAudio = null;
            this.ambientPlaying = false;
        }
    }
    
    // Play fire/torch light sound
    playTorchLight() {
        this.play('fire', 0.6);
    }
}

export default SoundManager;
