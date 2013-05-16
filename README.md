![Omni.js](http://i.imgur.com/S1C8rDt.png)

[![Build Status](https://travis-ci.org/Mashlol/omni.png?branch=master)](https://travis-ci.org/Mashlol/omni)

[![ScreenShot](http://i.imgur.com/5ONLYhK.png)](http://youtu.be/2UPGrQgLJqQ)

Omni.js is a framework designed to make building real-time apps with Backbone.js extremely easy.  Simply define models, collections, and events on the server, and when a client connects it will automatically be given all of the information it has permission to see.  Using Backbone.js from the client, you can then update the models and collections directly (i.e. `Omni.collections.players.findWhere({name: "Jim"}).set("x", 10);`, and all of the new information will be propagated by the server to any other clients who have permission to see these changes.  You can define who has permission to read and write to models, and who has permission to add and remove models from collections.

# Installation
```sh
npm install omni
```

# Example Apps

* https://github.com/Mashlol/omni-chat-example - a very simple of example of how to use Omni.js effectively. - Demo: http://chat.kevinbedi.com
* https://github.com/Mashlol/omni-arena - a much more complex usage of Omni.js, building a realtime HTML5 arena game. - Demo: http://arena.kevinbedi.com


# Usage
```javascript
var Omni = require("omni");
var collection = new Omni.Collection([
    new Omni.Model({
        name: "foo",
        bar: "baz"
    })
]);
Omni.listen(3000, {
    collection: collection
});
```
The `.listen(port, collections, events, options)` method takes in a port, a list of instantiated collections, and a list of event objects.  It returns a hash containing `webSocket` and `express` which contain the raw `webSocket` and `express` servers.  The options parameter can take the following options:

* `static` - boolean, defaults to true.  If false, Omni.js will not serve your `/public` folder automatically.
* `development` - boolean, defaults to false.  If true, Omni.js will serve the client javascript unminified.


There is also a list of collections available on the Omni object, `Omni.collections`, which should work the same on both the client and the server.  This way, within models and collections, you can use `Omni.collections` to keep code working on both the client and server.


# Connection Properties
`connection.sync()` - This method can be called on any `connection` object that is passed between the permissions and event methods, and will run through each collection and each model and check if there are any changes in the permissions, and push the changes to the client.  This is useful for instances where a change in one model might trigger some permission changes in another model or collection.  For example, if a user has permission to read all other users in the same "room" as them, and you change that users room, you need to call this event to propagate all the new players they might be able to see, and remove all the old players they can no longer see.  Note that this is a relatively intense method, use it wisely.

`connection.socket` - The raw socket.io socket object associated with this connection.

`connection.connections` - Returns an object containing all of the other connection objects, where the key is the socket ID.  You can do things like:

```javascript
for (var x in connection.connections) {
    connection.connections[x].socket.emit("myCustomEvent", {some: args});
}
```

# Models
```javascript
var Omni = require("omni");

var Player = Omni.Model.extend({
    defaults: {
        online: false,
        x: 0,
        y: 0,
        name: "name",
        password: "hash"
    },

    readPermission: function (connection, property) {
        if (property != undefined && property != "password" && this.get("online") || property == undefined) {
            return true;
        } else if (connection.player != null && connection.player == this) {
            return true;
        }
        return false;
    },

    writePermission: function (connection, property, value) {
        if  (connection.player != null && connection.player == this) {
            return true;
        }
        return false;
    }
});
```
A model is essentially the same as a model in Backbone, however a `readPermission(connection, property)` and `writePermission(connection, property, value)` method can be supplied to determine whether or not there is permission to read or write to this model.

The `readPermission()` method should return a value even if the `property` parameter is not passed in.  The result of the method should be whether or not ANY attributes will be available.  The method is called with only the `connection` parameter before checking each property individually, as if it returns false we won't need to iterate over all of the parameters.  The `connection` parameter should be always be passed in, however.

All of the methods and properties you define in a model will also be propagated to the client.  Prefix properties with an "_" if you wish to keep them on the server only.  The `readPermission` and `writePermission` methods are kept on the server only.  All of the backbone methods are also kept on the server, so overriding native Backbone methods is currently not possible on the client, but should still work on the server.  If you wish to access or modify collections, use `Omni.collections` as this will work on both the client and the server.


# Collections
```javascript
var Omni = require("omni");

var Players = Omni.Collection.extend({
    model: Player,
    createPermission: function(connection) {
        return true;
    },
    destroyPermission: function(connection) {
        if (connection.player.get("admin")) {
            return true;
        }
        return false;
    }
});
```
A collection is essentially the same collection as Backbone, however a `createPermission(connection)` and `destroyPermission(connection)` method can be supplied to determine whether or not there is permission to add or remove models to/from this collection.

All of the methods and properties you define in a collection will also be propagated to the client.  Prefix properties with an "_" if you wish to keep them on the server only.  The `createPermission` and `destroyPermission` methods are kept on the server only.  All of the backbone methods are also kept on the server, so overriding native Backbone methods is currently not possible on the client, but should still work on the server.  If you wish to access or modify collections, use `Omni.collections` as this will work on both the client and the server.


# Events
```javascript
var loginEvent = {
    run: function (connection, collections, data) {
        if (connection.player) {
            return {error: "Already logged in."};
        }
        if (data.name && data.password) {
            var player = collections.players.findWhere({name: data.name, password: data.password});
            if (player) {
                connection.player = player;
                console.log(player.get("name") + " logged in.");
                return {success: "Logged in."};
            }
        }
        return {error: "Incorrect username or password."};
    }
}
```
Events allow for custom code to be run on the server when the client triggers the event.

Events are passed into the `listen` method of Omni as a hash, such as `Omni.listen(1337, {collection: new Omni.Collection()}, {loginEvent: loginEvent});`.

Predefined Events: `connect`, and `disconnect`.  Any event passed in with these keys will be called automatically, and ignored in your `Omni.trigger()` calls on the client.  The third (data) parameter will not be passed in for these events.

# Client
Everything you should need should be readily available to access on the client.  Right now, Omni.js automatically serves the `public` folder of your app at the port you specify.  It also serves a client file (omni.js) at `/omni.js`.  The client requires socket.io and Backbone, and Backbone requires Underscore, so your `index.html` head might look something like:

```html
<head>
    <script src="/socket.io/socket.io.js"></script>
    <script src="http://underscorejs.org/underscore-min.js"></script>
    <script src="http://backbonejs.org/backbone-min.js"></script>
    <script src="/omni.js"></script>

    <script src="./your-custom-script.js"></script>
</head>
```

The omni.js file automatically gives you the following:

`Omni.collections (alias: window.Collections)` - All the collections you defined on the server and passed into the `listen` method are automatically available in the global `Collections` object on the client, provided they have permission to see it.  If I passed in a collection to the server with `Omni.listen(1337, {messages: new Omni.Collection()});`, I'd be able to access this collection on the client with `Collections.messages`.  Then I can do things like `Collections.messages.add({message: "Hello!"})` and the server will propagate this new message to all clients who have permission to see it.

`Omni.trigger(eventName, args, callback)` - This is how you trigger custom events.  Once you trigger this custom event, the server will execute the code that you wrote inside the `event hash` with the name `eventName`.  For example, with the `loginEvent` defined above, if the client sends `Omni.trigger("loginEvent", {name: "foo", password: "bar"});`, assuming a user with the name "foo" and password "bar" exists, it will set connection.player to that player model.  This allows for the server to change the permissions of this user now, maybe to allow them to modify their own model more freely, or grant admin access, or other actions.  The callback takes in a single parameter, which is the response hash.

`Omni.ready(callback)` - You can call `Omni.ready()` any number of times, providing callbacks.  When Omni has downloaded the initial data from the server, these callbacks will be executed.  If you call `Omni.ready()` after Omni has already initialized, your callback will be called immediately.

`Omni.on(eventName, callback)` - Add a callback for a certain client sided event.  Currently the only event is `sync`, triggered when the server calls `connection.sync()` on this client's connection.


# Contributing
Feel free to contribute fixes, features or refactors.  Just fork & submit a pull request.  Please make sure the tests pass, and to update them if need be.


# IRC
Hop on `#omni.js` on `irc.freenode.net` to discuss Omni.js, or to ask questions.


# Testing
Run `make test` or `npm test` to run the tests.


# Changelogs
v0.2.0

* Add the concept of OIDs, which are used internally by Omni to keep objects in sync with clients.  This way, when clients add new models, they can still update their attributes without having to assign an ID.  The server can also assign an ID after saving to a database, and the client will be updated based on the models OID.
* No longer reset collections when connection.recheckAllPermissions() is called.  This way there is no need for updating references on the client every time the permissions are rechecked.

v0.1.1

* Add new option `development` which if true will serve the client javascript unminified.
* The url property for collections and models is now hidden from the client, defaults from models are now shown to the client.

v0.1.0

* Methods and properties from models and collections now propagate to the client.  This does not include overridden Backbone methods.  Any method prefixed with "_" is kept private to the server.
* Fixed serving of /public with no options param - Thanks to [@evanbarter](https://github.com/evanbarter) for this fix!

v0.0.11

* Remove leaked events on client
* Fix leak on server
* Add options parameter to Omni.listen(), currently with just the `static` option.

v0.0.10

* Lock versions for dependencies
* No longer use EJS to render the port into the client file, instead just use javascript to find the port.

v0.0.9

* The client.js file is now served minified.
* Added `Omni.on(eventName, callback)` on the client side.  Currently the only event is `recheckPermissions`, triggered when the server calls `connection.recheckAllPermissions()` on this client's connection.
* Added `connection.connections` to the `connection` object so you can access other connections within events or permission methods.

v0.0.8

* Add `connection.recheckAllPermissions()` method to recheck permissions and propagate all data for that connection.
* Move `connect` event trigger to occur before Omni.js sends any data to the client.  This way you can modify the connection object to change the outcome of the data that ends up being propagated.


# License - MIT

Copyright © 2013 Kevin Bedi

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.