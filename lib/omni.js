exports.Collection = require("./collection");
exports.Model = require("./model");

exports.listen = function(port, collections, events) {
    var express = require('express');
    var socketIO = require('socket.io');
    var path = require("path");

    // Start express app - to serve static front end files
    // ---
    var expressServer = express();
    var server = require('http').createServer(expressServer);
    expressServer.use(express.static(path.resolve(path.dirname(require.main.filename), 'public'))); // To serve front end files
    expressServer.engine('js', require('ejs').renderFile);
    expressServer.get('/omni.js', function(req, res) {
        res.type('js');
        res.render(path.resolve(__dirname, "client.js"), {port: port});
    });
    server.listen(port);

    // Start websocket server - to connect to the front end and keep track of data.
    // ---
    webSocketServer = socketIO.listen(server, {log: false});
    webSocketServer.sockets.on("connection", function (socket) {
        var connection = {
            socket: socket
        }

        var addModelChangeListener = function(model, modelName) {
            model.on("change", function (model, options) {
                if (options.changedFrom && options.changedFrom == connection) {
                    return;
                }
                obj = {};
                obj.id = model.id;
                for (var k in model.attributes) {
                    if (model.hasChanged(k) && model.readPermission(connection, k)) {
                        obj[k] = model.get(k);
                    }
                }
                if (Object.keys(obj).length > 1) {
                    socket.emit("change:" + modelName, obj);
                }
            });
        }

        // The connection packet will get sent to the user containing all the information about every collection.
        var connectPacket = {};
        for (var collectionName in collections) {
            var collection = collections[collectionName];
            var modelName = collectionName.substring(0, collectionName.length-1); // The collection name minus the last character is the model name (Players -> Player)
            // Store this collections data inside the connection packet.
            connectPacket[collectionName] = collection._all(connection);

            collection.each(function (model) {
                addModelChangeListener(model, modelName);
            });

            (function(collection, collectionName, modelName) {
                collection.on("add", function(model, collection, options) {
                    if (options.changedFrom && options.changedFrom == connection) {
                        return;
                    }
                    obj = {};
                    obj.id = model.id;
                    for (var k in model.attributes) {
                        if (model.readPermission(connection, k)) {
                            obj[k] = model.get(k);
                        }
                    }
                    if (Object.keys(obj).length > 1) {
                        socket.emit("add:" + collectionName, obj);
                    }
                    addModelChangeListener(model, modelName);
                });
                collection.on("remove", function(model, collection, options) {
                    if (options.changedFrom && options.changedFrom == connection) {
                        return;
                    }
                    socket.emit("remove:" + collectionName, {id: model.id});
                });

                socket.on("add:" + collectionName, function(data) {
                    if (collection.createPermission(connection)) {
                        collection.add(data, {changedFrom: connection});
                    }
                });

                socket.on("remove:" + collectionName, function(data) {
                    if (collection.destroyPermission(connection)) {
                        collection.remove(data.id, {changedFrom: connection});
                    }
                });

                socket.on("change:" + modelName, function (data) {
                    model = collection.get(data.id);
                    if (!model) {
                        return;
                    }
                    attrHash = {};
                    for (var k in data) {
                        v = data[k];
                        if (k != "id" && model.writePermission(connection, k, v)) {
                            attrHash[k] = v;
                        }
                    }
                    model.set(attrHash, {changedFrom: connection});
                });
            })(collection, collectionName, modelName);
        }

        socket.emit("omni", connectPacket);

        for (var k in events) {
            if (k == 'connect' || k == 'disconnect') {
                continue;
            }
            (function(event, k) {
                socket.on("event:" + k, function (data) {
                    var eventResponse = event.run(connection, collections, data);
                    socket.emit("eventResponse:" + k, eventResponse);
                });
            })(events[k], k);
       }

       socket.on("disconnect", function() {
            if (events != undefined && events.disconnect != null) {
                events.disconnect.run(connection, collections);
           }
       });

       if (events != undefined && events.connect != null) {
            events.connect.run(connection, collections);
       }

    });


    console.log("Omni is listening on port " + port + " for connections.");

    return {
        express: expressServer,
        webSocket: webSocketServer
    }
}