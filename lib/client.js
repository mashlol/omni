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
            var model = new Backbone.Model(collectionObj[x]);
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
        var collection = new Backbone.Collection(models);
        window.Collections[collectionName] = collection;

        collection.on("add", function(model, collection, options) {
            console.log("emitted add:" + collectionName)
            connection.emit("add:" + collectionName, model);
        });

        collection.on("remove", function(model, collection, options) {
            connection.emit("remove:" + collectionName, {id: model.id});
        });

        window.connection.on("change:" + modelName, function(data) {
            if (data.id) {
                var model = Collections[collectionName].findWhere({id: data.id});
                if (!model) {
                    return;
                }
                model.set(data);
            }
        });

        window.connection.on("add:" + collectionName, function(data) {
            window.Collections[collectionName].add(new Model(data));
        });

        window.connection.on("remove:" + collectionName, function(data) {
            window.Collections[collectionName].remove(data.id);
        });
    }
});

window.connection.trigger = function(eventName, args) {
    window.connection.emit("event:" + eventName, args);
}