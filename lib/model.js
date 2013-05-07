var Backbone = require("backbone");

module.exports = Backbone.Model.extend({
    _properties: function (connection) {
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
        obj = this._properties();
        obj.id = this.id;
        return obj;
    },
    readPermission: function(connection, property) {
        return true;
    },
    writePermission: function(connection, property, value) {
        return false;
    }
});
