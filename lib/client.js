window.Collections = {};

window.connection = io.connect('http://localhost:<%= port %>', {
    reconnect: false
});

connection.on("omni", function(data) {
    for (var k in data) {
        var v = data[k];
        var models = [];
        for (var x in v) {
            var model = new Backbone.Model(v[x]);
            model.on("change", function (model, options) {
                obj = {};
                obj.id = model.id;
                for (var y in model.attributes) {
                    if (model.hasChanged(y)) {
                        obj[y] = model.get(y);
                    }
                }
                if (Object.keys(obj).length > 1) {
                    window.connection.emit("change:" + k.substring(0, k.length-1), obj);
                }
            });
            models.push(model);
        }
        window.Collections[k] = new Backbone.Collection(models);
    }
});

connection.on("change", function(data) {
    console.log(data);
});