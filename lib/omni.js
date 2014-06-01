// External modules can call Omni.setBackbone(Backbone) with an object with a model and
// collection prototype that already extend Backbone.Model and Backbone.Collection
var setBackbone = function(Backbone) {
    exports.Collection = require("./collection")(Backbone.Collection);
    exports.Model = require("./model")(Backbone.Model);
}
exports.setBackbone = setBackbone;
setBackbone(require("backbone"));

exports.listen = function(port, collections, events, options) {
    exports.collections = collections;

    options || (options = {});

    var express = require('express');
    var socketIO = require('socket.io');
    var path = require("path");
    var fs = require("fs");
    var util = require("util");

    var UglifyJS = require("uglify-js");


    // Start express app - to serve static front end files
    // ---
    var expressServer = express();
    var server = require('http').createServer(expressServer);
    if (options.static !== null && options.static !== false)
        expressServer.use(express.static(path.resolve(path.dirname(require.main.filename), 'public'))); // To serve front end files


    // Compile the collections and models into javascript files to serve to the client
    var compiledProtos = [];
    var compiledProtoJS = [""];
    var hiddenMethods = require("./hidden_methods.json");

    compiledProtoJS.push("(function() { window.Omni.Protos = []; })();");

    var compileProto = function(proto, type, modelProtoIndex) {
        var protoIndex = compiledProtos.push(proto) - 1;
        compiledProtoJS.push("(function() {");
        compiledProtoJS.push("    window.Omni.Protos.push(window.Omni." + type + ".extend({");
        if (type == "Collection") {
            compiledProtoJS.push("        model: window.Omni.Protos[" + modelProtoIndex + "],");
        }
        for (var y in proto) {
            // Jump to next method if this one should be hidden.
            if (hiddenMethods[type.toLowerCase()].indexOf(y) != -1) {
                continue;
            }

            // Automatically hide any method or property starting with an underscore
            if (y.charAt(0) == "_") {
                continue;
            }
            if (proto[y]) {
                switch (typeof proto[y]) {
                case "function" :
                    compiledProtoJS.push("        " + y + ": " + proto[y].toString() + ",");
                    break;
                default :
                    compiledProtoJS.push("        " + y + ": " + util.inspect(proto[y]) + ",");
                    break;
                }
            }
        }
        compiledProtoJS.push("    }));");
        compiledProtoJS.push("})();");

        return protoIndex;
    }

    for (var x in collections) {
        var collection = collections[x];
        var proto = collection.__proto__;

        // The proto for this collection is already compiled, continue to the next collection
        if (compiledProtos.indexOf(proto) != -1) {
            continue;
        }

        // First compile the model prototype
        collection.modelProtoIndex = compileProto(collection.model.prototype, "Model");

        // Now compile the collection prototype
        collection.protoIndex = compileProto(proto, "Collection", collection.modelProtoIndex);
    }

    // Minify and serve the Omni.js client file
    var clientJS = fs.readFileSync(path.resolve(__dirname, "client.js")) + compiledProtoJS.join("\n");
    if (!options.development)
        clientJS = UglifyJS.minify(clientJS, {fromString: true}).code;

    expressServer.get('/omni.js', function(req, res) {
        res.type('js');
        res.send(clientJS);
    });

    server.listen(port);


    // Start websocket server - to connect to the front end and keep track of data.
    // ---
    var connections = {}; // To keep track of all of the connections
    webSocketServer = socketIO.listen(server, {log: false});
    webSocketServer.sockets.on("connection", function (socket) {
        var connection = {
            socket: socket,
            connections: connections,
            recheckAllPermissions: function() {
                var packet = {};
                for (var collectionName in collections) {
                    var collection = collections[collectionName];
                    // Store this collections data inside the connection packet.
                    packet[collectionName] = collection._createPacket(this);
                }
                socket.emit("omni", packet);
            }
        };
        connection.resync = connection.sync = connection.recheckAllPermissions;

        if (events != undefined && events.connect != null) {
             events.connect.run(connection, collections);
        }

        var addModelChangeListener = function(model, modelName) {
            model.on("change", function (model, options) {
                obj = {};
                obj.oid = model.oid;
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
            connectPacket[collectionName] = collection._createPacket(this);

            collection.each(function (model) {
                addModelChangeListener(model, modelName);
            });

            (function(collection, collectionName, modelName) {
                collection.on("add", function(model, collection, options) {
                    if (options.changedFrom && options.changedFrom == connection) {
                        // Update the client who added this model with any server defaults as well as an updated oid
                        var data = model.toJSON(connection);
                        data.clientOID = model.clientOID;
                        data.oid = model.oid;
                        socket.emit("oid:" + modelName, data);
                        return;
                    }
                    obj = {};
                    obj.oid = model.oid;
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
                    socket.emit("remove:" + collectionName, {oid: model.oid});
                });

                socket.on("add:" + collectionName, function(data) {
                    if (collection.createPermission(connection)) {
                        var newModel = new collection.model(data);
                        collection.add(newModel, {changedFrom: connection});
                    }
                });

                socket.on("remove:" + collectionName, function(data) {
                    if (collection.destroyPermission(connection)) {
                        collection.remove(collection._findByOID(data.oid), {changedFrom: connection});
                    }
                });

                socket.on("change:" + modelName, function (data) {
                    model = collection._findByOID(data.oid);
                    if (!model) {
                        return;
                    }
                    attrHash = {};
                    for (var k in data) {
                        v = data[k];
                        if (k != "id" && k != "oid" && model.writePermission(connection, k, v)) {
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
            delete connections[connection.socket.id];
        });

        connections[connection.socket.id] = connection;
        return connection;
    });


    console.log("Omni is listening on port " + port + " for connections.");

    return {
        express: expressServer,
        webSocket: webSocketServer
    }
}
