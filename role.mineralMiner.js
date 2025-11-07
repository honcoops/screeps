/**
 * Role: Mineral Miner
 * Purpose: Mines minerals from extractors and deposits them in containers/terminal
 * Available at RCL 6+ when extractors are unlocked
 */

var roleMineralMiner = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // Get assigned mineral
        if (!creep.memory.mineralId) {
            this.assignMineral(creep);
            if (!creep.memory.mineralId) {
                console.log(`Mineral miner ${creep.name} has no mineral to mine!`);
                return;
            }
        }

        var mineral = Game.getObjectById(creep.memory.mineralId);
        if (!mineral) {
            console.log(`Mineral miner ${creep.name} cannot find mineral ${creep.memory.mineralId}`);
            delete creep.memory.mineralId;
            return;
        }

        // Check if mineral is depleted
        if (mineral.mineralAmount === 0) {
            creep.say('😴');
            // Move to controller to idle (stay out of the way)
            if (!creep.pos.inRangeTo(creep.room.controller, 3)) {
                creep.moveTo(creep.room.controller);
            }
            return;
        }

        // State management
        if (creep.memory.mining && creep.store.getFreeCapacity() === 0) {
            creep.memory.mining = false;
            creep.say('🚚');
        }

        if (!creep.memory.mining && creep.store.getUsedCapacity() === 0) {
            creep.memory.mining = true;
            creep.say('⛏️');
        }

        // Execute task
        if (creep.memory.mining) {
            this.mineMineral(creep, mineral);
        } else {
            this.depositMineral(creep);
        }
    },

    /**
     * Assign a mineral to the creep
     * @param {Creep} creep
     */
    assignMineral: function(creep) {
        var minerals = creep.room.find(FIND_MINERALS);
        if (minerals.length > 0) {
            creep.memory.mineralId = minerals[0].id;
        }
    },

    /**
     * Mine the mineral
     * @param {Creep} creep
     * @param {Mineral} mineral
     */
    mineMineral: function(creep, mineral) {
        // Check if there's an extractor on the mineral
        var extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
            s => s.structureType === STRUCTURE_EXTRACTOR
        );

        if (!extractor) {
            creep.say('❌ No extractor');
            return;
        }

        // Check extractor cooldown
        if (extractor.cooldown > 0) {
            creep.say(`⏳${extractor.cooldown}`);
            return;
        }

        // Mine the mineral
        var result = creep.harvest(mineral);

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(mineral, {visualizePathStyle: {stroke: '#ffaa00'}});
        } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
            creep.say('💤 Empty');
        } else if (result === OK) {
            creep.say('⛏️');
        }
    },

    /**
     * Deposit mineral in container or terminal
     * @param {Creep} creep
     */
    depositMineral: function(creep) {
        var mineralType = null;
        for (var resourceType in creep.store) {
            if (resourceType !== RESOURCE_ENERGY) {
                mineralType = resourceType;
                break;
            }
        }

        if (!mineralType) {
            return;
        }

        // Priority 1: Terminal (for market trading)
        var terminal = creep.room.terminal;
        if (terminal && terminal.store.getFreeCapacity() > 0) {
            if (creep.transfer(terminal, mineralType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(terminal, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        }

        // Priority 2: Storage
        var storage = creep.room.storage;
        if (storage && storage.store.getFreeCapacity() > 0) {
            if (creep.transfer(storage, mineralType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            return;
        }

        // Priority 3: Container near mineral
        var container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => {
                return s.structureType === STRUCTURE_CONTAINER &&
                       s.store.getFreeCapacity() > 0;
            }
        });

        if (container) {
            if (creep.transfer(container, mineralType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {visualizePathStyle: {stroke: '#ffffff'}});
            }
        } else {
            // No storage available, drop it
            creep.drop(mineralType);
        }
    }
};

module.exports = roleMineralMiner;
