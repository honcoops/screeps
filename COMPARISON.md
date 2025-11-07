# Basic vs Improved Code - Quick Comparison

## Architecture Changes

### Basic Code Structure
```
main.js
├── Simple role assignments
├── Fixed creep bodies
├── No caching
└── Manual spawning logic

Roles:
├── role.harvester.js  (mobile harvesters)
├── role.upgrader.js
└── role.builder.js
```

### Improved Code Structure
```
main.improved.js
├── Manager coordination
├── Memory management
├── CPU profiling
└── Modular design

Managers:
├── manager.spawn.js   (dynamic spawning)
├── manager.room.js    (room operations)
└── manager.memory.js  (optimization)

Roles:
├── role.miner.js      (static mining)
├── role.hauler.js     (energy transport)
├── role.upgrader.js   (from basic)
└── role.builder.js    (from basic)
```

---

## Code Comparisons

### Spawning Logic

#### Basic Code
```javascript
// Fixed body, manual counts
if(harvesters.length < 2) {
    spawn.spawnCreep([WORK, CARRY, MOVE], newName, 
        {memory: {role: 'harvester'}});
}
```

#### Improved Code
```javascript
// Dynamic body based on energy/RCL
getMinerBody: function(energy, rcl) {
    if (energy >= 550) {
        return [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 5 WORK!
    } else if (energy >= 350) {
        return [WORK, WORK, WORK, CARRY, MOVE];
    } else {
        return [WORK, WORK, CARRY, MOVE];
    }
}
```

**Benefit**: Creeps automatically get stronger as you level up

---

### Harvesting

#### Basic Code
```javascript
// Mobile harvester
if(creep.store.getFreeCapacity() > 0) {
    // Move to source
    creep.moveTo(sources[0]);
    creep.harvest(sources[0]);
} else {
    // Move to spawn
    creep.moveTo(spawn);
    creep.transfer(spawn, RESOURCE_ENERGY);
}
```
**Problems:**
- Wastes time walking
- Needs MOVE + CARRY parts (expensive)
- Path calculated every tick (CPU intensive)
- Only ~4-6 energy/tick per creep

#### Improved Code
```javascript
// Static miner (stays at source)
if (!creep.pos.isNearTo(source)) {
    this.moveToSource(creep, source); // With cached path!
    return;
}
// Mine continuously
creep.harvest(source);

// Separate hauler
if (creep.memory.state === 'collecting') {
    // Pick up from container
    creep.withdraw(container, RESOURCE_ENERGY);
} else {
    // Deliver to spawn
    creep.transfer(spawn, RESOURCE_ENERGY);
}
```
**Benefits:**
- Miner never stops mining: ~10 energy/tick
- Hauler optimized for transport (mostly CARRY parts)
- Paths cached (50-70% CPU savings)
- Total system: ~15-20 energy/tick from 2 sources

---

### Path Caching

#### Basic Code
```javascript
// Recalculates path EVERY tick - very expensive!
creep.moveTo(target);
```

#### Improved Code
```javascript
// Calculate once, reuse many times
if (!creep.memory.path) {
    const path = creep.pos.findPathTo(target, {ignoreCreeps: true});
    creep.memory.path = Room.serializePath(path);
}

const result = creep.moveByPath(creep.memory.path);

// Only recalculate if blocked
if (result === ERR_NOT_FOUND) {
    delete creep.memory.path;
}
```

**CPU Savings**: 0.5-2 CPU per creep per tick

---

### Memory Management

#### Basic Code
```javascript
// Manual cleanup in main loop
for(var name in Memory.creeps) {
    if(!Game.creeps[name]) {
        delete Memory.creeps[name];
    }
}
```

#### Improved Code
```javascript
// Centralized manager with multiple cleanup tasks
cleanDeadCreeps: function() { ... }
cleanOldPaths: function() { ... }
cleanRoomMemory: function() { ... }
getMemoryStats: function() { ... }

// Global cache for frequently accessed data
getCached: function(key, ttl = 10) { ... }
setCached: function(key, data) { ... }
```

**Benefits**: 
- Organized and maintainable
- Automatic cleanup of old data
- Global cache reduces Memory usage
- Statistics for monitoring

---

### Tower Defense

#### Basic Code
```javascript
// No tower logic - must be added manually
```

