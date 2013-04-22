var Backbone = require("backbone");

exports.Collection = Backbone.Collection.extend({
    _all: function (connection) {
        lModels = [];
        this.forEach(function(model) {
            var lModel = model.properties(connection);
            if (lModel) {
                lModels.push(lModel);
            }
        });
        return lModels;
    },
    toJSON: function() {
        return this._all();
    }
});

exports.Model = Backbone.Model.extend({
    properties: function (connection) {
        if (!this.readPermission(connection)) {
            return null;
        }
        var lModel = {};
        for (var k in this.attributes) {
            v = this.attributes[k];
            if (this.readPermission(connection, k)) {
                lModel[k] = v;
            }
        }
        if (Object.keys(lModel).length != 0) {
            return lModel;
        }
        return null;
    },
    toJSON: function() {
        obj = this.properties();
        obj.id = this.id;
        return obj;
    },
    readPermission: function(connection, property) {
        return true;
    },
    writePermission: function(connection, property) {
        return false;
    }
});

exports.listen = function(port, collections, events) {
    var express = require('express');
    var socketIO = require('socket.io');
    var path = require("path");

    // Start express app - to serve static front end files
    // ---
    var app = express();
    var server = require('http').createServer(app);
    app.use(express.static(path.resolve(path.dirname(require.main.filename), 'public'))); // To serve front end files
    server.listen(port);

    console.log("Listening on port " + port + " for connections.");

    // Start websocket server - to connect to the front end and keep track of data.
    // ---
    webSocketServer = socketIO.listen(server, {log: false});
    webSocketServer.sockets.on("connection", function (socket) {
        var connection = {
            socket: socket
        }

        for (var x in collections) {
            collection = collections[x];
            // send client all models they have permission to
            socket.emit("msg", collection._all(connection));

            collection.each(function (model) {
                model.on("change", function (model, options) {
                    obj = {};
                    obj.id = model.id;
                    for (var k in model.attributes) {
                        if (model.hasChanged(k) && model.readPermission(connection, k)) {
                            obj[k] = model.get(k);
                        }
                    }
                    if (Object.keys(obj).length > 1) {
                        socket.emit("change", obj);
                    }
                });
            });

            socket.on("change:" + collection.model.prototype.name, function (data) {
                model = collection.findWhere({id: data.id});
                if (!model) {
                    return;
                }
                attrHash = {};
                for (var k in data) {
                    v = data[k];
                    if (k != "id" && model.writePermission(connection, k)) {
                        attrHash[k] = v;
                    }
                }
                model.set(attrHash);
            });
        }

        for (var k in events) {
            var event = events[k];
            socket.on("event:" + k, function (data) {
                event.run(connection, collections, data);
            });
       }

    });
}