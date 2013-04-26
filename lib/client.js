(function() {
    var OmniCollection = Backbone.Collection.extend({});
    var OmniModel = Backbone.Model.extend({});

    window.Omni = {
        Collection: OmniCollection,
        Model: OmniModel,
        readyCallbacks: [],
        ready: function(callback) {
            if (this.alreadyReady) {
                callback();
                return;
            }
            this.readyCallbacks.push(callback);
        },
        callReadyCallbacks: function() {
            for (var x in this.readyCallbacks) {
                this.readyCallbacks[x]();
            }
            this.alreadyReady = true;
        },
        alreadyReady: false,
        trigger: function(eventName, args, callback) {
            if (callback != undefined) {
                this.connection.once("eventResponse:" + eventName, function(data) {
                    callback(data);
                });
            }
            this.connection.emit("event:" + eventName, args);
        }
    }

    window.Collections = Omni.Collections = Omni.collections = {};

    Omni.connection = io.connect('http://' + window.location.hostname + ':<%= port %>', {
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
            for (var x in collectionObj) {
                var model = new Omni.Model(collectionObj[x]);
                addModelChangeListener(model, modelName);
                models.push(model);
            }
            var collection = new Omni.Collection(models);
            window.Collections[collectionName] = collection;

            (function(collection, collectionName, modelName) {
                collection.on("add", function(model, collection, options) {
                    if (!options.fromServer)
                        Omni.connection.emit("add:" + collectionName, model);
                    addModelChangeListener(model, modelName);
                });

                collection.on("remove", function(model, collection, options) {
                    if (!options.fromServer)
                        Omni.connection.emit("remove:" + collectionName, {id: model.id});
                });

                Omni.connection.on("change:" + modelName, function(data) {
                    if (data.id) {
                        var model = Collections[collectionName].get(data.id);
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
            })(collection, collectionName, modelName);
        }

        Omni.callReadyCallbacks();
    });
})();