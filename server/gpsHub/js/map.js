var map;
var drivers = {};
var list_version;
var loc_version;

$(document).ready(function () {
    initMap();
    bindListToggle();
    resizeList();
    moment.lang('ru');

    getList();
    getDriversLocation();
    setInterval(getDriversLocation, 1000);
});

function initMap() {
    map = new ol.Map({
        target: 'map-canvas',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            new ol.layer.Vector({
                source: new ol.source.Vector()
            })
        ],
        projection: 'EPSG:3857',
        view: new ol.View2D({
            center: ol.proj.transform([37.61778, 55.75167], 'EPSG:4326', 'EPSG:3857'),
            zoom: 11
        })
    });

    map.once("postrender", function () {
        initLayout();
        map.updateSize();
    });
}

function initLayout() {
    var layout = $('#container').layout({
        closeable: false,
        slidable: false,
        center__paneSelector: "#map-layout",
        west__paneSelector: "#list-layout",
        center__minWidth: 300,
        west__size: 250,
        west__minSize: 150,
        spacing_open: 1,
        spacing_closed: 20,
        livePaneResizing: true,
        stateManagement__enabled: true,
        onresize: function () {
            map.updateSize();
            resizeList();
        }
    });

    $("#list-layout-resizer").append(
        "<div id='resizer-btn'>" +
            "<span class='glyphicon glyphicon-chevron-right'></span>" +
        "</div>"
    );

    layout.bindButton('#list-toggler', 'close', 'west');
    layout.bindButton('#resizer-btn', 'open', 'west');
    $("#list-layout").show();
}

function bindListToggle() {
    var $panel_collapse = $(".panel-collapse");

    $panel_collapse.on('show.bs.collapse', function () {
        var $span = $(this).closest(".panel").find(".ext-btn").find("span");
        $span.removeClass();
        $span.addClass("glyphicon glyphicon-chevron-up");
    });

    $panel_collapse.on('hide.bs.collapse', function () {
        var $span = $(this).closest(".panel").find(".ext-btn").find("span");
        $span.removeClass();
        $span.addClass("glyphicon glyphicon-chevron-down");
    });
}

function bindListMapping() {
    $("#list").find(".panel-heading").click(function () {
        var id = $(this).closest(".panel").attr('id').substring(7);
        var features = map.getLayers().getArray()[1].getSource().getFeatures();
        var point;
        features.forEach(function (item) {
            if (item.id === id) {
                point = item.getGeometry().getExtent();
            }
        });

        if (point !== undefined) {
            var view = map.getView();
            var pan = ol.animation.pan({
                duration: 400,
                source: (view.getCenter())
            });
            map.beforeRender(pan);
            view.setCenter([point[0], point[1]]);
        }
    });
}

function resizeList() {
    if ($("#list").width() < 360) {
        $(".panel-collapse .col-xs-6").width("70%");
    } else {
        $(".panel-collapse .col-xs-6").width("20%");
    }
}

function getList() {
    $.ajax({
        url: 'actions/drivers.php',
        type: 'GET',
        data: {
            type: 'list'
        },
        dataType: 'json',
        success: function (data) {
            if (data && data.list) {
                $("#list").empty();
                data.list.forEach(function (driver) {
                    addDriverToList(driver);
                });
                bindListMapping();
                list_version = data.list_version;
            }
        }
    });
}

