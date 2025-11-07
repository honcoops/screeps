/**
 * Terminal Manager
 * Handles terminal operations and market trading
 * Available at RCL 6+ when terminals are unlocked
 */

var terminalManager = {

    /**
     * Manage terminal operations for a room
     * @param {Room} room
     */
    run: function(room) {
        // Only run for rooms with RCL 6+ and a terminal
        if (!room.controller || room.controller.level < 6 || !room.terminal) {
            return;
        }

        var terminal = room.terminal;

        // Don't operate if terminal is on cooldown
        if (terminal.cooldown > 0) {
            return;
        }

        // Balance energy in terminal
        this.balanceEnergy(room, terminal);

        // Periodic operations
        if (Game.time % 100 === 0) {
            this.sellExcessResources(room, terminal);
        }

        if (Game.time % 500 === 0) {
            this.buyNeededResources(room, terminal);
        }
    },

    /**
     * Maintain optimal energy level in terminal
     * @param {Room} room
     * @param {StructureTerminal} terminal
     */
    balanceEnergy: function(room, terminal) {
        var targetEnergy = 50000; // Target amount of energy in terminal
        var minEnergy = 30000;    // Minimum before withdrawing from storage
        var maxEnergy = 100000;   // Maximum before sending to storage

        var currentEnergy = terminal.store[RESOURCE_ENERGY] || 0;
        var storage = room.storage;

        if (!storage) {
            return;
        }

        // Transfer energy from storage to terminal if too low
        if (currentEnergy < minEnergy && storage.store[RESOURCE_ENERGY] > 100000) {
            var amount = Math.min(targetEnergy - currentEnergy, 10000);

            // Find haulers to transfer energy
            var haulers = room.find(FIND_MY_CREEPS, {
                filter: (c) => c.memory.role === 'hauler' && c.store.getFreeCapacity() > 0
            });

            if (haulers.length > 0) {
                // Let haulers handle the transfer naturally through their logic
                room.memory.terminalNeedsEnergy = true;
            }
        } else if (currentEnergy > maxEnergy) {
            // Mark that terminal has excess energy for haulers to collect
            room.memory.terminalHasExcessEnergy = true;
        } else {
            room.memory.terminalNeedsEnergy = false;
            room.memory.terminalHasExcessEnergy = false;
        }
    },

    /**
     * Sell excess resources on the market
     * @param {Room} room
     * @param {StructureTerminal} terminal
     */
    sellExcessResources: function(room, terminal) {
        // Define resource thresholds for selling
        var sellThresholds = {
            [RESOURCE_HYDROGEN]: 5000,
            [RESOURCE_OXYGEN]: 5000,
            [RESOURCE_UTRIUM]: 3000,
            [RESOURCE_LEMERGIUM]: 3000,
            [RESOURCE_KEANIUM]: 3000,
            [RESOURCE_ZYNTHIUM]: 3000,
            [RESOURCE_CATALYST]: 3000,
            [RESOURCE_GHODIUM]: 1000
        };

        for (var resourceType in sellThresholds) {
            var amount = terminal.store[resourceType] || 0;
            var threshold = sellThresholds[resourceType];

            if (amount > threshold) {
                this.createSellOrder(room, terminal, resourceType, amount - threshold);
            }
        }
    },

    /**
     * Create a sell order on the market
     * @param {Room} room
     * @param {StructureTerminal} terminal
     * @param {string} resourceType
     * @param {number} amount
     */
    createSellOrder: function(room, terminal, resourceType, amount) {
        // Check existing orders
        var myOrders = Game.market.orders;
        var existingOrder = _.find(myOrders, (o) => {
            return o.type === ORDER_SELL &&
                   o.resourceType === resourceType &&
                   o.roomName === room.name;
        });

        if (existingOrder) {
            // Order already exists, don't create another
            return;
        }

        // Get market price
        var orders = Game.market.getAllOrders({type: ORDER_BUY, resourceType: resourceType});
        if (orders.length === 0) {
            return;
        }

        // Find best buy order price
        var bestPrice = _.max(orders, (o) => o.price).price;

        // Price slightly below best buy order to attract buyers
        var sellPrice = bestPrice * 0.95;

        // Sell up to 5000 at a time
        var sellAmount = Math.min(amount, 5000);

        // Create sell order (costs 5% credits)
        if (Game.market.credits > 1000) {
            var result = Game.market.createOrder({
                type: ORDER_SELL,
                resourceType: resourceType,
                price: sellPrice,
                totalAmount: sellAmount,
                roomName: room.name
            });

            if (result === OK) {
                console.log(`[${room.name}] Created sell order: ${sellAmount} ${resourceType} @ ${sellPrice.toFixed(3)}`);
            }
        }
    },

    /**
     * Buy needed resources from the market
     * @param {Room} room
     * @param {StructureTerminal} terminal
     */
    buyNeededResources: function(room, terminal) {
        // Don't buy if low on credits
        if (Game.market.credits < 10000) {
            return;
        }

        // Define minimum resource levels
        var minLevels = {
            [RESOURCE_HYDROGEN]: 1000,
            [RESOURCE_OXYGEN]: 1000,
            [RESOURCE_UTRIUM]: 500,
            [RESOURCE_LEMERGIUM]: 500,
            [RESOURCE_KEANIUM]: 500,
            [RESOURCE_ZYNTHIUM]: 500,
            [RESOURCE_CATALYST]: 500
        };

        for (var resourceType in minLevels) {
            var amount = terminal.store[resourceType] || 0;
            var minAmount = minLevels[resourceType];

            if (amount < minAmount) {
                this.buyResource(room, terminal, resourceType, minAmount - amount);
                break; // Only buy one resource per call
            }
        }
    },

    /**
     * Buy a resource from the market
     * @param {Room} room
     * @param {StructureTerminal} terminal
     * @param {string} resourceType
     * @param {number} amount
     */
    buyResource: function(room, terminal, resourceType, amount) {
        // Find best sell order
        var orders = Game.market.getAllOrders({
            type: ORDER_SELL,
            resourceType: resourceType
        });

        if (orders.length === 0) {
            return;
        }

        // Filter and sort by effective price (including energy cost)
        var roomPos = new RoomPosition(25, 25, room.name);
        var validOrders = [];

        for (var order of orders) {
            if (order.amount < 100) continue; // Skip small orders

            // Calculate transfer cost
            var distance = Game.map.getRoomLinearDistance(room.name, order.roomName);
            var transferCost = Game.market.calcTransactionCost(1000, room.name, order.roomName);
            var energyCostPerUnit = transferCost / 1000;

            // Effective price including energy cost (assuming energy = 0.01 credits)
            var effectivePrice = order.price + (energyCostPerUnit * 0.01);

            validOrders.push({
                order: order,
                effectivePrice: effectivePrice,
                distance: distance
            });
        }

        if (validOrders.length === 0) {
            return;
        }

        // Sort by effective price
        validOrders.sort((a, b) => a.effectivePrice - b.effectivePrice);

        var bestOrder = validOrders[0].order;
        var buyAmount = Math.min(amount, bestOrder.amount, 1000);

        // Execute deal
        var result = Game.market.deal(bestOrder.id, buyAmount, room.name);

        if (result === OK) {
            console.log(`[${room.name}] Bought ${buyAmount} ${resourceType} @ ${bestOrder.price.toFixed(3)}`);
        } else {
            console.log(`[${room.name}] Failed to buy ${resourceType}: ${result}`);
        }
    },

    /**
     * Send resources to another room
     * @param {Room} fromRoom
     * @param {string} toRoomName
     * @param {string} resourceType
     * @param {number} amount
     */
    sendResource: function(fromRoom, toRoomName, resourceType, amount) {
        if (!fromRoom.terminal) {
            return ERR_NOT_FOUND;
        }

        var terminal = fromRoom.terminal;

        if (terminal.store[resourceType] < amount) {
            return ERR_NOT_ENOUGH_RESOURCES;
        }

        var cost = Game.market.calcTransactionCost(amount, fromRoom.name, toRoomName);

        if (terminal.store[RESOURCE_ENERGY] < cost) {
            console.log(`[${fromRoom.name}] Not enough energy to send resources: need ${cost}, have ${terminal.store[RESOURCE_ENERGY]}`);
            return ERR_NOT_ENOUGH_ENERGY;
        }

        var result = terminal.send(resourceType, amount, toRoomName);

        if (result === OK) {
            console.log(`[${fromRoom.name}] Sent ${amount} ${resourceType} to ${toRoomName} (cost: ${cost} energy)`);
        }

        return result;
    }
};

module.exports = terminalManager;
