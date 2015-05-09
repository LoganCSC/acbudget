$(document).ready(function() {
    d3.csv("data/budget_data.csv", function (data) {
        var model = new budget.Model(data);
        create(model);
    });
});

var currentYear;

/**
 * create the chart based on the data
 * TODO:
 *   - negatives are not revenues. They are mostly intra-fund transfers between departments.
 *     A link should be drawn from the positive bubble to a point representing
 *     where it will go (the negative counterpart). They cancel.
 *      - determine links
 *      - render links
 *   - if the bubble size is big, add a label
 *
 * @param model the budget datamodel.
 */
function create(model) {

    doFilter();
    var forceChart = budget.ForceChart("#chart", model);

    var groupSelect = $('#groupSelect');
    var sizeSelect = $('#sizeSelect');
    var colorSelect = $('#colorSelect');

    groupSelect.find('option:contains("Major Object")').prop('selected', true);
    sizeSelect.find('option:contains("Approved Amount")').prop('selected', true);
    colorSelect.find('option:contains("Expense Category")').prop('selected', true);

    forceChart.setGroup(groupSelect.find(":selected").attr("value"));
    forceChart.setSizeAttribute(sizeSelect.find(":selected").attr("value"));
    forceChart.setColorAttribute(colorSelect.find(":selected").attr("value"));
    currentYear =
    doResize(); // initial sizing

    $('#year-select').change(function() {
        doFilter();
        var sizeAttr = sizeSelect.find(":selected").attr("value");
        forceChart.setSizeAttribute(sizeAttr);
        forceChart.render();
    });

    $('#type-select').change(function() {
        doFilter();
        var sizeAttr = sizeSelect.find(":selected").attr("value");
        forceChart.setSizeAttribute(sizeAttr);
        forceChart.render();
    });

    $('#view-select').change(function() {
        var viewMode = $("#view-plot").is(":checked") ? "plot" : "cluster";
        forceChart.setViewMode(viewMode);
        forceChart.render();
    });

    groupSelect.change(function() {
        forceChart.setGroup(this.value);
        forceChart.render();
    });

    sizeSelect.change(function() {
        forceChart.setSizeAttribute(this.value);
        forceChart.render();
    });

    colorSelect.change(function() {
        forceChart.setColorAttribute(this.value);
        forceChart.render();
    });


    $(window).resize(doResize);

    function doResize(e) {
        var height = Math.max($(window).innerHeight() - $("#chart-header").innerHeight() - 100, 350);
        var width = Math.max($(window).innerWidth() - 20, 500);
        //console.log("w="+ width + " h=" + height + " e=" + e);

        forceChart.setSize(width, height);
    }

    function doFilter() {
        var year = getYear();
        model.setFilter({"Fiscal Year":year});
        updateTitle(year)
    }

    /**
     * make sure that the title reflects year, type, and totals based on selections
     * Add a little glow effect so its apparent what changed.
     */
    function updateTitle(year) {

        var total = "$" + model.getTotal().toLocaleString();

        var newYear = getYear();
        if (newYear != currentYear) {
            $("#current-year").text(year).addClass("glow");
            currentYear = newYear;
        }

        $("#budget-total")
            .attr("class", "expenditure-style")
            .text(total);

        setTimeout(function(){
            $("#current-year").removeClass('glow');
        }, 500);
    }

    function getYear() {
        var isYear2014 = $("#year2014").is(":checked");
        return isYear2014 ? "2014" : "2015";
    }
}