function addDriverToList(driver) {
    var heading_text = driver.name != undefined ? driver.name + '<br>' + driver.vehile_num : "Нет информации <br> Id: " + driver.driver_id;

    var properties = [];
    properties.push({name : "Id", value : driver.driver_id});
    if (driver.alias != undefined && driver.alias != "") {
        properties.push({name : 'Позывной', value : driver.alias});
    }
    if (driver.phone_number != undefined && driver.phone_number != "") {
        properties.push({name : 'Номер телефона', value : driver.phone_number});
    }
    if (driver.vehile_description != undefined && driver.vehile_description != "") {
        properties.push({name : 'Описание машины', value : driver.vehile_description});
    }
    properties.push({name : "Последняя активность", value : "Нет информации", classname : "last-activity"});

    var prop_text = "";
    properties.forEach(function(property){
        prop_text +=
            '<div class="row">' +
                '<div class="col-xs-6">' + property.name + '</div>' +
                '<div class="col-xs-6 ' + (property.classname ? property.classname : '') + '">' + property.value + '</div>' +
            '</div>'
    });

    var striped_class = "";
    if (driver.confirmed == 0)
        striped_class = "striped unconfirmed";

    $("#list").append(
        '<div id="driver-' + driver.driver_id + '" class="panel panel-default">' +
            '<div class="panel-heading ' + striped_class + '">' +
                '<div class="circle"></div>' +
                '<div class="driver-text">' + heading_text + '</div>' +
                '<div class="right driver-color"></div>' +
                '<div class="right ext-btn" onclick="driverToggle(' + driver.driver_id + ')">' +
                    '<span class="glyphicon glyphicon-chevron-down"></span>' +
                '</div>' +
            '</div>' +
            '<div id="driver-' + driver.driver_id + '-collapse" class="panel-collapse collapse" data-parent="#list">' +
                '<div class="panel-body">' +
                    prop_text +
                    '<a href="#" onclick="buildModal(' + driver.driver_id + ');">Изменить...</a>' +
                '</div>' +
            '</div>' +
        '</div>'
    );

    if (drivers[driver.driver_id] != undefined)
        $("#driver-" + driver.driver_id + " .driver-color").css('background-color', drivers[driver.driver_id].color);
}

function driverToggle(id) {
    $("#driver-" + id + "-collapse").collapse('toggle');
    return false;
}

function getDriversLocation() {
    $.ajax({
        url: 'actions/drivers.php',
        type: 'GET',
        data: {
            type: 'location'
        },
        dataType: 'json',
        success: function (data) {
            if (data && data.list && data.loc_version != loc_version) {
                data.list.forEach(function (driver) {
                    if (driver.id === null || driver.lat === null || driver.lng === null)
                        return;

                    if (drivers[driver.id] === undefined)
                        drivers[driver.id] = addPoint(driver.id, driver.lat, driver.lng);
                    else
                        movePoint(driver.id, driver.lat, driver.lng);
                    drivers[driver.id].last_activity = driver.last_activity;
                });
            }
            updateOnlineStatuses(data.time);
            loc_version = data.loc_version;
        }
    });
}

function addPoint(id, lat, lon) {
    var color = randomColor();
    $("#driver-" + id + " .driver-color").css('background-color', color);

    if (typeof(lat) === "string")
        lat = parseFloat(lat);
    if (typeof(lon) === "string")
        lon = parseFloat(lon);

    var iconFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'))
    });
    iconFeature.id = id;
    iconFeature.color = color;

    var iconStyle = new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 46],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            opacity: 0.75,
            src: 'img/marker.php?color=' + encodeURIComponent(color),
            size: [36, 48]
        })
    });
    iconFeature.setStyle(iconStyle);

    map.getLayers().getArray()[1].getSource().addFeature(iconFeature);

    return iconFeature;
}

function movePoint(id, lat, lon) {
    if (typeof(lat) === "string")
        lat = parseFloat(lat);
    if (typeof(lon) === "string")
        lon = parseFloat(lon);

    var point = new ol.geom.Point(ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857'));
    drivers[id].set('geometry', point);
}

function updateOnlineStatuses(now) {
    Object.keys(drivers).forEach(function (id) {
        var diff = now - drivers[id].last_activity;
        var status;
        if (diff < 60)
            status = 'online';
        else if (diff < 5 * 60)
            status = 'wait';
         else
            status = 'offline';
        if (drivers[id].status !== status) {
            var $circle = $("#driver-" + id + " .circle");
            switch (status) {
                case 'online':
                    $circle.removeClass("wait").addClass("online");
                    break;
                case 'wait':
                    $circle.removeClass("online").addClass("wait");
                    break;
                case 'offline':
                    $circle.removeClass("online").removeClass("wait");
                    break;
            }
        }
        var a = moment(drivers[id].last_activity, "X");
        var b = moment(now, "X");
        $("#driver-" + id + " .last-activity").text(a.from(b));
    });
}

function randomColor() {
    var r = (Math.floor(Math.random() * 16 / 3) * 3).toString(16);
    var g = (Math.floor(Math.random() * 16 / 3) * 3).toString(16);
    var b = (Math.floor(Math.random() * 16 / 3) * 3).toString(16);

    return "#" + r.toString(16) + g.toString(16) + b.toString(16);
}