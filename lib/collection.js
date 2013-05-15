var Backbone = require("backbone");
var Model = require("./model")(Backbone.Model);

module.exports = function(SuperCollection) {
    return SuperCollection.extend({
        model: Model,
        constructor: function() {
            SuperCollection.prototype.constructor.apply(this, arguments);
            this.listenTo(this, "add", this._setUniqueOID.bind(this));
            this.each(this._setUniqueOID.bind(this));
        },
        _createPacket: function(connection) {
            var _this = this;
            return {
                models: _this._all(connection),
                protoIndex: _this.protoIndex,
                modelProtoIndex: _this.modelProtoIndex
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
        },
        _setUniqueOID: function(model) {
            if (model.oid) model.clientOID = model.oid;
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
}