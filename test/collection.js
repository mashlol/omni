var Omni = require("../");
var should = require("should");
var sinon = require("sinon");

describe("Omni.Collection", function() {
    var collection;

    beforeEach(function(done) {
        collection = new Omni.Collection([{
            label: "a"
        }, {
            label: "b"
        }]);
        done();
    });

    it("should set model to Omni.Model", function() {
        // TODO find a better way to test this
        collection.__proto__.model.prototype.should.have.property("readPermission");
        collection.__proto__.model.prototype.should.have.property("writePermission");
    });

    it("should set OIDs and add listeners on construct", function() {
        collection.each(function(model, index) {
            model.should.have.property("oid", index+1);
        });
        collection._events.add.length.should.equal(1);
    });

    it("should create packets", function() {
        collection.protoIndex = 1;
        collection.modelProtoIndex = 2;
        var packet = collection._createPacket();
        packet.protoIndex.should.equal(1);
        packet.modelProtoIndex.should.equal(2);
        packet.models.length.should.equal(2);
        packet.models[0].should.have.property("label", "a");
        packet.models[1].should.have.property("label", "b");
    });

    it("should convert all data to json", function() {
        var returnObj = {something: true};
        collection._all = sinon.stub().returns(returnObj);
        var ret = collection.toJSON();
        ret.should.equal(returnObj);
        collection._all.calledOnce.should.be.true;
    });

    it("should set unique OIDs", function() {
        var model = {};
        collection._setUniqueOID(model);
        model.should.have.property("oid", 3);
    });

    it("should find by OID", function() {
        var model = {};
        collection.add(model);
        collection._setUniqueOID(model);
        collection._findByOID(1).oid.should.equal(1);
    });

    it("should default permissions to false", function() {
        collection.createPermission().should.equal.false;
        collection.destroyPermission().should.equal.false;
    });

});