# Advanced Screeps Tactics & Strategy Brainstorming

## Overview
This document outlines advanced concepts, optimization strategies, and architectural improvements for Screeps beyond the basic starter code.

---

## 1. STATIC HARVESTING (High Priority - Implement Early)

### Concept
Instead of harvesters running back and forth, dedicate specific creeps to mining who stay at sources permanently, while separate "hauler" creeps transport the energy.

### Benefits
- **Efficiency**: Miners need fewer MOVE parts (saves energy on spawning)
- **Throughput**: Can harvest full source capacity (3000 energy every 300 ticks)
- **CPU Savings**: Less pathfinding since miners don't move

### Implementation Patterns

#### A. Drop Mining (Simplest)
```javascript
// Miner with no CARRY parts - just [WORK, WORK, WORK, WORK, WORK, MOVE]
// Energy drops on ground, haulers pick it up
// Decay rate: ceil(amount/1000) per tick (min 1 energy/tick)
```

#### B. Container Mining (Recommended)
```javascript
// Build container at source
// Miner sits on container: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]
// Harvests into container, repairs it with CARRY part
// Container decay: 5000 hits per 100 ticks (500 ticks in owned rooms)
// Haulers: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE] pull from container
```

#### C. Link Mining (Late Game - RCL 5+)
```javascript
// Build link near source
// Miner harvests, transfers to link
// Link sends to receiver link near spawn/storage
// 3% energy loss per transfer
// Best for distant sources or cross-room operations
```

### Key Design Decisions
1. **Miner Body Optimization**: 
   - 5 WORK parts mine exactly 10 energy/tick (source capacity)
   - With container: add 1 CARRY for repairs
   - Movement: 1 MOVE part sufficient if using roads

2. **Hauler Sizing**:
   - Match to distance and energy flow
   - Rule of thumb: CARRY parts = MOVE parts / 2 (with roads)
   - Without roads: CARRY parts = MOVE parts

---

## 2. REMOTE HARVESTING (Critical for Growth)

### Concept
Harvest energy from adjacent unowned rooms and bring it back to your owned room.

### Key Points
- **Unowned room sources**: 1500 energy per 300 ticks
- **Reserved room sources**: 3000 energy per 300 ticks (same as owned)
- **Reserved rooms**: Use creeps with CLAIM parts to reserve controller

### Implementation Strategy

#### Phase 1: Basic Remote Harvesting
```javascript
// Simple harvester goes to adjacent room
// Fills up, returns to deposit
// Body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]
```

#### Phase 2: Dedicated Remote Mining
```javascript
// Remote Miner: Stays at remote source
// Remote Hauler: Shuttles between remote and home
// Reserver: Reserves the room controller (increases source capacity)
// Builder: Builds roads and containers in remote room
```

#### Phase 3: Defended Remote Mining
```javascript
// Add Guard creeps with ATTACK/RANGED_ATTACK
// Defend against invaders (appear more frequently in remote rooms)
// Repairer: Maintains roads and containers
```

### Economic Analysis
- Single remote room with 2 sources = +3000 energy income (with reservation)
- Cost: ~2-3 creeps worth of spawning
- ROI: Usually positive within 500-1000 ticks

### Road Network
- Build roads from home room to remote sources
- Cost: 1 energy per 1000 ticks per road tile (on plains)
- Savings: Reduces MOVE part requirements significantly
- Priority: High traffic paths first

---

## 3. CPU OPTIMIZATION STRATEGIES

### The CPU Problem
- CPU limit: 30 + (10 × GCL) for subscribers
- Bucket: Stores unused CPU (max 10,000)
- If bucket hits 0 and over limit, script execution halts

### High-Impact Optimizations

#### A. Path Caching (Critical)
```javascript
// Problem: moveTo() recalculates paths constantly
// Solution: Cache paths in Memory or global

// Basic pattern:
if (!creep.memory.path) {
    let path = creep.pos.findPathTo(target);
    creep.memory.path = Room.serializePath(path);
}
let result = creep.moveByPath(creep.memory.path);
if (result === ERR_NOT_FOUND) {
    // Path blocked, recalculate
    delete creep.memory.path;
}
```

