class ClusterChart {

    /**
     * Class constructor with initial configuration
     * @param _config
     * @param _dispatcher handling events across classes
     * @param _data
     */
    constructor(_config, _dispatcher, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 620,
            containerHeight: 630,
            tooltipPadding: 15,
            sliderWidth: 70,
            sliderHeight: 20,
            sliderMargin: {top: 5, right: 5, bottom: 5, left: 5},
            margin: {top: 70, right: 140, bottom: 50, left: 50} // top from 60 -> 80 to make room for titles
        }
        this.data = _data;
        this.data_constant = _data; //Would be nice to make this immutable
        this.dispatcher = _dispatcher;
        this.selectedBoxes = [];
        this.genreHovered = null;

        this.SLIDER_SPACING = 40;
        this.WIDGET_SHIFT = 90;
        this.selectedGameIds = [];
        this.initVis();
    }

    /**
     * Create scales, axes, and append static elements
     */
    initVis() {
        let vis = this;

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        //Initialize scales, axes, static elements, etc.
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([0, vis.height]);

        vis.xAxis = d3.axisBottom(vis.xScale)
            .ticks(6) //Change this value?
            .tickFormat(d => `\$${d / 100.0}`);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6);

        //Axis Groups:
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x axis')
            .attr('transform', `translate(${0}, ${vis.height})`);

        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y axis');

        //TODO:Scale Titles:

        vis.title = vis.chart.append('text')
            .attr('class', 'chart-title')
            .attr('x', vis.width / 2)
            .attr('y', -55)
            .attr('text-anchor', 'middle')
            .text('Rating by Price Breakdown');


        vis.yAxisLabel = vis.chart.append('text')
            .attr('class', 'axis-y-text')
            .attr('transform', `translate(${-25},${-20})rotate(0)`)
            .text('Rating');

        vis.xAxisLabel = vis.chart.append('text')
            .attr('class', 'axis-x-text')
            .attr('transform', `translate(${vis.width / 2}, ${vis.height + 40})`)
            .text('Price');


        /**
         * Path for brush handle design
         * @param d handle to draw
         * @returns {string} d3 path as a string
         */
        let brushResizePath = function(d) {
            let e = +(d.type == "e"),
                x = e ? 1 : -1,
                y = vis.heightSlider / 2;
            return "M" + (.5 * x) + "," + y + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6) + "V" + (2 * y - 6) +
                "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y) + "Z" + "M" + (2.5 * x) + "," + (y + 8) + "V" + (2 * y - 8) +
                "M" + (4.5 * x) + "," + (y + 8) + "V" + (2 * y - 8);
        }

        vis.widgetSlidersTypes = ['Year', 'Price', 'Rating', 'Difficulty', 'Time'];

        //Sets for each component:
        vis.sliderScales = {};
        vis.sliderGroups = {};
        vis.LabelLSliders = {};
        vis.LabelRSliders = {};
        vis.sliderTitles = {};
        vis.brushes = {};
        vis.gBrushes = {};
        vis.starting_ranges = {};

        //Starting ranges defaulted:
        vis.resetStartingRanges();

        vis.widthSlider = vis.config.sliderWidth - vis.config.sliderMargin.left - vis.config.sliderMargin.right;
        vis.heightSlider = vis.config.sliderHeight - vis.config.sliderMargin.top - vis.config.sliderMargin.bottom;

        vis.sliderScales['Year'] = d3.scaleLinear()
            .range([0, vis.widthSlider])
            .domain(vis.starting_ranges['Year']);

        vis.sliderScales['Price'] = d3.scaleLinear()
            .range([0, vis.widthSlider])
            .domain(vis.starting_ranges['Price']);

        vis.sliderScales['Rating'] = d3.scaleLinear()
            .range([0, vis.widthSlider])
            .domain(vis.starting_ranges['Rating']);

        vis.sliderScales['Difficulty'] = d3.scaleLinear()
            .range([0, vis.widthSlider])
            .domain(vis.starting_ranges['Difficulty']);

        vis.sliderScales['Time'] = d3.scaleLinear()
            .range([0, vis.widthSlider])
            .domain(vis.starting_ranges['Time']);

        // Add titles, left and right labels, and brushes to sliders
        vis.widgetSlidersTypes.forEach((type, index) => {
            let spacing = vis.heightSlider + vis.SLIDER_SPACING*(index);
            vis.sliderGroups[type] = vis.svg.append('g')
                .attr('transform', `translate(${vis.width + vis.WIDGET_SHIFT},${spacing + 50})`); // Ant: from 30 -> 50 to make room for titles


            vis.LabelLSliders[type] = vis.sliderGroups[type].append('text')
                .attr('id', 'labelLeft')
                .attr('x', vis.width - vis.widthSlider - vis.config.sliderMargin.left)
                .attr('y', 15);

            vis.LabelRSliders[type] = vis.sliderGroups[type].append('text')
                .attr('id', 'labelRight')
                .attr('x', vis.width + vis.config.sliderMargin.right)
                .attr('y', 15);

            vis.sliderTitles[type] = vis.sliderGroups[type].append('text')
                .attr('id', 'sliderTitle')
                .attr('x', vis.widthSlider / 2)
                .attr('y', -2)
                .text(type);

            vis.brushes[type] = d3.brushX()
                .extent([[0,0], [vis.widthSlider, vis.heightSlider]])
                .on('brush', function({selection}) {
                    let s = selection;
                    // update and move labels
                    vis.LabelLSliders[type].attr('x', s[0])
                        .text(d => {
                            if (type === 'Price') {
                                return `\$${Math.round(vis.sliderScales[type].invert(s[0])/100.0)}`;
                            }
                            return Math.round(vis.sliderScales[type].invert(s[0]));
                        });
                    vis.LabelRSliders[type].attr('x', s[1])
                        .text(d => {
                            if (type === 'Price') {
                                return `\$${Math.round(vis.sliderScales[type].invert(s[1])/100.0)}`;
                            }
                            return Math.round(vis.sliderScales[type].invert(s[1]))
                        });
                    // move brush handles
                    handle.attr("display", null).attr("transform", function(d, i) { return "translate(" + [ s[i], - vis.heightSlider / 4] + ")"; });
                }).on('end', function (event) {
                    //Dispatch call:
                    if(!event.sourceEvent) return;
                    let s = event.selection;
                    let range = [vis.sliderScales[type].invert(s[0]), vis.sliderScales[type].invert(s[1])];
                    vis.filterDataSlider(type, range);

                });

            vis.gBrushes[type] = vis.sliderGroups[type].append('g')
                .attr('class', 'brush')
                .call(vis.brushes[type]);

            // add brush handles (from https://bl.ocks.org/Fil/2d43867ba1f36a05459c7113c7f6f98a)
            let handle = vis.gBrushes[type].selectAll(".handle--custom")
                .data([{type: "w"}, {type: "e"}])
                .enter().append("path")
                .attr("class", "handle--custom")
                .attr("stroke", "#000")
                .attr("fill", '#eee')
                .attr("cursor", "ew-resize")
                .attr("d", brushResizePath);
        });

        // Add legend for selecting operating system
        const legendSpacing = 30;
        const legendData = [
            'WIN',
            'MAC',
            'LINUX'
        ]
        vis.legend = vis.svg.append('g')
            .attr('class', 'legend-element')
            .attr('transform', `translate(${vis.width + vis.WIDGET_SHIFT}, ${vis.heightSlider + vis.SLIDER_SPACING*6})`);

        const legendBoxes = vis.legend.selectAll('rect')
            .data(legendData)
            .enter()
            .append('rect')
            .attr('class', 'legend-boxes')
            .attr('width', 20)
            .attr('height', 20)
            .attr('x', -15)
            .attr('y', (d, i) => i*legendSpacing - 15 + 25) // Ant: shifted down by 25 to make room for title
            .attr('stroke', 'black')
            .attr('fill', 'white')
            .on('click', function(event, d) {
                const isActive = vis.selectedBoxes.includes(convertOSNameToData(d));
                if(isActive) {
                    vis.selectedBoxes = vis.selectedBoxes.filter(f => f !== convertOSNameToData(d));
                } else {
                    vis.selectedBoxes.push(convertOSNameToData(d));
                }
                d3.select(this).classed('legend-boxes-active', !isActive);
                vis.filterDataSlider();
            });

        vis.legend.selectAll('text')
            .data(legendData)
            .enter()
            .append('text')
            .attr('x', -15)
            .attr('dx', '1.5em')
            .attr('y', (d,i) => i*legendSpacing + 25) // Ant: shifted down by 20 to make space for title
            .attr('text-anchor', 'right')
            .text(d => {
                if (d === 'WIN') {
                    return 'Windows';
                } else if (d === 'MAC') {
                    return 'Mac';
                } else {
                    return 'Linux';
                }
            });

        // Reset button resets all sliders and filters to their default values
        vis.resetButton = vis.svg.append('g')
            .attr('class', 'reset-button')
            .attr('transform', `translate(${vis.width + vis.WIDGET_SHIFT}, ${vis.heightSlider + vis.SLIDER_SPACING*6 + legendSpacing*3 + 20})`) // Ant+20
            .on('click', function(event) {
                vis.resetData();
            });

        vis.resetButton.append('rect')
            .attr('width', 60)
            .attr('height', 30)
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('stroke', 'black')
            .attr('fill', 'white');

        vis.resetButton.append('text')
            .attr('x', 30)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .text('Reset');

        // Widget panel background
        vis.chart.append('rect')
            .attr('class', 'background widget-outline')
            .attr('width', 120)
            .attr('height', 10*vis.SLIDER_SPACING)
            .attr('ry', 10)
            .attr('rx', 10)
            .attr('fill', '#F1F1F1')
            .attr('transform', `translate(${vis.width + 11}, ${-vis.SLIDER_SPACING - 10})`);


        vis.setYear = vis.data_constant;
        vis.setRating = vis.data_constant;
        vis.setTime = vis.data_constant;
        vis.setPrice = vis.data_constant;
        vis.setDifficulty = vis.data_constant;

        /**
         * Simple method to convert from display name LINUX to LNX
         * @param d OSName
         * @returns {*|string} OSName or LNX if LINUX is provided
         */
        function convertOSNameToData(d) {
            if(d === 'LINUX') {
                return 'LNX'
            }
            return d;
        }

        vis.updateVis();
    }

    /**
     * Prepare data for rendering
     */
    updateVis() {
        let vis = this;

        //Conditioning on the data size for <= 500 items (Subject to change with cluster zoom):
        if(vis.data.length >= 500) {
            vis.data.sort(function(a,b) {
                return b.rating - a.rating;
            })
            vis.top500 = vis.data.slice(0,500);
        } else {
            vis.top500 = vis.data;
        }
        vis.xScale.domain(d3.extent(vis.top500, d => d.price));
        vis.yScale.domain([d3.max(vis.top500, d => d.rating), d3.min(vis.top500, d => d.rating)]);
        vis.renderVis();
    }

    /**
     * Bind data to visual elements and update axes
     */
    renderVis() {
        let vis = this;

     const points = vis.chart.selectAll('.point')
            .data(vis.top500)
            .join('circle')
            .attr('class', 'point')
            .classed(returnClassByHoveredGenre(vis.genreHovered), d => vis.selectedGameIds.includes(d.id));

            points.attr('r', 3.5)
                .transition()
                .duration(500)
                .attr('cx', d => vis.xScale(d.price))
                .attr('cy', d => vis.yScale(d.rating));


            points.on('mouseover', (event, d) => {

                // change color of current point to green
                // d3.select(event.target)
                //     .style('fill', 'darkgreen')
                //     .style('stroke', 'black')
                //     .style('stroke-width', '2px')
                //     .attr('r', 8);

                // highlight similar games
                let similarGames = calculateSimilarity(vis.data, d);
                vis.selectedGameIds = similarGames;
                vis.updateVis();

                // tooltip to display pertinent game information
                d3.select('#tooltip')
                    .style('opacity', 1)
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('top', (event.pageY - 100 + vis.config.tooltipPadding) + 'px')
                    .html(`<div class = "tooltip-label">${d.name} </div>
                        <div> <img src=${d.image} alt="Image of Game" width="auto" height="100"></div>
                        <div> Runs on ${d.os.join(', ')} </div>
                            <div>
                                <ul>
                                    <li>Year of Release: ${d.date.getFullYear()}</li>
                                        <li>Price: \$${Math.round(d.price / 100.0)}</li>
                                            <li>Rating: ${Math.round(d.rating)} </li>
                                                <li>Difficulty: ${d.difficulty} </li>
                                                    <li>Time to Complete: ${d.duration}hrs </li>
                                                    </ul>
                                                        <div class="similar-games">Green highlights similar games.</div>
                                                        </div>
                                                        
                                                        <div class="add-to-top10">Click on this game to add it</div>
                                                        <div class="add-to-top10"> to the "Top 10 games" chart &rightarrow;</div>
 
`);
            })
            .on('mouseout', (event, d) => {
                // remove highlight

                // setTimeout(() => {
                //     vis.dispatcher.call('removeHighlight', event, d);
                // }, 5000);

                d3.select('#tooltip')
                    .style('opacity', 0);
            })
            .on('click', (event, d) => {
                vis.dispatcher.call('showTitleComparison', event, d);
            });

        //Call axes and remove unwanted ticks/paths:
        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);
        vis.widgetSlidersTypes.forEach(type => {
            vis.gBrushes[type].call(vis.brushes[type].move, vis.starting_ranges[type].map(vis.sliderScales[type]));
        });

        /**
         * Method to return the correct css class based on hovered genre
         * @param genre
         */
        function returnClassByHoveredGenre(genre) {
            vis.genreHovered = [];
            if(genre === 'Indie') {
                return 'cluster-highlighted-indie';
            } else if(genre === 'Action') {
                return 'cluster-highlighted-action';
            } else if(genre === 'Adventure'){
                return 'cluster-highlighted-adventure';
            } else if(genre === 'RPG') {
                return 'cluster-highlighted-rpg';
            } else if(genre === 'Strategy') {
                return 'cluster-highlighted-strategy';
            } else if(genre === 'Casual') {
                return 'cluster-highlighted-casual';
            } else if(genre === 'Simulation') {
                return 'cluster-highlighted-simulation';
            } else if(genre === 'Racing') {
                return 'cluster-highlighted-racing';
            } else if(genre === 'Sports') {
                return 'cluster-highlighted-sports';
            } else if(genre === 'Violent') {
                return 'cluster-highlighted-violent';
            } else {
                return 'cluster-highlighted';
            }

        }
    }

    /**
     * Filter the clusterChart data according to the sliders/legends
     */
    filterDataSlider(type_chosen, range) {
        //Assume that range[0] is the left slider, and range[1] is the right slider
        let vis = this;
        let data_write = vis.data_constant;

        if(type_chosen === 'Year') {
            vis.setYear = data_write.filter(d => d.date.getFullYear() >= range[0] && d.date.getFullYear() <= range[1]);
            vis.starting_ranges['Year'] = [range[0], range[1]];
        } else if(type_chosen === 'Price') {
            vis.setPrice = data_write.filter(d => d.price >= range[0] && d.price <= range[1]);
            vis.starting_ranges['Price'] = [range[0], range[1]];
        } else if(type_chosen === 'Rating') {
            vis.setRating = data_write.filter(d => d.rating >= range[0] && d.rating <= range[1]);
            vis.starting_ranges['Rating'] = [range[0], range[1]];
        } else if(type_chosen === 'Difficulty') {
            vis.setDifficulty = data_write.filter(d => d.difficultyNum >= range[0] && d.difficultyNum <= range[1]);
            vis.starting_ranges['Difficulty'] = [range[0], range[1]];
        } else if(type_chosen === 'Time') {
            vis.setTime = data_write.filter(d => d.duration >= range[0] && d.duration <= range[1]);
            vis.starting_ranges['Time'] = [range[0], range[1]];
        }

        // We treat each data array variable as a set and intersect them to gain the final data set
        // NOTE: This method would be O(n^5)! Not particularly efficient, but seems ok for this dataset.
        // (Should be changed if too elaborate)
        vis.filteredSliderData = vis.setYear.filter(d => {
            return vis.setPrice.some(e => e.id === d.id)
            && vis.setRating.some(e => e.id === d.id)
            && vis.setDifficulty.some(e => e.id === d.id)
            && vis.setTime.some(e => e.id === d.id);
        });

        // get selected boxes from legend
        if(vis.selectedBoxes.length === 0) {
            vis.data = vis.filteredSliderData;
        } else {
            vis.legendData = data_write.filter(d => vis.selectedBoxes.some(e => d.os.includes(e)));
            vis.data = vis.filteredSliderData.filter( d => {
                return vis.legendData.some(e => e.id === d.id);
            })
        }
        vis.dispatcher.call('widgetFilter', event, vis.data);
        vis.updateVis();
    }

    /**
     * Reset the data and filters to starting values
     */
    resetData() {
        let vis = this;
        vis.data = vis.data_constant;

        vis.resetStartingRanges();

        vis.selectedBoxes = [];
        d3.selectAll('.legend-boxes').classed('legend-boxes-active', false);

        vis.dispatcher.call('reset', event, vis.data);
        vis.updateVis();
    }

    /**
     * Set starting ranges for the sliders
     */
    resetStartingRanges() {
        let vis = this;
        vis.starting_ranges['Year'] = [1997, 2022];
        vis.starting_ranges['Price'] = d3.extent(vis.data_constant, d => d.price);
        vis.starting_ranges['Rating'] = [0, 100];
        vis.starting_ranges['Difficulty'] = [1, 5];
        vis.starting_ranges['Time'] = d3.extent(vis.data_constant, d => d.duration);
    }
}
