var budget = (function (module) {

    /**
     * Constructor for force chart.
     * There are two ways to show the data :
     *   "cluster" - groups are clustered around treemap layout centroids
     *   "plot" - groups are scatterplotted so that the group dim is on the x and the change percent on the y.
     * @param div unique jquery selector for the chart
     * @param model the data model to show
     */
    module.ForceChart = function (div, model) {

        // holds public methods and data
        var my = {
            viewMode : "cluster"  // "cluster" or "plot"
        };

        var chart;
        var svg;
        var circles;
        var force;
        var changeScale = d3.scale.linear().domain([-0.50,0.50]).clamp(true);
        var tickChangeFormat = d3.format("+%");

        /**
         * initialize the chart
         * @param div unique jquery selector for the chart
         */
        function init(div) {
            chart = $(div);
            svg = d3.select(div).append("svg");
        }

        my.setSize = function(w, h) {
            width = w; //Math.max(chart.width(), 100);
            height = h; //Math.max(chart.height(), 100);
            model.setSize(width, height);
            svg.attr("width", width)
                .attr("height", height);
            my.render();
        };

        my.setGroup = function(group) {
            //if (group != model.group) {
            //    model.randomizePositions();
            //}
            model.group = group;
        };

        var drawGroupLabels = function(centers) {
            svg.selectAll(".group-label");
            var maxLen = centers.length > 10 ? 15 : 25;

            var labels = svg.selectAll(".group-label").data(centers);
            labels.enter()
                .append("text")
                .attr("class", "group-label")
                .style("font-size", 0)
                .style("fill", '#ffffff')
                .append("title")
                .text(function(d) {return d.name;});


            // ENTER + UPDATE
            labels
                .text(function (d) {
                    return shortenText(d.name, maxLen);
                })
                .transition().duration(1000)
                .attr("transform", function (d) {
                    return "translate(" + (d.x + (d.dx / 2) - 80) + ", " + (d.y + 30) + ")";
                })
                .style("fill", '#aaa')
                .style("font-size", "14px");


            // EXIT
            labels.exit()
                .transition().duration(1000)
                .style("fill", "#ffffff")
                .style("font-size", 0)
                .style("text-shadow", "-1px 1px #ffff00")
                .remove();
        };

        my.setSizeAttribute = function(sizeVal) {
            model.sizeAttr = sizeVal;
        };

        my.setColorAttribute = function(colorVal) {
            model.colorAttr = colorVal;
            my.renderColorLegend();
        };

        my.setViewMode = function(viewMode) {
            my.viewMode = viewMode;
            if ($("#view-plot").is(":checked")) {
                $("#changeOverlay").delay(30).fadeIn(1000);
            } else {
                $("#changeOverlay").hide();
            }
        };

        my.renderColorLegend = function() {

            var legendEntry = d3.select('.colors').selectAll('.color-legend')
                .data(model.getColorValues(), function(d) {return d; });

            var entryEnter = legendEntry.enter();
            var parentDiv = entryEnter
                .append('div')
                .attr('class', "col-xs-2 color-legend")
                .attr("title", function(d) {return d; });
            parentDiv
                .append('span')
                .attr('class', 'swatch');
            parentDiv
                .append('span')
                .attr('class', 'labelText');

            // ENTER + UPDATE
            legendEntry.select('.swatch')
                .style('background', model.getColorForValue);
            legendEntry.select('.labelText')
                .text(function(d) {return shortenText(d, 25); });

            // EXIT
            legendEntry.exit().remove();
        };

        my.render = function() {
            model.processData();

            var centers = model.getCenters();
            // .friction(0) freezes
            // .theta(0.8)
            // .alpha(0.1)  cooling parameter
            force = d3.layout.force(); //.gravity(1.0).friction(0.2).alpha(0.4);

            force.on("tick", tick(centers, model.group));

            drawGroupLabels(my.viewMode == "cluster" ? centers: []);
            addChangePlotGrid();

            circles = svg.selectAll("circle").data(model.filteredData, model.keyFunc);

            // ENTER
            circles.enter()
                .append("circle")
                .attr("class", "node")
                .attr("cx", function (d) {
                    return d.x;
                })
                .attr("cy", function (d) {
                    return d.y;
                })
                .attr("r", function (d) {
                    return d.radius;
                })
                .style("fill", model.getColor)
                .on("mouseover", function (d) {
                    showPopover.call(this, d);
                })
                .on("mouseout", function (d) {
                    removePopovers();
                })
                .append("text")
                .attr();

            // UPDATE
            circles
                .transition()
                .duration(2000)
                .attr('r', function(d, i) {
                    return model.sizeAttr ? d.radius : 15
                })
                .attr('cx', function(d) { return d.x })
                .attr('cy', function(d) { return d.y })
                .style('fill', model.getColor);

            // EXIT
            circles.exit()
                .transition()
                .duration(1000)
                .attr('r', 0)
                .remove();

            force.start();
        };

        var shortenText = function(text, maxLen) {
            var result = text;
            if (text.length > maxLen) {
                result = text.substr(0, maxLen - 2) + "…";
            }
            return result;
        };

        var removePopovers = function() {
            $('.popover').each(function () {
                $(this).remove();
            });
        };

        var showPopover = function(d) {
            $(this).popover({
                placement: 'top auto',
                container: 'body',
                trigger: 'manual',
                html: true,
                content: function () {
                    return model.serialize(d);
                }
            });
            $(this).popover('show')
        };

        var addChangePlotGrid = function() {
            changeScale.range([height, 50]);

            var gridLines = d3.select("#changeOverlay").selectAll("div").data(model.changeTickValues);

            // ENTER
            gridLines.enter()
                .append("div")
                .html(function(d) {return "<p>"+ tickChangeFormat(d)+"</p>"})
                .classed('changeTick', true);

            // ENTER + UPDATE
            gridLines
                .style("top", function(d) {return changeScale(d) + 'px';})
                .style("width", function(d) { return ((d === 0) ? (width - 30) : (width - 90)) + "px"; })
                .classed('changeZeroTick', function(d) { return d === 0;});
        };

        /** updates a timestep of the physics pase layout animation */
        var tick = function(centers, group) {
            var focis = {};
            for (var i = 0; i < centers.length; i++) {
                focis[centers[i].name] = centers[i];
            }
            return function (e) {
                for (var i = 0; i < model.filteredData.length; i++) {
                    var item = model.filteredData[i];
                    var foci = focis[item[group]];
                    item.y += ((foci.y + (foci.dy / 2)) - item.y) * e.alpha;
                    item.x += ((foci.x + (foci.dx / 2)) - item.x) * e.alpha;
                }
                circles
                    //.each(my.buoyancy(e.alpha))
                    .each(collide(0.22))// was .11 originally
                    .attr("cx", function (d) { return d.x; })
                    .attr("cy", function (d) { return d.y; });
            }
        };

        my.buoyancy = function(alpha) {
            var defaultGravity = 0.8;
            var defaultRadius = 65;

            return function(d){
                var targetY = (svg.attr('height') / 2) -  defaultRadius;
                d.y += (targetY - d.y) * defaultGravity * alpha * alpha * alpha * 100;
            };
        };


        /**
         * Defines what happens when spheres collide
         * @param alpha internal alpha cooling parameter.
         * @returns {Function}
         */
        var collide = function(alpha) {
            var quadtree = d3.geom.quadtree(model.filteredData);
            return function (d) {
                var padding = 5;
                var r = d.radius + model.filteredData.maximums["radius"] + padding,
                    nx1 = d.x - r,
                    nx2 = d.x + r,
                    ny1 = d.y - r,
                    ny2 = d.y + r;
                quadtree.visit(function (quad, x1, y1, x2, y2) {
                    if (quad.point && (quad.point !== d)) {
                        var x = d.x - quad.point.x,
                            y = d.y - quad.point.y,
                            l = Math.sqrt(x * x + y * y),
                            r = d.radius + quad.point.radius + padding;
                        if (l < r) {
                            l = (l - r) / l * alpha;
                            d.x -= x *= l;
                            d.y -= y *= l;
                            quad.point.x += x;
                            quad.point.y += y;
                        }
                    }
                    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                });
            };
        };

        init(div);
        return my;
    };

    return module;
}(budget || {}));



