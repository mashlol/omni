var Omni = require("../");
var should = require("should");
var sinon = require("sinon");

describe("Omni", function() {
    it("should export Omni.Model and Omni.Collection", function() {
        Omni.Model.should.equal(require("../lib/model"));
        Omni.Collection.should.equal(require("../lib/collection"));
    });

    it("should export a listen method", function() {
        (typeof Omni.listen).should.equal("function");
    });

    describe("Listen Method", function() {
        var server;

        var expressStub;
        var expressStaticStub;
        var expressUseStub;
        var expressGetStub;

        var httpStub;
        var httpListenSpy;

        before(function(done) {
            var express = require("express");

            httpListenSpy = sinon.spy();

            httpStub = sinon.stub(require("http"), "createServer").returns({
                listen: httpListenSpy
            });

            expressStaticStub = sinon.stub();
            expressUseStub = sinon.stub();
            expressGetStub = sinon.stub();
            expressStub = sinon.stub().returns({
                use: expressUseStub,
                get: expressGetStub
            });

            expressStub.static = expressStaticStub;

            require.cache[require.resolve("express")].exports = expressStub;

            var testCollection = new Omni.Collection([{
                label: "a"
            }, {
                label: "b"
            }]);

            var testEvent = {
                run: sinon.spy()
            };

            server = Omni.listen(3000, {testCollection: testCollection}, {testEvent: testEvent});
            done();
        });

        it("should return an express server listening on the specified port", function() {
            console.log(expressStub);
            // expressSpy.calledOnce.should.be.true;
        });
    });
});