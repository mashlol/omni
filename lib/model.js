module.exports = function(SuperModel) {
    return SuperModel.extend({
        constructor: function(data) {
            if (data.oid) {
                this.oid = data.oid;
                delete data.oid;
            }
            SuperModel.prototype.constructor.apply(this, arguments);
        },
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
            lModel.oid = this.oid;
            if (Object.keys(lModel).length > 1) {
                return lModel;
            }
            return null;
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
}