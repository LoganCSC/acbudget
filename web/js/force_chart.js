var budget = (function (module) {

    /**
     * Constructor for force chart.
     * There are two ways to show the data :
     *   "cluster" - groups are clustered around treemap layout centroids
     *   "plot" - groups are scatter-plotted so that the group dim is on the x and the change percent on the y.
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
        var force;
        var changeScale = d3.scale.linear().domain([-0.50, 0.50]).clamp(true);
        var plotXScale = d3.scale.ordinal();
        var tickChangeFormat = d3.format("+%");

        // Dictionary and descriptions written by Joel Brinck Kohn
        var nameDict = {};
            nameDict["Intra-Fund Transfer"] = "Intra-Fund Transfers refer to money exchanged between two different agencies of the county.";
            nameDict["Fixed Assets"] = "Fixed assets are items and property like land, buildings, and equipment that the county cannot easily convert to cash worth more than $5000.";
            nameDict["Salaries & Employee Benefits"] = "Salaries and Employee benefits wages of county employees as well as benefits like health insurance";
            nameDict["Discretionary Services & Supplies"] = "Discretionary Services & Supplies";
            nameDict["Non-Discretionary Services & Supplies"] = "Non-Discretionary Services & Supplies ";
            nameDict["Reserve/Desg"] = "Reserves Desginations are funds that were not spent in previous years that intended to handle unknown expenses";
            nameDict["Contigency"] = "Contignecies are funds set aside for projects in the even that unforseen expenses arise";


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

        var drawClusterGroupLabels = function(centers) {
            svg.selectAll(".group-label");
            var maxLen = centers.length > 10 ? 15 : 25;
            var position = function (d) {
                return "translate(" + (d.x + (d.dx / 2) - 80) + ", " + (d.y + 30) + ")";
            };

            var labels = svg.selectAll(".group-label").data(centers);

            labels.enter()
                .append("text")
                .attr("transform", position)
                .attr("class", "group-label")
                .style("font-size", 0)
                .style("fill", '#ffffff');
                //.append("title")
                //.text(function(d) {return d.name;});

            // ENTER + UPDATE
            labels
                .text(function (d) {
                    return shortenText(d.name, maxLen);
                })
                .attr("transform", position)
                .transition().duration(1000)
                .style("fill", '#aaa')
                .style("font-size", "14px");
            labels
                .append("title")  // appending here does not seem right.
                .text(function(d) {
                    if (nameDict[d.name]) {
                        return nameDict[d.name];
                    }
                    return d.name;
                });

            // EXIT
            labels.exit()
                .transition().duration(1000)
                .style("fill", "#ffffff")
                .style("font-size", 10)
                .style("text-shadow", "-1px 1px #ffff00")
                .remove();
        };

        var drawPlotGroupLabels = function(groupValues) {

            var num = groupValues.length;
            var xOffset = Math.max(0, 35 - num);
            var fontSize = Math.max(9, 40 - num);
            var verticalText = svg.selectAll("text.plot-group-label")
                .data(groupValues);

            // ENTER
            verticalText.enter()
                .insert("text", ":first-child")
                .attr("class", "plot-group-label")
                .style("font-size", 0);

            // ENTER + UPDATE
            verticalText
                .transition().duration(1000)
                .attr("transform", function(d) {
                    return " translate(" + (xOffset + plotXScale(d)) + ",70)rotate(90)";
                })
                .style("font-size", fontSize)
                .text(function(d) {return d;});

            // EXIT
            verticalText.exit()
                .transition().duration(1000)
                .style("fill", "#ffffff")
                .style("font-size", 0)
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
        };

        my.renderColorLegend = function() {
            var legendEntry = d3.select('.colors').selectAll('.color-legend')
                .data(model.getColorValues(), function(d) {return d; });

            var entryEnter = legendEntry.enter();
            var parentDiv = entryEnter
                .append('div')
                .attr('class', "col-xs-6 col-sm-4 col-md-2 col-lg-2 color-legend")
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
                .text(function(d) {return shortenText(d, 26); });

            // EXIT
            legendEntry.exit().remove();
        };

        /** the circles get placed in clusters or in a plot formation */
        my.render = function() {
            model.processData();
            var circles = svg.selectAll("circle").data(model.filteredData, model.keyFunc);

            // ENTER
            circles.enter()
                .append("circle")
                .attr("class", "node")
                .attr("cx", function (d) {return d.x;})
                .attr("cy", function (d) {return d.y;})
                .attr("r", function (d) {return d.radius;})
                .style("fill", model.getColor)
                .on("mouseover", function (d) {
                    showPopover.call(this, d);
                })
                .on("mouseout", function (d) {
                    removePopovers();
                });

            if (my.viewMode == "cluster") {
                my.renderAsClusters(circles);
            }
            else {
                my.renderAsPlot(circles);
            }
        };

        my.renderAsClusters = function(circles) {
            var centers = model.getCenters();
            // .friction(0) freezes
            // .theta(0.8)
            // .alpha(0.1)  cooling parameter
            force = d3.layout.force().alpha(0.4); //.gravity(1.0).friction(0.2).alpha(0.4);

            force.on("tick", tick(centers, model.group, circles));

            drawClusterGroupLabels(centers);
            drawPlotGroupLabels([]);
            addChangePlotGrid([]);

            // UPDATE
            circles
                .transition().duration(1000)
                .attr('r', function(d) {
                    return model.sizeAttr ? d.radius : budget.DEFAULT_RADIUS;
                })
                .attr('cx', function(d) { return d.x })
                .attr('cy', function(d) { return d.y })
                .style('fill', model.getColor);

            // EXIT
            circles.exit()
                .transition().duration(1000)
                .attr('r', 0)
                .remove();

            force.start();
        };

        my.renderAsPlot = function(circles) {

            // stop the force layout simulation to prevent it from conflicting with plot layout.
            if (force) {
                force.stop();
            }

            addChangePlotGrid(model.changeTickValues);

            var groupValues = model.getGroupValues();
            plotXScale.domain(groupValues).rangePoints([40, model.width-10], 1);
            drawClusterGroupLabels([]);
            drawPlotGroupLabels(groupValues);

            // UPDATE
            circles
                .transition().duration(2000)
                .attr('r', function(d) {
                    return model.sizeAttr ? d.radius : budget.DEFAULT_RADIUS;
                })
                .attr('cx', function(d) {
                    return plotXScale(d[model.group]);
                })
                .attr('cy', function(d) {
                    return changeScale(d.approvedPercentChange);
                })
                .style('fill', model.getColor);

            // EXIT
            circles.exit()
                .transition().duration(1000)
                .attr('r', 0)
                .remove();
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

        var addChangePlotGrid = function(tickValues) {
            changeScale.range([height - 20, 50]);
            var gridLines = d3.select("#changeOverlay").selectAll("div").data(tickValues);

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

            // EXIT
            gridLines.exit()
                .transition().delay(1000).duration(1500)
                .style("width", "0px")
                .remove();
        };

        /** updates a timestep of the physics layout animation */
        var tick = function(centers, group, circles) {
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
                if (e.alpha > 0) {
                    circles
                        .each(collide(0.22))// was .11 originally
                        .attr("cx", function (d) { return d.x; })
                        .attr("cy", function (d) { return d.y; });
                }
            }
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



