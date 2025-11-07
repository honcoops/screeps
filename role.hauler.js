/**
 * Role: Hauler
 * Purpose: Transport energy from containers/dropped resources to spawn/extensions/storage
 * Optimized with large CARRY capacity and path caching
 */

var roleHauler = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // State management: collecting or delivering
        if (creep.memory.state === 'collecting' && creep.store.getFreeCapacity() === 0) {
            creep.memory.state = 'delivering';
            delete creep.memory.target;
            delete creep.memory.path;
        }

        if (creep.memory.state === 'delivering' && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.state = 'collecting';
            delete creep.memory.target;
            delete creep.memory.path;
        }

        // Execute current state
        if (creep.memory.state === 'collecting') {
            this.collect(creep);
        } else {
            this.deliver(creep);
        }
    },

    /**
     * Collect energy from containers, dropped resources, or ruins
     * @param {Creep} creep
     */
    collect: function(creep) {
        var target;

        // Try to use cached target
        if (creep.memory.target) {
            target = Game.getObjectById(creep.memory.target);

            // Verify target is still valid
            if (target) {
                if (target instanceof Resource) {
                    if (target.amount === 0) {
                        target = null;
                    }
                } else if (target.store) {
                    if (target.store[RESOURCE_ENERGY] === 0) {
                        target = null;
                    }
                }
            }

            if (!target) {
                delete creep.memory.target;
                delete creep.memory.path;
            }
        }

        // Find new target if needed
        if (!target) {
            target = this.findCollectionTarget(creep);

            if (target) {
                creep.memory.target = target.id;
            } else {
                // No energy to collect, idle near spawn
                var spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                if (spawn && !creep.pos.isNearTo(spawn)) {
                    creep.moveTo(spawn, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                creep.say('💤');
                return;
            }
        }

        // Move to target and collect
        if (target) {
            var collectResult;

            if (target instanceof Resource) {
                collectResult = creep.pickup(target);
            } else if (target instanceof Tombstone || target instanceof Ruin) {
                collectResult = creep.withdraw(target, RESOURCE_ENERGY);
            } else {
                collectResult = creep.withdraw(target, RESOURCE_ENERGY);
            }

            if (collectResult === ERR_NOT_IN_RANGE) {
                this.moveToTarget(creep, target);
            } else if (collectResult === OK) {
                creep.say('📦');
            }
        }
    },

    /**
     * Find the best target to collect energy from
     * Priority: Containers > Dropped resources > Tombstones > Storage
     * @param {Creep} creep
     * @returns {Object|null}
     */
    findCollectionTarget: function(creep) {
        // Priority 1: Full or nearly full containers (> 50% capacity)
        var containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > s.store.getCapacity() * 0.5;
            }
        });

        if (containers.length > 0) {
            return creep.pos.findClosestByPath(containers);
        }

        // Priority 2: Dropped resources (from dead creeps or mining)
        var droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 50
        });

        if (droppedResources.length > 0) {
            return creep.pos.findClosestByPath(droppedResources);
        }

        // Priority 3: Any containers with energy
        containers = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (containers.length > 0) {
            return creep.pos.findClosestByPath(containers);
        }

        // Priority 4: Tombstones and ruins
        var tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: (t) => t.store[RESOURCE_ENERGY] > 0
        });

        if (tombstones.length > 0) {
            return creep.pos.findClosestByPath(tombstones);
        }

        // Priority 5: Storage (if exists and has surplus energy)
        var storage = creep.room.storage;
        if (storage && storage.store[RESOURCE_ENERGY] > 10000) {
            return storage;
        }

        return null;
    },

    /**
     * Deliver energy to spawn, extensions, towers, or storage
     * @param {Creep} creep
     */
    deliver: function(creep) {
        var target;

        // Try to use cached target
        if (creep.memory.target) {
            target = Game.getObjectById(creep.memory.target);

            // Verify target is still valid
            if (target && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                target = null;
                delete creep.memory.target;
                delete creep.memory.path;
            }
        }

        // Find new target if needed
        if (!target) {
            target = this.findDeliveryTarget(creep);

            if (target) {
                creep.memory.target = target.id;
            } else {
                // No valid target, drop energy at storage or spawn
                var storage = creep.room.storage;
                var spawn = creep.room.find(FIND_MY_SPAWNS)[0];

                if (storage) {
                    target = storage;
                } else if (spawn) {
                    // Drop near spawn if no storage
                    if (!creep.pos.isNearTo(spawn)) {
                        creep.moveTo(spawn);
                    }
                    return;
                }
            }
        }

        // Move to target and deliver
        if (target) {
            var transferResult = creep.transfer(target, RESOURCE_ENERGY);

            if (transferResult === ERR_NOT_IN_RANGE) {
                this.moveToTarget(creep, target);
            } else if (transferResult === OK) {
                creep.say('🚚');
                // Clear target to find new one next tick
                delete creep.memory.target;
                delete creep.memory.path;
            }
        }
    },

    /**
     * Find the best target to deliver energy to
     * Priority: Spawn > Extensions > Towers > Terminal (if needs energy) > Storage
     * @param {Creep} creep
     * @returns {Structure|null}
     */
    findDeliveryTarget: function(creep) {
        // Priority 1: Spawn (critical for creep production)
        var spawns = creep.room.find(FIND_MY_SPAWNS, {
            filter: (s) => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (spawns.length > 0) {
            return creep.pos.findClosestByPath(spawns);
        }

        // Priority 2: Extensions (needed for larger creeps)
        var extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_EXTENSION &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if (extensions.length > 0) {
            return creep.pos.findClosestByPath(extensions);
        }

        // Priority 3: Towers (defense is important)
        var towers = creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_TOWER &&
                       s.store.getFreeCapacity(RESOURCE_ENERGY) > 300;
            }
        });

        if (towers.length > 0) {
            return creep.pos.findClosestByPath(towers);
        }

        // Priority 4: Terminal (if it needs energy)
        if (creep.room.memory.terminalNeedsEnergy) {
            var terminal = creep.room.terminal;
            if (terminal && terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                return terminal;
            }
        }

        // Priority 5: Storage (long-term storage)
        var storage = creep.room.storage;
        if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            return storage;
        }

        return null;
    },

    /**
     * Move to target using cached path
     * @param {Creep} creep
     * @param {Object} target
     */
    moveToTarget: function(creep, target) {
        // Use cached path if available
        if (creep.memory.path) {
            var result = creep.moveByPath(creep.memory.path);

            if (result === ERR_NOT_FOUND || result === ERR_INVALID_ARGS) {
                // Path is invalid, recalculate
                delete creep.memory.path;
            }
        }

        // Calculate and cache new path
        if (!creep.memory.path) {
            var path = creep.pos.findPathTo(target, {
                ignoreCreeps: false
            });

            if (path.length > 0) {
                creep.memory.path = Room.serializePath(path);
                creep.memory.pathAge = Game.time;
                creep.moveByPath(path);
            }
        }
    }
};

module.exports = roleHauler;