**Advanced Caching:**
- Store common paths in Room memory (spawn to sources, spawn to controller)
- Use global object for frequently accessed data (cleared periodically)
- Compress paths using serialization
- TTL (time-to-live) on cached paths

#### B. Reduce find() Calls
```javascript
// Bad: Runs find() every tick for every creep
for (let creep of Object.values(Game.creeps)) {
    let sources = creep.room.find(FIND_SOURCES); // EXPENSIVE
}

// Good: Cache room data
if (!room.memory.sourceIds) {
    room.memory.sourceIds = room.find(FIND_SOURCES).map(s => s.id);
}
let sources = room.memory.sourceIds.map(id => Game.getObjectById(id));
```

#### C. Throttle Non-Critical Operations
```javascript
// Run expensive operations only every N ticks
if (Game.time % 10 === 0) {
    // Rebuild construction sites list
    // Clean up old memory
    // Recalculate room plans
}

if (Game.time % 50 === 0) {
    // Market analysis
    // Long-term strategic decisions
}
```

#### D. Early Exit Patterns
```javascript
// Exit early if creep is still spawning
if (creep.spawning) return;

// Don't process if no energy to spend
if (room.energyAvailable < 200) return;

// Skip rooms without visibility
if (!room.visual) return;
```

#### E. Memory Optimization
```javascript
// Problem: Large Memory = expensive JSON.parse/stringify

// Solution 1: Compress data
// Instead of: {x: 25, y: 30, roomName: 'E1S1'}
// Use: '25,30,E1S1'

// Solution 2: Use RawMemory segments (10 segments, 100KB each)
// For rarely-accessed data

// Solution 3: Clean up regularly
for (let name in Memory.creeps) {
    if (!Game.creeps[name]) {
        delete Memory.creeps[name];
    }
}
```

### CPU Profiling
```javascript
// Measure specific operations
let startCpu = Game.cpu.getUsed();
// ... operation ...
let endCpu = Game.cpu.getUsed();
console.log(`Operation took ${endCpu - startCpu} CPU`);
```

---

## 4. ADVANCED CREEP ROLES

### Specialized Roles

#### A. Static Miner
```javascript
// Body: [WORK×5, CARRY, MOVE] (600 energy)
// Task: Mine source, stay at container
// Priority: Repair container when damaged
```

#### B. Hauler/Courier
```javascript
// Body: [CARRY×16, MOVE×8] (1200 energy) with roads
// Task: Transport energy from containers to storage/spawn
// Strategy: Pick up from nearest full container, deliver to nearest empty structure
```

#### C. Upgrader (Optimized)
```javascript
// Body scales with RCL and energy available
// RCL 1-2: [WORK, CARRY, MOVE]
// RCL 3-7: [WORK×3, CARRY×2, MOVE×5]
// RCL 8: [WORK×15, CARRY×3, MOVE×9] (limited to 15 energy/tick)
```

#### D. Repairer
```javascript
// Body: [WORK×2, CARRY×2, MOVE×2]
// Priority: Roads > Containers > Ramparts > Walls
// Strategy: Only repair when below 50% health
```

#### E. Claimer/Reserver
```javascript
// Claimer: [CLAIM, MOVE] - Claims new rooms
// Reserver: [CLAIM, CLAIM, MOVE, MOVE] - Reserves remote rooms
// Lifespan affects duration: 1 CLAIM + 600 life = 1 tick reserved
```

#### F. Defender/Ranger
```javascript
// Melee: [TOUGH×5, ATTACK×5, MOVE×10]
// Ranged: [TOUGH×5, RANGED_ATTACK×5, MOVE×10, HEAL×2]
// Strategy: Patrol borders, respond to threats
```

---

## 5. ROOM PLANNING & LAYOUT

### The "Bunker" Design
A compact, efficient base layout popular in Screeps:

```
Concept:
- Central Storage/Terminal/Factory
- Labs clustered together (range 2 requirement)
- Spawn/Extensions in tight formation
- Towers in defensive positions
- Roads connecting everything
- Ramparts protecting key structures
```

### Benefits
- Minimal creep travel time
- Efficient energy distribution
- Easy to defend
- Predictable structure placement

