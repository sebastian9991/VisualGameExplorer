function calculateSimilarity(data, item) {

    let similarity = [];

    data.forEach((d) => {
        if (d.id !== item.id) {
            let sim = {};
            // Calculate each difference
            sim.diff = [];
            sim.diff.push(d.priceQuantile - item.priceQuantile);
            sim.diff.push(jaccardSimilarity(d.mode, item.mode));
            sim.diff.push(jaccardSimilarity(d.genres, item.genres));

            // Tag list can be emptied out by filtering
            if (d.tags.length > 0 && item.tags.length > 0) {
                sim.diff.push(jaccardSimilarity(d.tags, item.tags));
            }

            sim.diff.push(d.standardizedDiff - item.standardizedDiff);
            sim.diff.push(d.logDuration - item.logDuration);
            sim.diff.push(d.standardRating - item.standardRating);
            sim.id = d.id;

            // Combine into numerical evaluation using RMSE
            sim.rmse = 1 - RMSE(sim.diff);
            similarity.push(sim);
        }
    });


    // Select the 9 most similar titles (higher is closer)
    similarity.sort((a,b) => b.rmse - a.rmse);
    let topNine = similarity.slice(0,9);
    return topNine.map(d => d.id);
}

function RMSE(diffs) {
    let sqErr = 0;
    diffs.forEach(d => sqErr += Math.pow(d, 2));
    return Math.sqrt( sqErr / diffs.length);
}

function jaccardSimilarity(a, b) {
    let s1 = new Set(a);
    let s2 = new Set(b);

    let union = new Set(s1);
    s2.forEach(d => union.add(d));

    let intersection = new Set();
    s1.forEach(d => {
        if (s2.has(d)) {
            intersection.add(d);
        }
    });

    return intersection.size / union.size;
}

class ParallelChart {

    // Heavy influence from https://d3-graph-gallery.com/graph/parallel_basic.html
    /**
     * Class constructor with initial configuration
     * @param _config
     * @param _dispatcher handling events across classes
     * @param _data
     */
    constructor(_config, _dispatcher, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 600, //TODO: determine these values
            containerHeight: 320,
            tooltipPadding: 15,
            margin: {top: 30, right: 0, bottom: 20, left: 25}
        }
        this.data = _data;
        this.dispatcher = _dispatcher;
        this.DATE = "date";
        this.DIFFICULTY = "difficulty";
        this.POSITION = "position";
        this.PRICE = "price";
        this.RATING = "rating";

        this.sort = this.RATING;
        this.selectedTitle = null;
        this.genreHovered = null;
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

        vis.linearDimensions = [vis.PRICE, "duration", "rating"]; // TODO: add difficulty, date
        vis.allDimensions = [vis.POSITION, "rating", vis.PRICE, "duration", vis.DIFFICULTY, vis.DATE];

        // scale to align the y axis
        vis.xScale = d3.scalePoint()
            .range([50, vis.width+ 75])
            .padding(1)
            .domain(vis.allDimensions);

        vis.yScales = {};
        vis.yAxes = {};
        vis.yAxisGroup = {};

        // create scales for each of the linear dimensions
        vis.linearDimensions.forEach(dim => {
            vis.yScales[dim] = d3.scaleLinear()
                .range([vis.height, 0]);

            vis.yAxes[dim] = d3.axisLeft(vis.yScales[dim])
                .ticks(4);

            vis.yAxisGroup[dim] = vis.chart.append('g')
                .attr('class', 'axis y-axis')
                .attr('transform', `translate(${vis.xScale(dim)},0)`);

        });

        vis.yAxes[vis.PRICE].tickFormat(d => `\$${d/100.0}`);

        // Create a time scale for the date attribute
        vis.yScales[vis.DATE] = d3.scaleTime()
            .range([vis.height, 0]);

        vis.yAxes[vis.DATE] = d3.axisLeft(vis.yScales[vis.DATE])
            .ticks(d3.utcYear)
            .tickFormat(d3.utcFormat('%Y'));

        vis.yAxisGroup[vis.DATE] = vis.chart.append('g')
            .attr('class', 'axis y-axis')
            .attr('transform', `translate(${vis.xScale(vis.DATE)},0)`);

        // create an ordinal scale for the difficulty attribute
        vis.yScales[vis.DIFFICULTY] = d3.scalePoint()
            .range([vis.height, 0])
            .domain(difficultyList);

        vis.yAxes[vis.DIFFICULTY] = d3.axisLeft(vis.yScales[vis.DIFFICULTY])
            .tickFormat((label,i) => {
                return i % 2 !== 0 ? " ": label;
            });

        vis.yAxisGroup[vis.DIFFICULTY] = vis.chart.append('g')
            .attr('class', 'axis y-axis')
            .attr('transform', `translate(${vis.xScale(vis.DIFFICULTY)},0)`);

        // create an additional position axis to have a clear entry point for each
        // game to start their line
        vis.yScales[vis.POSITION] = d3.scalePoint()
            .range([0, vis.height])
            .domain([1,2,3,4,5,6,7,8,9,10]);

        vis.yAxes[vis.POSITION] = d3.axisLeft(vis.yScales[vis.POSITION]);

