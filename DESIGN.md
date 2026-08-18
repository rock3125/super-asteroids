Decoupling world coordinates from the screen view and configuring layer-based collision filtering are the primary technical milestones for this infinite-space Asteroids architecture.

Technology: browser based game, 3d.js.

Layer	Player	Player Bullet	Asteroid / Super Asteroid	Flying Saucer
Player	—	Ignore	Collide	Collide
Player Bullet	Ignore	—	Collide	Collide
Asteroid	Collide	Collide	Ignore	Ignore
Flying Saucer	Collide	Collide	Ignore	—

Phase 1: Core Physics & Camera
    • Centric Camera: Lock ship visually to screen center $(0,0)$. Translate all renderable entities relative to the player's absolute world position: $\vec{Pos}_{\text{screen}} = \vec{Pos}_{\text{entity}} - \vec{Pos}_{\text{player}}$.
    • Friction Tuning: Apply a continuous drag coefficient to player velocity ($v_{t+1} = v_t \cdot d^{\Delta t}$, where $d \approx 0.95$). Holding thrust adds acceleration vectors; releasing it decelerates the ship smoothly to a full stop.
    • Infinite Field Spawning: Generate objects dynamically within an outer ring buffer (e.g., $1.2\times$ to $2.0\times$ screen viewport radius). Garbage collect or object-pool entities that drift outside the despawn perimeter.

Phase 2: Entity Lifecycle & Behavior
    • Super Asteroids & Splitting:
        ◦ Super Tier: High health pool, high mass, triggers screen shake and splits into 2 Large Asteroids.
        ◦ Standard Hierarchy: Large $\rightarrow$ 2 Medium $\rightarrow$ 2 Small $\rightarrow$ Particle Debris.
    • Flying Saucers: Implement erratic sine-wave pathing with periodic vector calculations aimed directly at player world coordinates.

Phase 3: Graphics & Sound Polish
    • Visual FX: Apply bloom post-processing for vector line glow, directional particle splinters along the split vector when asteroids break, and variable thruster flame scaling based on acceleration.
    • Audio Architecture: Combine sub-bass layers for Super Asteroid explosions, low-pass filtered engine hums modulated by ship velocity, and pitch-shifted laser fire to prevent audio fatigue.

