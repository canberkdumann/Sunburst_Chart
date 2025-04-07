/*globals define*/
function drawBurst($element, layout, fullMatrix) {
    var myJSON = {
        "name": layout.title,
        "children": []
    };

    var qMatrix = fullMatrix;
    var layoutProps = layout.props;
    var colorSelection = layout.qHyperCube.qMeasureInfo[0].colorType;
    var customColorDim = colorSelection == "dimAndHex" ? true : false;

    var numOfDims = senseD3.findNumOfDims(layout);
    myJSON.children = senseD3.createFamily(qMatrix, numOfDims, layoutProps.dataFormat, customColorDim);

    var id = "sb_" + layout.qInfo.qId;
    if (document.getElementById(id)) {
        $("#" + id).empty();
    } else {
        $element.append($('<div />').attr("id", id).css("position", "relative"));
    }
    $("#" + id).width($element.width()).height($element.height());

    var width = $("#" + id).width() - 5,
        height = $("#" + id).height() - 5,
        radius = (Math.min(width, height) / 2.2);

    var x = d3.scale.linear().range([0, 2 * Math.PI]);
    var y = d3.scale.linear().range([0, radius]);

    function getColorByAverage(avg) {
        if (avg <= 0.75) return "#FFB3B3";
        if (avg <= 1.0) return "#FFF6B3";
        if (avg <= 1.25) return "#B3FFB3";
        if (avg <= 1.5) return "#B3FFF6";
        return "#B3D1FF";
    }

    function assignColorsPerLevel(node) {
        if (!node.children || node.children.length === 0) return;

        node.children.forEach(child => {
            let stats = computeAverage(child);
            let avg = stats.sum / stats.count;
            let color = getColorByAverage(avg);

            function applyColorRecursive(n) {
                n.color = color;
                if (n.children) {
                    n.children.forEach(applyColorRecursive);
                }
            }

            applyColorRecursive(child);
            assignColorsPerLevel(child);
        });
    }

    function computeAverage(d) {
        if (!d.children || d.children.length === 0) {
            return { sum: d.size || 0, count: 1 };
        }
        let total = { sum: 0, count: 0 };
        d.children.forEach(child => {
            const childTotal = computeAverage(child);
            total.sum += childTotal.sum;
            total.count += childTotal.count;
        });
        return total;
    }

    assignColorsPerLevel(myJSON);

    function cropLabel(name, depth) {
        if (depth === 2) {
            const sanitized = name.replace(',', '.');
            const num = parseFloat(sanitized);
            if (!isNaN(num)) return num.toFixed(2);
        }
        if (depth === 1) {
            const words = name.split(" ");
            if (words.length >= 2 && words[1].includes(".")) {
                return words[0] + " " + words[1];
            } else {
                return words[0];
            }
        }
        return name;
    }

    function updateBreadcrumb(d) {
        const pathArray = d.ancestors ? d.ancestors().reverse() : getAncestors(d);
        breadcrumbContainer.html("");
        pathArray.forEach((node, index) => {
            breadcrumbContainer.append("span")
                .style("cursor", "pointer")
                .style("text-decoration", "underline")
                .style("margin-right", "6px")
                .text(node.name)
                .on("click", function () {
                    click(node);
                });
            if (index < pathArray.length - 1) {
                breadcrumbContainer.append("span").text(" > ").style("margin-right", "6px");
            }
        });
    }

    function getAncestors(node) {
        const path = [];
        let current = node;
        while (current.parent) {
            path.unshift(current);
            current = current.parent;
        }
        path.unshift(current);
        return path;
    }

    var svg = d3.select("#" + id).append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", "translate(" + width / 2 + "," + (height / 2 + 10) + ")");

    var partition = d3.layout.partition().value(function (d) { return d.size; });

    var arc = d3.svg.arc()
        .startAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
        .endAngle(function (d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
        .innerRadius(function (d) { return Math.max(0, y(d.y)); })
        .outerRadius(function (d) { return Math.max(0, y(d.y + d.dy)); });

    var g = svg.selectAll("g").data(partition.nodes(myJSON)).enter().append("g");

    var tooltip = d3.select("body").append("div")
        .attr("class", "custom-tooltip")
        .style("position", "absolute")
        .style("opacity", 0)
        .style("pointer-events", "none")
        .style("z-index", 10000);

    var breadcrumbContainer = d3.select("#" + id)
        .insert("div", ":first-child")
        .attr("class", "sunburst-breadcrumb")
        .style("font-family", "'Segoe UI', sans-serif")
        .style("font-size", "13px")
        .style("margin-bottom", "10px")
        .style("color", "#333");

    var path = g.append("path")
        .attr("d", arc)
        .style("fill", function (d) {
            if (d.depth === 0) return "white";
            return d.color;
        })
        .style("cursor", "pointer")
        .on("click", click)
        .on("mouseover", function (event, d) {
            d3.select(this).classed("hovered-dimension", true);
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <div class="tooltip-box">
                    <div class="tooltip-icon">✨</div>
                    <div class="tooltip-label">${d.name}</div>
                </div>
            `)
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY + 12) + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 12) + "px")
                   .style("top", (event.pageY + 12) + "px");
        })
        .on("mouseout", function () {
            d3.select(this).classed("hovered-dimension", false);
            tooltip.transition().duration(300).style("opacity", 0);
        });

    g.append("title").text(function (d) { return d.name; });

    var text;
    if (width > 300) {
        text = g.append("text")
            .attr("transform", function (d) {
                return "rotate(" + senseD3.computeTextRotation(d, x) + ")";
            })
            .attr("x", function (d) {
                return y(d.y);
            })
            .attr("dx", "6")
            .attr("dy", ".35em")
            .style("pointer-events", "none")
            .style("fill-opacity", function (d) {
                return d.depth === 1 ? 1 : 0;
            })
            .each(function (d) {
                var el = d3.select(this);
                var label = cropLabel(d.name, d.depth);
                el.text(label);

                el.on("mouseover", function (event) {
                    d3.select(this).classed("hovered-dimension", true);
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`
                        <div class="tooltip-box">
                            <div class="tooltip-icon">✨</div>
                            <div class="tooltip-label">${d.name}</div>
                        </div>
                    `)
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY + 12) + "px");
                })
                .on("mousemove", function (event) {
                    tooltip.style("left", (event.pageX + 12) + "px")
                           .style("top", (event.pageY + 12) + "px");
                })
                .on("mouseout", function () {
                    d3.select(this).classed("hovered-dimension", false);
                    tooltip.transition().duration(300).style("opacity", 0);
                });
            });
    }
	
	
    //! Add HTML-based legend
    const htmlLegend = document.createElement("div");
    htmlLegend.className = "sunburst-legend";
    htmlLegend.innerHTML = `
        <div class="legend-title">Color → Value</div>
        <div class="legend-row"><div class="legend-box" style="background:#FFB3B3;"></div><span>0 - 0.75</span></div>
        <div class="legend-row"><div class="legend-box" style="background:#FFF6B3;"></div><span>0.75 - 1.0</span></div>
        <div class="legend-row"><div class="legend-box" style="background:#B3FFB3;"></div><span>1.0 - 1.25</span></div>
        <div class="legend-row"><div class="legend-box" style="background:#B3FFF6;"></div><span>1.25 - 1.5</span></div>
    `;
    document.getElementById(id).appendChild(htmlLegend);

    function click(d) {
        updateBreadcrumb(d);
        const descendants = getDescendants(d);
        text.transition()
            .duration(1000)
            .style("fill-opacity", function (t) {
                if (d.depth === 0) {
                    return t.depth === 1 ? 1 : 0; // root'a dönüldüğünde sadece çekirdek isimleri göster
                }
                return descendants.includes(t) ? 1 : 0;
            });

        path.transition().duration(750)
            .attrTween("d", senseD3.arcTween(d, x, y, radius, arc))
            .each("end", function (e, i) {
                if (e.x >= d.x && e.x < (d.x + d.dx)) {
                    var arcText = d3.select(this.parentNode).select("text");
                    arcText.transition().duration(750)
                        .attr("opacity", 1)
                        .attr("transform", function () {
                            return "rotate(" + senseD3.computeTextRotation(e, x) + ")";
                        })
                        .attr("x", function (d) { return y(d.y); });
                }
            });
    }

    function getDescendants(node) {
        const nodes = [];
        function recurse(n) {
            nodes.push(n);
            if (n.children) n.children.forEach(recurse);
        }
        recurse(node);
        return nodes;
    }

    d3.select(self.frameElement).style("height", height + 100 + "px");
    updateBreadcrumb(myJSON);
}

























$('<style>').html(`
    .custom-tooltip {
        background: #222;
        color: white;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-family: 'Segoe UI', sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 10000;
        max-width: 280px;
        word-wrap: break-word;
        position: absolute;
        transform: scale(0.95);
    }
    .tooltip-box {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .tooltip-icon {
        font-size: 18px;
    }
    .tooltip-label {
        font-weight: 600;
        font-size: 15px;
    }
    .hovered-dimension {
        fill-opacity: 0.8;
        text-shadow: 0 0 5px #fff;
        transition: all 0.2s ease;
    }
    .sunburst-legend {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 10px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 9999;
    }
    .legend-title {
        font-weight: 600;
        margin-bottom: 6px;
    }
    .legend-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
    }
    .legend-box {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid #999;
    }
	.sunburst-breadcrumb {
    text-align: center;
    font-weight: 600;
    user-select: none;
}
/* 🔥 Custom Unique Breadcrumb Style */
.sunburst-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 10px 15px;
    background: linear-gradient(to right, #f0f0f0, #fafafa);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    margin-bottom: 20px;
    font-family: 'Segoe UI', sans-serif;
	animation: slideIn 0.5s ease-out;
}

.sunburst-breadcrumb span {
    background: white;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid #ccc;
    font-weight: 500;
    font-size: 13px;
    color: #444;
    transition: all 0.2s ease;
    position: relative;
}

.sunburst-breadcrumb span:hover {
    background: #900C3F; /* 🎯 Turuncu arka plan */
    color: white;
    border-color: #f57c00;
    box-shadow: 0 2px 8px rgba(245, 124, 0, 0.3);
    transform: translateY(-1px);
	 animation: pulse 0.4s ease-in-out;
}

.sunburst-breadcrumb span:not(:last-child)::after {
    content: "›";
    position: absolute;
    right: -10px;
    top: 50%;
    transform: translateY(-50%);
    color: #999;
    font-size: 16px;
    font-weight: normal;
}

/* 🌟 Pulse effect */
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.06); }
    100% { transform: scale(1); }
}


`).appendTo("head");


define(["jquery", 
    "text!./style.css", 
    "./d3.v3.min", 
    "./bower_components/QlikSenseD3Utils/senseD3utils",
    "./senseUtils"
], 
function ($, cssContent) {
    $("<style>").html(cssContent).appendTo("head");
    return {
        initialProperties: {
            version: 1.0,
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{ qWidth: 10, qHeight: 50 }]
            }
        },
        definition: {
            type: "items",
            component: "accordion",
            items: {
                dimensions: {
                    uses: "dimensions",
                    min: 2,
                    max: 5
                },
                measures: {
                    uses: "measures",
                    min: 1,
                    max: 2,
                    items: {
                        colorType: {
                            ref: "qDef.colorType",
                            label: "Color Format",
                            type: "string",
                            component: "dropdown",
                            options: [
                                { value: "cat20", label: "20 Categorical Colors" },
                                { value: "dimAndHex", label: "By Expression (Hex Values)" }
                            ]
                        },
                        color: {
                            ref: "qAttributeExpressions.0.qExpression",
                            label: "Hex Color/Expression",
                            type: "string",
                            expression: "optional",
                            defaultValue: "if(avg(Indicator)<=1,'#393b79',if(avg(Indicator)<=2,'#5254a3','#6b6ecf'))"
                        }
                    }
                },
                sorting: { uses: "sorting" },
                settings: { uses: "settings" },
                properties: {
                    component: "expandable-items",
                    label: "Properties",
                    items: {
                        dataHeader: {
                            type: "items",
                            label: "Data Format",
                            items: {
                                dataformat: {
                                    ref: "props.dataFormat",
                                    label: "Format of Data",
                                    type: "string",
                                    component: "dropdown",
                                    options: [
                                        { value: "multiDim", label: "Multiple Dimensions" },
                                        { value: "nested", label: "Two Dimensional Hierarchy" }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        snapshot: { canTakeSnapshot: true },
        paint: function ($element, layout) {
            senseUtils.pageExtensionData(this, $element, layout, drawBurst);
        },
        resize: function ($el, layout) {
            this.paint($el, layout);
        }
    };
});
