var Backbone = require("backbone");
var Model = require("./model");

module.exports = Backbone.Collection.extend({
    model: Model,
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
    },
    createPermission: function(connection) {
        return false;
    },
    destroyPermission: function(connection) {
        return false;
    }
});