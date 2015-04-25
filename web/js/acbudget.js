$(document).ready(function() {
    d3.csv("data/fake_budget_data.csv", function (data) {
        var model = new budget.Model(data);
        create(model);
    });
});

var currentYear;

/**
 * create the chart based on the data
 * TODO:
 *   - fix bugs around cluster layout
 *   - if the bubble size is big, add a label
 *   - prepare for 3 min demo
 *   - only colors for unique values in filtered data
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
        var isExpenditure = $("#expenditure").is(":checked");
        var year = getYear();
        var type = isExpenditure ? "Expenditure" : "Revenue";

        model.setFilter({"Fiscal Year":year, "type":type});

        updateTitle(year, isExpenditure)
    }

    /**
     * make sure that the title reflects year, type, and totals based on selections
     * Add a little glow effect so its apparent what changed.
     */
    function updateTitle(year, isExpenditure) {

        var total = "$" + model.getTotal().toLocaleString();
        var totalSuffix = " in " + (isExpenditure ? "expenditures" : "revenues");

        var newYear = getYear();
        if (newYear != currentYear) {
            $("#current-year").text(year).addClass("glow");
            currentYear = newYear;
        }

        $("#budget-total").attr("class", isExpenditure ? "expenditure-style" : "revenue-style").text(total);
        $("#budget-type").text(totalSuffix);

        setTimeout(function(){
            $("#current-year").removeClass('glow');
        }, 500);
    }

    function getYear() {
        var isYear2014 = $("#year2014").is(":checked");
        return isYear2014 ? "2014" : "2015";
    }
}