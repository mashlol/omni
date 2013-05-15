var Omni = require("../");
var should = require("should");
var sinon = require("sinon");
var path = require("path");

describe("Omni", function() {
    it("should export Omni.Model and Omni.Collection", function() {
        // TODO find a better way to test for these
        Omni.Collection.prototype.should.have.property("createPermission");
        Omni.Collection.prototype.should.have.property("destroyPermission");

        Omni.Model.prototype.should.have.property("readPermission");
        Omni.Model.prototype.should.have.property("writePermission");
    });

    it("should export a listen method", function() {
        (typeof Omni.listen).should.equal("function");
    });

    describe("Listen Method", function() {
        var server;

        var expressStub;
        var expressServerStub;
        var expressStaticStub;
        var expressStaticReturnObj;
        var expressUseStub;
        var expressGetStub;

        var httpStub;
        var httpListenSpy;

        var socketIoStub;
        var socketIoOnStub;

        var collection;
        var testEvent;
        var disconnectEvent;
        var connectEvent;

        before(function(done) {
            var express = require("express");

            // HTTP Stuff
            httpListenSpy = sinon.spy();

            httpStub = sinon.stub(require("http"), "createServer").returns({
                listen: httpListenSpy
            });

            // SocketIO stuff
            socketIoOnStub = sinon.stub();
            socketIoServerStub = {
                sockets: {
                    on: socketIoOnStub
                }
            }
            socketIoStub = sinon.stub(require("socket.io"), "listen").returns(socketIoServerStub);

            // Express stuff
            expressStaticReturnObj = {prop: true};
            expressStaticStub = sinon.stub().returns(expressStaticReturnObj);
            expressUseStub = sinon.stub();
            expressGetStub = sinon.stub();
            expressServerStub = {
                use: expressUseStub,
                get: expressGetStub
            }
            expressStub = sinon.stub().returns(expressServerStub);

            expressStub.static = expressStaticStub;

            require.cache[require.resolve("express")].exports = expressStub;

            collection = new Omni.Collection([{
                label: "a"
            }, {
                label: "b"
            }]);

            testEvent = {
                run: sinon.spy()
            };

            disconnectEvent = {
                run: sinon.spy()
            };

            connectEvent = {
                run: sinon.spy()
            };

            server = Omni.listen(3000, {collection: collection}, {
                testEvent: testEvent,
                disconnect: disconnectEvent,
                connect: connectEvent
            });
            done();
        });

        it("should listen with http on the specified port", function() {
            httpListenSpy.calledWith(3000).should.be.true;
        });

        it("should return an express server", function() {
            server.express.should.equal(expressServerStub);
        });

        it("should return a socketio server", function() {
            server.webSocket.should.equal(socketIoServerStub);
        });

        it("should serve /public folder", function() {
            expressStaticStub.calledWith(path.resolve(path.dirname(require.main.filename), 'public')).should.be.true;
            expressUseStub.calledWith(expressStaticReturnObj).should.be.true;
        });

        it("should compile the collection and model prototypes", function() { // TODO

        });

        it("should add a connection listener", function() {
            socketIoOnStub.firstCall.args[0].should.equal("connection");
            (typeof socketIoOnStub.firstCall.args[1]).should.equal("function");
        });

        describe("Socket Handler", function() {
            var socket;
            var socketOnStub;
            var socketEmitStub;

            var connection;

            before(function(done) {
                socketOnStub = sinon.stub();
                socketEmitStub = sinon.stub();
                socket = {
                    id: "testID",
                    eventCallbacks: {},
                    _trigger: function(eventName, args) {
                        for (var x in this.eventCallbacks[eventName]) {
                            this.eventCallbacks[eventName][x](args);
                        }
                    },
                    on: function(eventName, callback) {
                        if (this.eventCallbacks[eventName] == null) {
                            this.eventCallbacks[eventName] = [];
                        }
                        this.eventCallbacks[eventName].push(callback);
                    },
                    emit: socketEmitStub
                };

                // Call the sockets.on("connection") listener
                connection = socketIoOnStub.firstCall.args[1](socket);

                done();
            });

            it("should create a connection object", function() {
                connection.connections["testID"].should.equal(connection);
                connection.socket.should.equal(socket);
                (typeof connection.recheckAllPermissions).should.equal("function");
            });

            it("should add event listeners", function() {
                socket.eventCallbacks["event:testEvent"].length.should.equal(1);
            });

            it("should not add event listeners for disconnect or connect", function() {
                socket.eventCallbacks.should.not.have.property("event:connect");
                socket.eventCallbacks.should.not.have.property("event:disconnect");
            });

            it("should add change listeners to collection models", function() {
                collection.each(function(model) {
                    model._events.change.length.should.equal(1);
                });
            });

            it("should emit a packet containing changes when a model changes", function() {
                collection._findByOID(1).set("testProp", 1);
                socketEmitStub.calledWith("change:collectio", {oid: 1, testProp: 1}).should.be.true;
            });

            it("should emit a packet containing the new model when a model is added", function() {
                collection.add({label: "c"});
                socketEmitStub.calledWith("add:collection", {oid: 3, label: "c"}).should.be.true;
            });

            it("should emit a packet containing the oid of a model when it is removed", function() {
                collection.remove(collection._findByOID(3));
                socketEmitStub.calledWith("remove:collection", {oid: 3}).should.be.true;
            });

            it("should add a model when the client sends an add packet only if the client has permission", function() {
                collection.length.should.equal(2);
                socket._trigger("add:collection", {label: "c"});
                collection.length.should.equal(2);
                collection.createPermission = function() {
                    return true;
                }
                socket._trigger("add:collection", {label: "c"});
                collection.length.should.equal(3);
            });

            it("should remove a model when the client sends a remove packet only if the client has permission", function() {
                collection.length.should.equal(3);
                socket._trigger("remove:collection", {oid: 3});
                collection.length.should.equal(3);
                collection.destroyPermission = function() {
                    return true;
                }
                socket._trigger("remove:collection", {oid: 3});
                collection.length.should.equal(2);
            });

            it("should change a model when the client sends a change packet only if the client has permission", function() {
                collection._findByOID(2).get("label").should.equal("b");
                socket._trigger("change:collectio", {oid: 2, label: "c"});
                collection._findByOID(2).get("label").should.equal("b");
                collection._findByOID(2).writePermission = function() {
                    return true;
                }
                socket._trigger("change:collectio", {oid: 2, label: "c"});
                collection._findByOID(2).get("label").should.equal("c");
            });

            it("should run the connection event", function() {
                connectEvent.run.calledOnce.should.be.true;
            });

            it("should add a disconnect listener", function() {
                socket.eventCallbacks.disconnect.length.should.equal(1);
            });

            it("should run the disconnect event", function() {
                socket._trigger("disconnect");
                disconnectEvent.run.calledOnce.should.be.true;

                connection.connections.should.not.have.property("testID");
            });

            it("should emit the connect packet", function() {
                socketEmitStub.calledWith("omni", {
                    collection: {
                        models: [{
                            label: "a",
                            oid: 1
                        }, {
                            label: "b",
                            oid: 2
                        }],
                        protoIndex: 1,
                        modelProtoIndex: 0
                    }
                }).should.be.true;
            });
        });
    });
});