        vis.yAxisGroup[vis.POSITION] = vis.chart.append('g')
            .attr('class', 'axis y-axis position-axis')
            .attr('transform', `translate(${vis.xScale(vis.POSITION)},0)`);

        vis.colorScale = genreColorScale;

        // Axis titles
        vis.allDimensions.forEach(dim => {
            if (dim !== vis.POSITION) {
                vis.svg.append("text")
                    .style("text-anchor", "start")
                    .attr("class", "parallel-axis-title")
                    .attr("y", vis.config.margin.top - 10)
                    .attr('x', vis.xScale(dim))
                    .text(dim.charAt(0).toUpperCase() + dim.slice(1))
                    .style("fill", "black");
            }
        });

        vis.updateVis();
    }

    /**
     * Create the path a game travels between axis
     * @param d the game to make a path for
     * @returns {*} a d3 path
     */
    path(d) {
        let vis = this;
        return d3.line()(
            vis.allDimensions.map(
                function(p) {
                    return [vis.xScale(p), vis.yScales[p](d[p])];
                }
            )
        );
    }

    /**
     * Prepare data for rendering
     */
    updateVis() {
        let vis = this;

        // reverse sort the data by rating
        vis.data.sort((a,b) => b.rating - a.rating);
        vis.topTen = vis.data.slice(0,10);

        if (vis.selectedTitle !== null) {
            let item = vis.data.find(d => d.id === vis.selectedTitle);
            vis.topTen = [item];

            let similarGames = calculateSimilarity(vis.data, item);

            similarGames.forEach(s => {
                let sGame = vis.data.find(d => d.id === s);
                if (sGame !== undefined) {
                    vis.topTen.push(sGame);
                }
            });
        }

        // Re-sort the top 10 by the user's selection
        // If difficulty is selected, we need to sort based on difficultyNum
        if (vis.sort === vis.DIFFICULTY) {
            vis.topTen.sort((a,b) => b.difficultyNum - a.difficultyNum);
        } else {
            vis.topTen.sort((a,b) => b[vis.sort] - a[vis.sort]);
        }

        // Assign position numbers for each game to order the hidden position axis
        vis.topTen.forEach((d,i) => d[vis.POSITION] = i + 1);

        // Update the domains based on the subset of the data
        vis.linearDimensions.forEach(dim => {
            vis.yScales[dim].domain(d3.extent(vis.topTen, d => d[dim]));
        });

        vis.yScales[vis.DATE].domain(d3.extent(vis.topTen, d => d[vis.DATE]));

        vis.renderVis();
    }

    /**
     * Bind data to visual elements and update axes
     */
    renderVis() {
        let vis = this;
        vis.CHAR_LIMIT = 25;

        // create the paths
        const lines = vis.chart.selectAll('.parallel-line')
            .data(vis.topTen)
            .join("path")
            .attr('class', 'parallel-line')
            .classed('highlighted', d => {
                return vis.selectedGameIds.includes(d.id) || vis.selectedTitle === d.id;
            })
            .style('stroke', d => {
                if (vis.genreHovered !== null && vis.selectedGameIds.includes(d.id)) {
                    return vis.colorScale(vis.genreHovered);
                }
                return 'steelblue';
            })
            .style('fill', 'none');

        // add transition to show data change
        lines.transition()
            .duration(500)
            .attr('d', d => vis.path(d));

        // add hover response to lines for highlighting points in other charts
        lines.on('mouseover', (event,d) => {
            vis.dispatcher.call('hoverParallel', event, d);
        })
            .on('mouseleave', (event,d) => {
                vis.dispatcher.call('removeHighlight', event, d);
            });

        // add game title labels to beginning of lines
        vis.chart.selectAll('.parallel-text')
            .data(vis.topTen)
            .join('text')
            .attr('class', 'parallel-text')
            .classed('selected', d => vis.selectedTitle === d.id)
            .attr('y', d => vis.yScales[vis.POSITION](d[vis.POSITION]))
            .attr('x', vis.xScale(vis.POSITION) - 10)
            .attr("text-anchor", "end")
            .style("alignment-baseline", "middle")
            .text(d => d.name)
            .call(wrap, 140, 20)
            .on('mouseover', (event,d) => {
                vis.dispatcher.call('hoverParallel', event, d);
            })
            .on('mouseleave', (event,d) => {

                vis.dispatcher.call('removeHighlight', event, d);
            })
            .on('click', (event, d) => {
                window.open(d.url, '_blank').focus();
            });

        // call each y-axis
        vis.linearDimensions.forEach(dim => {
            vis.yAxisGroup[dim].call(vis.yAxes[dim]);
        });

        vis.yAxisGroup[vis.DATE].call(vis.yAxes[vis.DATE]);
        vis.yAxisGroup[vis.DIFFICULTY].call(vis.yAxes[vis.DIFFICULTY]);
        vis.yAxisGroup[vis.POSITION].call(vis.yAxes[vis.POSITION]);
    }

    /**
     * Change the sort of the top 10 elements to the new value of the dropdown
     * @param sort attribute to sort by
     */
    updateSort(sort) {
        let vis = this;
        vis.sort = sort;
        vis.updateVis();
    }
}
