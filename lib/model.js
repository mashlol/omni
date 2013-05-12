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
        lModel.oid = this.oid;
        return lModel;
    },
    toJSON: function(connection) {
        obj = this._properties(connection);
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
