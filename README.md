# Omni.js
Omni.js is a framework designed to integrate with Backbone.js in order to give the client all the information possible.  The goal is to make writing server/client apps extremely simple.

# Installation
```sh
npm install omni
```


# Usage
```javascript
var omni = require("omni");
var collection = new omni.Collection([
    new omni.Model({
        name: "foo",
        bar: "baz"
    })
]);
omni.listen(3000, {
    collection: collection
});
```
The `.listen(port, collections, events)` method takes in a port, a list of instantiated collections, and a list of event objects.


# Models
```javascript
var omni = require("omni");

var Player = omni.Model.extend({
    name: "Player",
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
        } else if (connection != undefined && connection.player != null && connection.player == this) {
            return true;
        }
        return false;
    },

    writePermission: function (connection, property) {
        if  (connection.player == this) {
            return true;
        }
        return false;
    }
});
```
A model is essentially the same as a model in Backbone, however, a `name` property is required, and a `readPermission(connection, property)` and `writePermission(connection, property)` method can be supplied to determine whether or not there is permission to read or write to this model.


# Collections
```javascript
var omni = require("omni");

var Players = omni.Collection.extend({
    name: "Players",
    model: Player
});
```
A collection just requires the additional property `name`, everything else is the same as Backbone.js


# Events
```javascript
var loginEvent = {
    run: function (connection, collections, data) {
        if (data.name && data.password) {
            var player = collections.players.findWhere({name: data.name, password: data.password});
            if (player) {
                connection.player = player;
                console.log(player.get("name") + " logged in.");
            }
        }
    }
}
```
Events allow for custom code to be run on the server when the client triggers the event.