### Implementation
- Pre-calculate optimal layout based on room terrain
- Store layout in Memory
- Automated construction site placement
- Progressive building as RCL increases

### Room Zoning
```javascript
// Core: Spawns, storage, terminal, factory
// Labs: Clustered for reactions
// Extensions: Radial pattern around spawns
// Defensive: Walls/ramparts on perimeter
// Mining: Containers at sources
```

---

## 6. DEFENSE STRATEGIES

### Tower Defense (Primary)
```javascript
// Available at RCL 3+
// Auto-target hostile creeps
// Range falloff: effective < 20 tiles

// Priority:
// 1. Heal damaged friendly creeps
// 2. Attack most dangerous hostiles
// 3. Repair critical structures (< 50% health)
```

### Defensive Creeps (Secondary)
```javascript
// Spawn defenders when hostiles detected
// Types:
// - Melee: High ATTACK damage
// - Ranged: RANGED_ATTACK for kiting
// - Healer: HEAL to support other defenders
```

### Safe Mode
- Available after attack
- 20,000 ticks of invulnerability
- Use wisely (limited uses)
- Gives time to build defenses

### Ramparts & Walls
```javascript
// Ramparts: Protect structures, allow friendly creeps
// Walls: Block all movement
// Strategy: Create chokepoints, protect core
// Maintenance: Auto-repair to target hit points
```

---

## 7. ECONOMY & RESOURCES

### Energy Flow Optimization
```
Sources → Containers → Storage → Spawn/Extensions
                              ↓
                         Controller (via Links)
```

### Storage Management
- Available at RCL 4
- Central energy reservoir (1,000,000 capacity)
- Enables consistent operations
- Link network for distribution

### Terminal (RCL 6+)
- Trade resources with other players
- Transfer between your own rooms
- Market operations (buy/sell)

### Mineral Processing
```javascript
// RCL 6: Extractor + Mineral harvesting
// RCL 7+: Labs for compound creation
// Boosts: Enhance creep capabilities (expensive but powerful)

// Example boost: XGH2O
// Effect: Upgrades WORK parts by 100% (upgradeController)
```

---

## 8. MULTI-ROOM STRATEGY

### Expansion Timing
- GCL (Global Control Level) increases with controller upgrades
- Each GCL level allows 1 additional claimed room
- Consider: Defense capability, CPU limits, code maturity

### Room Selection Criteria
```javascript
// Evaluate potential rooms:
// 1. Number of sources (prefer 2)
// 2. Distance from existing rooms
// 3. Defensibility (exits, terrain)
// 4. Remote mining potential (nearby unowned rooms)
// 5. Mineral type (for diverse compound production)
```

### Inter-Room Logistics
```javascript
// Energy sharing via terminals
// Creep assistance (builders, defenders)
// Coordinated defense
// Resource balancing
```

---

## 9. ADVANCED FEATURES (Late Game)

### Power Processing
- Harvest Power from Power Banks in "highway" rooms
- Process at Power Spawn (RCL 8)
- Enhances creep capabilities permanently
- Expensive but worthwhile

### Factory (RCL 7)
- Produces commodities
- Trade for credits
- Some commodities boost operations

### Observers (RCL 8)
- Gain vision to distant rooms
- Scout for threats/opportunities
- Plan expansion

### Nukes (RCL 8)
- Ultimate offensive weapon
- Expensive to produce and launch
- 10,000,000 energy + 5,000 Ghodium

---

## 10. CODE ARCHITECTURE IMPROVEMENTS

### Modular Design Pattern
```
/
├── main.js (Entry point)
├── managers/
│   ├── creepManager.js (Spawning logic)
│   ├── roomManager.js (Room operations)
│   ├── defenseManager.js (Security)
│   ├── economyManager.js (Resource allocation)
│   └── expansionManager.js (Multi-room)
├── roles/
│   ├── harvester.js
│   ├── hauler.js
│   ├── upgrader.js
│   └── builder.js
├── utils/
│   ├── pathCache.js
│   ├── bodyBuilder.js (Dynamic creep bodies)
│   └── profiler.js (CPU measurement)
└── config/
    ├── constants.js
    └── roomLayouts.js
```

