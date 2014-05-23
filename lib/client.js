(function() {
    var OmniCollection = Backbone.Collection.extend({
        constructor: function() {
            Backbone.Collection.prototype.constructor.apply(this, arguments);
            this.listenTo(this, "add", this._setUniqueOID.bind(this));
            this.each(this._setUniqueOID.bind(this));
        },
        _setUniqueOID: function(model) {
            if (model.oid) return;
            var highest = 0;
            this.each(function(model) {
                if (model.oid && model.oid > highest) {
                    highest = model.oid;
                }
            });
            model.oid = highest + 1;
        },
        _findByOID: function(oid) {
            return this.find(function(model) {
                if (model.oid === oid) {
                    return true;
                }
            });
        }
    });
    var OmniModel = Backbone.Model.extend({
        constructor: function(data) {
            if (data.oid) {
                this.oid = data.oid;
                delete data.oid;
            }
            return Backbone.Model.prototype.constructor.apply(this, arguments);
        },
        toJSON: function() {
            var json = Backbone.Model.prototype.toJSON.apply(this, arguments);
            json.oid = this.oid;
            return json;
        }
    });

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
            obj.oid = model.oid;
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
            if (Omni.collections[collectionName] != null) { // This is a sync, since we've already got collections
                // TODO is there a faster way to do this?
                for (var x in models) {
                    var existingModel = Omni.collections[collectionName]._findByOID(models[x].oid);
                    if (existingModel) {
                        existingModel.set(models[x].attributes, {fromServer: true});
                    } else {
                        Omni.collections[collectionName].add(models[x], {fromServer: true});
                    }
                }
                var removedModels = [];
                Omni.collections[collectionName].each(function(model) {
                    for (var x in models) {
                        if (models[x].oid == model.oid) {
                            return;
                        }
                    }
                    removedModels.push(model);
                });
                for (var x in removedModels) {
                    removedModels[x].off();
                    Omni.collections[collectionName].remove(removedModels[x], {fromServer: true});
                }

                // This is a sync, we don't have to add listeners
                continue;
            } else {
                Omni.collections[collectionName] = new Omni.Protos[collectionObj.protoIndex](models);
            }

            (function(collectionName, modelName) {
                Omni.collections[collectionName].on("add", function(model, collection, options) {
                    if (!options.fromServer)
                        Omni.connection.emit("add:" + collectionName, model);
                    addModelChangeListener(model, modelName);
                });

                Omni.collections[collectionName].on("remove", function(model, collection, options) {
                    if (!options.fromServer)
                        Omni.connection.emit("remove:" + collectionName, {oid: model.oid});
                });

                Omni.connection.on("change:" + modelName, function(data) {
                    var model = Omni.collections[collectionName]._findByOID(data.oid);
                    if (!model) return;
                    delete data.oid;
                    model.set(data, {fromServer: true});
                });

                Omni.connection.on("oid:" + modelName, function(data) {
                    var model = Omni.collections[collectionName]._findByOID(data.clientOID);
                    model.oid = data.oid;
                    delete data.oid;
                    delete data.clientOID;
                    model.set(data, {fromServer: true});
                });

                Omni.connection.on("add:" + collectionName, function(data) {
                    Omni.collections[collectionName].add(data, {fromServer: true});
                });

                Omni.connection.on("remove:" + collectionName, function(data) {
                    var _model = Omni.collections[collectionName]._findByOID(data.oid);
                    Omni.collections[collectionName].remove(_model, {fromServer: true});
                });
            })(collectionName, modelName);
        }

        if (!Omni.alreadyReady) {
            Omni._trigger("ready");
        } else {
            Omni._trigger("recheckPermissions");
            Omni._trigger("sync");
            Omni._trigger("resync");
        }
    });
})();
