var Backbone = require("backbone");
var Model = require("./model");

module.exports = Backbone.Collection.extend({
    model: Model,
    name: "Collection",
    _createPacket: function(connection) {
        var _this = this;
        return {
            models: _this._all(connection),
            name: _this.name,
            modelName: _this.model.prototype.name
        }
    },
    _all: function (connection) {
        lModels = [];
        this.forEach(function(model) {
            var lModel = model._properties(connection);
            if (lModel) {
                lModels.push(lModel);
            }
        });
        return lModels;
    },
    toJSON: function() {
        return this._all();
    },
    createPermission: function(connection) {
        return false;
    },
    destroyPermission: function(connection) {
        return false;
    }
});