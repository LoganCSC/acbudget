var budget = (function (module) {

    module.DEFAULT_RADIUS = 10;

    /** constructor for budget model */
    module.Model = function (originalData) {

        var RADIUS_SCALE = 30;
        var NUMBER_FORMAT = d3.format(",.0f");
        var DEFAULT_COLOR = "#a58fff";
        // the tooltip dimensions to show in order
        var TIP_DIMENSIONS = ['Program Area', 'Major Object', 'Expense Category', 'Department', 'Account Name', 'Budget Unit'];
        var changeCategories = ["< Less than -50%", "-50% to -10%", "-10% to -1%", "No Change", "1% to 10%", "10% to 50%", "50% or greater"];
        var binChange = function(c){
            if (isNaN(c)) { return 0;
            } else if ( c < -0.50) { return changeCategories[0];
            } else if ( c < -0.1){ return changeCategories[1];
            } else if ( c < -0.001){ return changeCategories[2];
            } else if ( c <= 0.001){ return changeCategories[3];
            } else if ( c <= 0.1){ return changeCategories[4];
            } else if ( c <= 0.50){ return changeCategories[5];
            } else { return changeCategories[6]; }
        };
        var changeFillColor = d3.scale.ordinal()
            .domain(changeCategories)
            .range([
                "#d84b2a",
                "#ee9586",
                "#e4b7b2",
                "#aaaaaa",
                "#beccae",
                "#9caf84",
                "#5aa33c" // original was #7aa25c"
            ]);
        //var changeStrokeColor = d3.scale.ordinal()
        //    .domain([-3, -2, -1, 0, 1, 2, 3])
        //    .range(["#c72d0a", "#e67761","#d9a097","#999","#a7bb8f", "#7e965d", "#5a8731"]);
        var tickChangeFormat = d3.format("+%");


        // holds public methods and data
        var my = {
            width: 900,
            height: 600,
            filters: {"Fiscal Year":"2015", "type":"Expenditure"},
            changeTickValues: [-0.5, -0.25, -0.15, -0.05, 0, 0.05, 0.15, 0.25, 0.5],
            group : '',
            sizeAttr : '',
            colorAttr : ''
        };

        /** do first time processing of the data once */
        function init(originalData) {
            var data = originalData;

            for (var j = 0; j < data.length; j++) {
                var d = data[j];
                d.id = d["Program Area"] + "," + d["Budget Unit"] + "," + d["Department"]
                + "," + d["Major Object"] + "," + d["Expense Category"] + "," + d["Account Name"];
                d.x = Math.random() * my.width;
                d.y = Math.random() * my.height;
                var approvedAmt = +d["Approved Amount"];
                d.type = approvedAmt > 0 ? "Expenditure" : "Revenue";
                d["Approved Amount"] = Math.abs(+d["Approved Amount"]);
                d["Recommended Amount"] = Math.abs(+d["Recommended Amount"]);
                d.approvedToRecommendedRatio = d["Approved Amount"] / d["Recommended Amount"];
            }
            for (j = 0; j < data.length; j++) {
                d = data[j];
                var year = +d['Fiscal Year'];
                if (year > 2013) {
                    var priorYear = '' + (year - 1);
                    var filter = {id: d.id, 'Fiscal Year': priorYear};

                    var priorYearRow = _.findWhere(data, filter);

                    var priorYearRecommended = 1;
                    var priorYearApproved = 1;
                    if (priorYearRow) {
                        priorYearRecommended = priorYearRow["Recommended Amount"];
                        priorYearApproved = priorYearRow["Approved Amount"];
                    }
                    d.approvedPercentChange = Math.min(10,  (d["Approved Amount"] - priorYearApproved) / priorYearApproved);
                    d.recommendedPercentChange = Math.min(10, (d["Recommended Amount"] - priorYearRecommended) / priorYearRecommended);
                    d.approvedPercentChangeBin = binChange(d.approvedPercentChange);
                    d.recommendedPercentChangeBin = binChange(d.recommendedPercentChange);
                }
            }
            my.colors = computeColors(data);
            my.data = data;
            my.processData()
        }

        /** add more properties to original data */
        my.processData = function() {
            var data = my.data;
            var filteredData = [];

            for (var j = 0; j < data.length; j++) {
                var d = data[j];
                if (d['type'] == my.filters['type'] && d['Fiscal Year'] == my.filters['Fiscal Year']) {
                    filteredData.push(d);
                }
            }

            filteredData.maximums = getMaximums(filteredData);
            if (my.sizeAttr) {
                var rmax = filteredData.maximums[my.sizeAttr];
                for (var k = 0; k < filteredData.length; k++) {
                    filteredData[k].radius = (my.sizeAttr != '') ?
                            RADIUS_SCALE * (Math.cbrt(filteredData[k][my.sizeAttr]) / rmax) :
                            budget.DEFAULT_RADIUS;
                }
                filteredData.maximums.radius = d3.max(_.pluck(filteredData, "radius"));
            }

            my.filteredData = filteredData;
            return filteredData;
        };

        /** returns the grand total of approved amounts for the current filtered set of records */
        my.getTotal = function() {
            return d3.sum(my.filteredData, function(d) {return d["Recommended Amount"]});
        };

        my.setSize = function(width, height) {
            my.width = width;
            my.height = height;
            var data = my.data;
        };

        my.randomizePositions = function() {
            _.each(my.data, function(row) {
                row.x = Math.random() * my.width;
                row.y = Math.random() *  my.height;
            });
        };

        my.getColorValues = function() {
            if (isColorChangeAttr()) {
                return changeFillColor.domain();
            }
            else {
                return my.colorAttr ? my.getColors().domain() : [];
            }
        };

        my.getColor = function(row) {
            if (isColorChangeAttr()) {
                return changeFillColor(row[my.colorAttr]);
            }
            else {
                return my.colorAttr ? my.getColors()(row[my.colorAttr]) : DEFAULT_COLOR;
            }
        };

        function isColorChangeAttr() {
            return my.colorAttr == 'recommendedPercentChangeBin' || my.colorAttr == 'approvedPercentChangeBin';
        }

        my.getColorForValue = function(val) {
            return my.colorAttr ? my.getColors()(val) : DEFAULT_COLOR;
        };

        /** get maximum values for continuous variables. This could be a property of the data */
        var getMaximums = function(data) {
            var getMax = function(data, variable) {
                return Math.cbrt(d3.max(_.pluck(data, variable)));
            };
            return {
                'Approved Amount': getMax(data, 'Approved Amount'),
                'Recommended Amount': getMax(data, 'Recommended Amount'),
                'approvedToRecommendedRatio': getMax(data, 'approvedToRecommendedRatio'),
                'approvedPercentChange': getMax(data, 'approvedPercentChange'),
                'recommendedPercentChange': getMax(data, 'recommendedPercentChange')
            };
        };

        /** get the centers of the clusters using a treemap layout */
        my.getCenters = function() {
            var centers, map;
            centers = my.getGroupValues().map(function (d) {
                return {name: d, value: 1};
            });

            map = d3.layout.treemap().size([my.width, my.height]).ratio(1);
            map.nodes({children: centers});

            return centers;
        };

        my.getGroupValues = function() {
            return _.uniq(_.pluck(my.data, my.group));
        };

        var computeColors = function(data) {
            var colors = {};
            var categoricColumns = ["Fiscal Year", "Program Area", "Department",
                "Budget Unit", "Major Object", "Expense Category", "Account Name"
            ];
            _.each(categoricColumns, function(col) {
                colors[col] = d3.scale.category20().domain(data.map( function (d) { return d[col]; }));
            });
            colors["recommendedPercentChangeBin"] = changeFillColor;
            colors["approvedPercentChangeBin"] = changeFillColor;
            return colors;
        };

        my.getColors = function() {
            return my.colors[my.colorAttr];
        };

        my.setFilter = function(filters) {
            my.filters = filters;
            my.processData();
        };


        my.keyFunc = function(d) {
            return d.id;
        };

        my.serialize = function(d) {
            var tip = "<div class='tip-header'><b>" + d['Fiscal Year'] + " " + d.type + "</b></div>";
            _.each(TIP_DIMENSIONS, function(dimension) {
                if (dimension == my.group) {
                    tip += "<span class='selected-tip-dimension'><b>" + dimension + ": </b>" + d[dimension] + "</span><br/>";
                } else if (dimension == my.colorAttr) {
                    tip += "<span class='selected-tip-dimension'><b>" + dimension + ": </b>" + d[dimension] + "</span><br/>";
                }
                else {
                    tip += "<b>" + dimension + ": </b>" + d[dimension] + "<br/>";
                }
            });
            tip +=
                "<span style='color:"+ changeFillColor(d['approvedPercentChangeBin'])+"'><b>Approved Amount:</b> $" + NUMBER_FORMAT(d['Approved Amount'])
                + "   (" + NUMBER_FORMAT(100 * d['approvedPercentChange']) + "% changed)</span><br />" +
                "<span style='color:"+ changeFillColor(d['recommendedPercentChangeBin'])+"'><b>Recommended Amount:</b> $" + NUMBER_FORMAT(d['Recommended Amount'])
                + "   (" + NUMBER_FORMAT(100 * d['recommendedPercentChange']) + "% changed)</span>";
            return tip;
        };

        init(originalData);

        return my;
    };

    return module;
}(budget || {}));