### State Machine Pattern for Creeps
```javascript
// Instead of: if/else chains
// Use: State-based logic

// States: 'harvesting', 'delivering', 'upgrading', 'building'
if (!creep.memory.state) {
    creep.memory.state = 'harvesting';
}

switch (creep.memory.state) {
    case 'harvesting':
        // harvest logic
        if (creep.store.getFreeCapacity() === 0) {
            creep.memory.state = 'delivering';
        }
        break;
    case 'delivering':
        // delivery logic
        if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.state = 'harvesting';
        }
        break;
}
```

### Task Queue System
```javascript
// Central task management
// Creeps request tasks, manager assigns based on priority

class TaskManager {
    constructor() {
        this.tasks = [];
    }
    
    addTask(type, priority, target) {
        this.tasks.push({type, priority, target, assigned: false});
    }
    
    assignTask(creep) {
        // Sort by priority, assign highest unassigned task
        let task = this.tasks
            .filter(t => !t.assigned)
            .sort((a, b) => b.priority - a.priority)[0];
        
        if (task) {
            task.assigned = true;
            creep.memory.task = task;
            return task;
        }
    }
}
```

---

## 11. PRIORITY ROADMAP FOR IMPROVEMENT

### Phase 1: Foundation (RCL 1-3)
1. ✅ Basic harvesting, upgrading, building
2. Implement static harvesting with containers
3. Add basic path caching
4. Memory cleanup system
5. Dynamic creep body sizing

### Phase 2: Efficiency (RCL 3-5)
1. Separate miners and haulers
2. Implement remote harvesting (1-2 rooms)
3. Advanced path caching
4. Tower defense automation
5. Road network construction

### Phase 3: Scaling (RCL 5-7)
1. Link network for energy distribution
2. Multiple remote rooms (3-5)
3. Labs for mineral processing
4. Market participation
5. Second room claiming

### Phase 4: Optimization (RCL 7-8)
1. CPU profiling and optimization
2. Factory operations
3. Power harvesting
4. Advanced defense (coordinated creeps)
5. Expansion strategy (3+ rooms)

### Phase 5: Domination (RCL 8+)
1. Aggressive expansion
2. Boosted creeps
3. Offensive operations
4. Power processing
5. Nuke capability

---

## 12. COMMON PITFALLS TO AVOID

### 1. Over-Optimization Too Early
- Don't spend weeks optimizing RCL 1-2 code
- Basic efficiency is fine early game
- Focus on progression to RCL 4+ where real optimization matters

### 2. Memory Bloat
- Clean up dead creep memory
- Don't store unnecessary data
- Use TTL on cached values

### 3. CPU Spikes
- moveTo() without caching
- find() in loops
- Excessive logging

### 4. Single Point of Failure
- One harvester dies → energy crisis
- Always maintain minimum creep counts
- Emergency spawning logic

### 5. Ignoring Remote Mining
- Limits growth severely
- Remote mining is energy-positive quickly
- Should be implemented by RCL 4-5

### 6. Poor Spawn Prioritization
- Harvesters should always be highest priority
- Without energy, nothing else matters
- Emergency spawning for critical roles

---

## 13. RESOURCES & TOOLS

### Essential Links
- Official API: https://docs.screeps.com/api/
- Wiki: https://wiki.screepspl.us/
- Discord: Active community for help
- GitHub: Many open-source bots to study

### Useful Libraries
- Traveler.js: Advanced pathfinding
- screeps-profiler: CPU profiling
- TypeScript definitions: Type-safe development

### Development Tools
- Screeps IDE: In-browser editor
- External editors: VSCode with Screeps extension
- Private servers: Test without affecting MMO
- Screeps Simulator: Test scenarios

---

## CONCLUSION

Screeps is a game of continuous improvement. Start simple, measure performance, identify bottlenecks, and optimize. The journey from basic harvesters to a multi-room empire with advanced logistics is incredibly rewarding.

Key takeaways:
1. **Static harvesting** is the first major efficiency improvement
2. **Remote harvesting** is critical for growth beyond 1 room
3. **CPU optimization** becomes essential as you scale
4. **Architecture** matters - plan for modularity
5. **Measure everything** - profile before optimizing

Remember: The best code is code that ships. Perfect is the enemy of good. Build something that works, then make it better!
