var Omni = require("../");
var should = require("should");
var sinon = require("sinon");

describe("Omni.Model", function() {
    var model;

    beforeEach(function(done) {
        model = new Omni.Model({
            oid: 2,
            label: "a"
        });
        done();
    });

    it("should take oid property on construct", function() {
        model.should.have.property("oid", 2);
        model.attributes.should.not.have.property("oid");
    });

    it("should return properties", function() {
        var properties = model._properties();
        properties.should.have.property("label", "a");
        properties.should.have.property("oid", 2);
    });

    it("should convert to json", function() {
        var returnObj = {something: true};
        model._properties = sinon.stub().returns(returnObj);
        var retVal = model.toJSON();
        retVal.should.equal(returnObj);
        model._properties.calledOnce.should.be.true;
    });
});