#### Improved Code
```javascript
// Automatic priority system
runTowers: function(room) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    
    if (hostiles.length > 0) {
        // Attack most dangerous target
        const target = this.findPriorityTarget(hostiles);
        tower.attack(target);
    } else {
        // Heal creeps > Repair structures > Maintain walls
        // ... automatic prioritization
    }
}
```

---

## Performance Comparison

### Energy Production (2 sources)

| Metric | Basic | Improved | Change |
|--------|-------|----------|--------|
| Harvesters/Miners | 2 | 2 | Same |
| Haulers | 0 | 2-3 | New |
| Energy/tick | ~5 | ~15-18 | +200% |
| Source utilization | 33% | 90%+ | +170% |

### CPU Usage (10 creeps)

| Operation | Basic | Improved | Savings |
|-----------|-------|----------|---------|
| Pathfinding | 4-6 | 1-2 | 60% |
| Room.find() | 2-3 | 0.5-1 | 60% |
| Spawning | 0.5 | 0.5 | Same |
| Memory parse | 1-2 | 0.5-1 | 50% |
| **Total** | **8-12** | **3-5** | **60%** |

### Creep Efficiency

| Body | Cost | Speed | Capacity | Efficiency |
|------|------|-------|----------|------------|
| Basic Harvester [W,C,M] | 200 | 1 tile/tick | 50 | Low |
| Miner [W×5,C,M] | 550 | 1 tile/tick | 50 | High |
| Hauler [C×8,M×4] | 600 | 1 tile/tick | 400 | Very High |

---

## Real-World Example

### Scenario: 1 Room, RCL 3, 2 Sources

#### Basic Code
```
Creeps:
- 2 Harvesters [W,C,M] = 400 energy
- 2 Upgraders [W,C,M] = 400 energy
- 2 Builders [W,C,M] = 400 energy

Energy flow:
- Sources: 6000 energy per 300 ticks = 20 e/tick available
- Harvesting: ~5-6 e/tick collected (30% efficiency)
- Net production: ~3-4 e/tick after creep spawning

Upgrade rate: ~2 e/tick to controller
Time to RCL 4: ~100,000 ticks (~70 hours)
```

#### Improved Code
```
Creeps:
- 2 Miners [W×3,C,M] = 900 energy
- 2 Haulers [C×4,M×2] = 600 energy
- 2 Upgraders [W×3,C×2,M×5] = 1100 energy
- 1 Builder [W×2,C×2,M×2] = 400 energy

Energy flow:
- Sources: 6000 energy per 300 ticks = 20 e/tick available
- Harvesting: ~18-19 e/tick collected (95% efficiency)
- Net production: ~12-14 e/tick after creep spawning

Upgrade rate: ~6-8 e/tick to controller
Time to RCL 4: ~35,000 ticks (~24 hours)
```

**Result**: Reach RCL 4 in 1/3 the time! 🚀

---

## Migration Checklist

- [ ] Read ADVANCED_TACTICS.md for strategy understanding
- [ ] Read IMPLEMENTATION_GUIDE.md for installation steps
- [ ] Backup current code (copy to text file)
- [ ] Install manager modules
- [ ] Install new role modules  
- [ ] Update main.js
- [ ] Test in simulation mode first
- [ ] Deploy to live game
- [ ] Monitor for 500-1000 ticks
- [ ] Check CPU usage (should drop)
- [ ] Check energy income (should increase)
- [ ] Adjust creep counts as needed
- [ ] Add remote harvesting (next phase)

---

## Quick Decision Matrix

**Use Basic Code if:**
- Just started playing (< 1 week)
- Want something simple to understand
- Still learning JavaScript
- Room Control Level 1-2

**Use Improved Code if:**
- Ready for better performance
- RCL 3+ (have extensions)
- Comfortable with modular code
- Want to scale to multiple rooms
- CPU becoming a concern
- Energy production feels slow

**Both codes teach important concepts:**
- Basic: Core mechanics and simple logic
- Improved: Optimization and architecture

---

## Key Takeaways

1. **Static harvesting** is the single biggest improvement (200%+ energy)
2. **Path caching** saves the most CPU (50-70% reduction)
3. **Dynamic bodies** let creeps scale naturally
4. **Modular code** makes future improvements easier
5. **Managers** separate concerns logically

The improved code isn't just "better" - it's architected for growth and teaches advanced programming patterns while delivering 2-3x better performance.

Happy Screeping! 🎮
