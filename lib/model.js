var Backbone = require("backbone");

module.exports = Backbone.Model.extend({
    constructor: function(data) {
        this.oid = data.oid;
        delete data.oid;
        Backbone.Model.prototype.constructor.apply(this, arguments);
    },
    _properties: function (connection) {
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
