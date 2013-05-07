(function() {
    var OmniCollection = Backbone.Collection.extend({});
    var OmniModel = Backbone.Model.extend({});

    window.Omni = {
        Collection: OmniCollection,
        Model: OmniModel,
        eventCallbacks: {
            ready: []
        },
        ready: function(callback) {
            if (this.alreadyReady) {
                callback();
                return;
            }
            this.eventCallbacks.ready.push(callback);
        },
        _trigger: function(eventName) {
            for (var x in this.eventCallbacks[eventName]) {
                this.eventCallbacks[eventName][x]();
            }
            if (eventName == "ready") {
                this.alreadyReady = true;
            }
        },
        alreadyReady: false,
        trigger: function(eventName, args, callback) {
            if (callback != undefined) {
                this.connection.once("eventResponse:" + eventName, function(data) {
                    callback(data);
                });
            }
            this.connection.emit("event:" + eventName, args);
        },
        on: function(eventName, callback) {
            if (this.eventCallbacks[eventName] == null) {
                this.eventCallbacks[eventName] = [];
            }
            this.eventCallbacks[eventName].push(callback);
        }
    }

    window.Collections = Omni.Collections = Omni.collections = {};

    Omni.connection = io.connect('http://' + window.location.hostname + ':' + window.location.port, {
        reconnect: false
    });

    var addModelChangeListener = function(model, modelName) {
        model.on("change", function (model, options) {
            if (options.fromServer) {
                return;
            }
            obj = {};
            obj.id = model.id;
            for (var y in model.attributes) {
                if (model.hasChanged(y)) {
                    obj[y] = model.get(y);
                }
            }
            if (Object.keys(obj).length > 1) {
                Omni.connection.emit("change:" + modelName, obj);
            }
        });
    }

    Omni.connection.on("omni", function(data) {
        for (var collectionName in data) {
            var modelName = collectionName.substring(0, collectionName.length-1); // The collection name minus the last character is the model name (Players -> Player)
            var collectionObj = data[collectionName];
            var models = [];
            for (var x in collectionObj.models) {
                var model = new Omni.Protos[collectionObj.modelProtoIndex](collectionObj.models[x]);
                addModelChangeListener(model, modelName);
                models.push(model);
            }
            if (window.Collections[collectionName] != null) {
                window.Collections[collectionName].each(function(model) {
                    model.off();
                });
                window.Collections[collectionName].off();
                window.Collections[collectionName].reset(models);
            } else {
                window.Collections[collectionName] = new Omni.Protos[collectionObj.protoIndex](models);
            }

            (function(collectionName, modelName) {
                window.Collections[collectionName].on("add", function(model, collection, options) {
                    if (!options.fromServer)
                        Omni.connection.emit("add:" + collectionName, model);
                    addModelChangeListener(model, modelName);
                });

                window.Collections[collectionName].on("remove", function(model, collection, options) {
                    if (!options.fromServer)
                        Omni.connection.emit("remove:" + collectionName, {id: model.id});
                });

                Omni.connection.on("change:" + modelName, function(data) {
                    if (data.id) {
                        var model = window.Collections[collectionName].get(data.id);
                        if (!model) {
                            return;
                        }
                        model.set(data, {fromServer: true});
                    }
                });

                Omni.connection.on("add:" + collectionName, function(data) {
                    window.Collections[collectionName].add(data, {fromServer: true});
                });

                Omni.connection.on("remove:" + collectionName, function(data) {
                    window.Collections[collectionName].remove(data.id, {fromServer: true});
                });
            })(collectionName, modelName);
        }

        if (!Omni.alreadyReady) {
            Omni._trigger("ready");
        } else {
            Omni._trigger("recheckPermissions");
        }
    });
})();