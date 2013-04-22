exports.Collection = require("./collection");
exports.Model = require("./model");

exports.listen = function(port, collections, events) {
    var express = require('express');
    var socketIO = require('socket.io');
    var path = require("path");

    // Start express app - to serve static front end files
    // ---
    var app = express();
    var server = require('http').createServer(app);
    app.use(express.static(path.resolve(path.dirname(require.main.filename), 'public'))); // To serve front end files
    app.engine('js', require('ejs').renderFile);
    app.get('/omni.js', function(req, res) {
        res.type('js');
        res.render(path.resolve(__dirname, "client.js"), {port: port});
    });
    server.listen(port);

    console.log("Listening on port " + port + " for connections.");

    // Start websocket server - to connect to the front end and keep track of data.
    // ---
    webSocketServer = socketIO.listen(server, {log: false});
    webSocketServer.sockets.on("connection", function (socket) {
        var connection = {
            socket: socket
        }

        var connectPacket = {};
        for (var x in collections) {
            collection = collections[x];
            // send client all models they have permission to
            connectPacket[x] = collection._all(connection);

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
                        socket.emit("change:" + collection.model.prototype.name, obj);
                    }
                });
            });

            socket.on("change:" + collection.model.prototype.name, function (data) {
                console.log("model changed");
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

        socket.emit("omni", connectPacket);

        for (var k in events) {
            var event = events[k];
            socket.on("event:" + k, function (data) {
                event.run(connection, collections, data);
            });
       }

    });
}