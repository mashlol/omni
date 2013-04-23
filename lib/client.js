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
    alreadyReady: false
}

window.Collections = {};

window.connection = io.connect('http://localhost:<%= port %>', {
    reconnect: false
});

window.connection.on("omni", function(data) {
    for (var collectionName in data) {
        var collectionObj = data[collectionName];
        var models = [];
        var modelName = collectionName.substring(0, collectionName.length-1); // The collection name minus the last character is the model name (Players -> Player)
        for (var x in collectionObj) {
            var model = new Omni.Model(collectionObj[x]);
            model.on("change", function (model, options) {
                obj = {};
                obj.id = model.id;
                for (var y in model.attributes) {
                    if (model.hasChanged(y)) {
                        obj[y] = model.get(y);
                    }
                }
                if (Object.keys(obj).length > 1) {
                    window.connection.emit("change:" + modelName, obj);
                }
            });
            models.push(model);
        }
        var collection = new Omni.Collection(models);
        window.Collections[collectionName] = collection;

        collection.on("add", function(model, collection, options) {
            if (!options.fromServer)
                connection.emit("add:" + collectionName, model);
        });

        collection.on("remove", function(model, collection, options) {
            if (!options.fromServer)
                connection.emit("remove:" + collectionName, {id: model.id});
        });

        window.connection.on("change:" + modelName, function(data) {
            if (data.id) {
                var model = Collections[collectionName].get(data.id);
                if (!model) {
                    return;
                }
                model.set(data);
            }
        });

        window.connection.on("add:" + collectionName, function(data) {
            window.Collections[collectionName].add(data, {fromServer: true});
        });

        window.connection.on("remove:" + collectionName, function(data) {
            window.Collections[collectionName].remove(data.id, {fromServer: true});
        });
    }

    Omni.callReadyCallbacks();
});

window.connection.trigger = function(eventName, args) {
    window.connection.emit("event:" + eventName, args);
}