
'use strict';

require.config({
    urlArgs: "bust=" + (new Date()).getTime(),
    paths: {
        "jquery": "vendor/jquery-2.1.4.min",
        "underscore": "vendor/underscore-min",
        "Hashtable": "vendor/Hashtable",
        "sprintf": "vendor/sprintf"
    }
});

require(["jquery", "log", "Model", "Render", "Vector3", "outliner", "config", "Document", "Cut", "epilog", "Buffer", "svg", "Path", "Vector2"], function ($, log, Model, Render, Vector3, outliner, config, Document, Cut, epilog, Buffer, svg, Path, Vector2) {

    var start = function () {
        // Return "count" angles (in radians) going around the circle.
        var angles = function (count) {
            return _.times(count, function (angle) {
                return angle*Math.PI*2/count;
            });
        };

        // Return the first half of the list.
        var halfList = function (list) {
            return list.slice(0, list.length/2);
        };

        // Return a list of {value, isLast} objects isLast is true only for the last item.
        var identifyLast = function (list) {
            return _.map(list, function (value, index) {
                return {
                    value: value,
                    isLast: index === list.length - 1
                };
            });
        };

        var generatePasses = function (callback) {
            if (false) {
                // Left and right face only.
                callback(0, 0, false);
                callback(0, Math.PI, false);
            } else {
                // Whole thing.
                _.each(config.PASS_SHADES, function (shadePercent) {
                    _.each(identifyLast(halfList(angles(config.ANGLE_COUNT))), function (data) {
                        callback(shadePercent, data.value, data.isLast);
                    });
                });
            }
        };

        // Go to the spot that indicates to the hardware that it should advance to
        // the next step.
        var makeHeatSensorCut = function () {
            var x = 3.0;
            var y = 2.5;

            var path = new Path([
                new Vector2(x, y - 2/72.),
                new Vector2(x, y)
            ]);

            return new Cut(path, 4, 100, 50);
        };

        var makeTimeWasterCut = function (longDelay) {
            var cx = 10;
            var cy = 2.5;
            var radius = 0.125;
            var pointCount = 10;
            var speed = longDelay ? 2 : 4;

            var path = new Path();

            _.times(pointCount + 1, function (i) {
                var t = i/pointCount*Math.PI*2;
                var x = cx + Math.cos(t)*radius;
                var y = cy + Math.sin(t)*radius;
                path.addVertex(new Vector2(x, y));
            });

            return new Cut(path, speed, 1, 50);
        };

        Model.load("models/new_knight_baseclean_sym.json", function (model) {
            log.info("Successfully loaded model");

            var bbox3d = model.getBoundingBox();
            var center = bbox3d.center();

            // Move center to origin.
            model.translate(center.negated());

            // Find scaling factor.
            var size = bbox3d.size();
            var maxSize = Math.max(size.x, size.y);
            var scale = config.MODEL_DIAMETER / maxSize;

            var light = (new Vector3(-1, 1, 1)).normalized();
            var doc = new Document("untitled");
            var angle = 0; // Use 0.73 to make a hole.

            generatePasses(function (shadePercent, angle, lastBeforeLongTurn) {
                var render = Render.make(model, 1024, 1024, angle, null);
                render.addBase();

                // Add the shade (for spiraling). The "transform" converts from
                // model units to raster coordinates. "scale" converts from
                // model units to dots. DPI converts from inches to dots.
                var shadeWidth = config.ROD_DIAMETER*shadePercent/100.0*render.transform.scale/scale;
                var shadeCenterX = render.transform.offx;
                render.addShade(shadeWidth, shadeCenterX);

                // Expand to take into account the kerf.
                var kerfRadius = config.KERF_RADIUS_IN*render.transform.scale/scale;
                if (shadePercent != 0 && false) {
                    // Rough cut, add some spacing so we don't char the wood.
                    kerfRadius += config.ROUGH_EXTRA_IN*render.transform.scale/scale;
                }
                render.addKerf(kerfRadius);

                // Cut off the sides when we're shading.
                if (shadePercent > 0) {
                    render.setTop(2);
                }

                var paths = outliner.findOutlines(render);
                paths.simplify(1);
                paths.draw(render.ctx);
                paths = paths.transformInverse(render.transform, scale, config.FINAL_X, config.FINAL_Y);

                $("body").append(render.canvas);

                paths.each(function (path) {
                    var cut = new Cut(path, 4, 100, 50);
                    doc.addCut(cut);
                });
                doc.addCut(makeHeatSensorCut())
                doc.addCut(makeTimeWasterCut(lastBeforeLongTurn))
            });

            var buf = new Buffer();
            epilog.generatePrn(buf, doc);
            var $a = $("<a>").attr("download", "out.prn").attr("href", buf.toDataUri("application/octet-stream")).text("Click to download PRN file");
            $("body").append($a);

            var buf = new Buffer();
            svg.generateSvg(buf, doc);
            var $a = $("<a>").attr("download", "out.svg").attr("href", buf.toDataUri("image/svg+xml")).text("Click to download SVG file");
            $("body").append($a);
        }, function (error) {
            log.warn("Error loading model: " + error);
        });
    };

    $("#startButton").click(start);
});
