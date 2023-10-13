class GenreBarChart {

    /**
     * Class constructor with initial configuration
     * @param _config
     * @param _dispatcher handling events across classes
     * @param _data
     */
    constructor(_config, _dispatcher, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 300,
            containerHeight: 300,
            tooltipPadding: 15,
            margin: {top: 25, right: 15, bottom: 10, left: 100} // Ant: from 15 -> 25
        }
        this.data = _data;
        this.subsetData = null;
        this.dispatcher = _dispatcher;
        this.activeBars = [];
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

        vis.yScale = d3.scaleBand()
            .range([0, vis.height])
            .padding(0.1);

        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        // 10 color range for 10 genres, taken from colorbrewer2.org
        vis.colorScale = genreColorScale;

        vis.title = vis.chart.append('text')
            .attr('class', 'chart-title')
            .attr('x', vis.width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .text('Pick your genre(s)');

        vis.updateVis();
    }


    /**
     * Prepare data for rendering
     */
    updateVis() {
        let vis = this;

        // Count genre occurrences
        let genreCounts = vis.getCounts(vis.data);

        // Convert to array and sort by count
        vis.genreData = Object.entries(genreCounts)
            .map(([genre, count]) => ({genre, count}))
            .sort((a, b) => b.count - a.count);

        vis.subsetGenreData = [];
        if (vis.subsetData !== null) {
            let subsetGenreCounts = vis.getCounts(vis.subsetData);
            vis.subsetGenreData = Object.entries(subsetGenreCounts)
                .map(([genre, count]) => ({genre, count}))
                .sort((a, b) => {
                    // Sort in same order as modeData
                    return vis.genreData.findIndex(c => c.genre === a.genre) - vis.genreData.findIndex(c => c.genre === b.genre);
                });
        }

        // Clean label overlap
        vis.chart.selectAll('.genre-label').remove();

        // Update scales
        vis.yScale.domain(vis.genreData.map(d => d.genre));
        vis.xScale.domain([0, d3.max(vis.genreData, d => d.count)]);

        vis.renderVis();
    }


    /**
     * Bind data to visual elements and update axes
     */
    renderVis() {
        let vis = this;

        // Draw the horizontal bars
        vis.chart.selectAll('.bar')
            .data(vis.genreData, d => d.genre)
            .join('rect')
            .attr('class', 'bar')
            .attr('y', d => vis.yScale(d.genre))
            .attr('height', vis.yScale.bandwidth())
            .attr('width', d => vis.xScale(d.count))
            .style('opacity', vis.subsetData === null ? 1 : .5)
            .attr('fill', d => {
                if (vis.activeBars.length === 0 || vis.activeBars.includes(d.genre)) {
                    return vis.colorScale(d.genre);
                } else {
                    return '#F1F1F1';
                }
            })
            .attr('stroke', 'gray')
            .on('mouseover', (event, d) => {
                // dispatch hover event for this genre
                vis.dispatcher.call('hoverGenre', event, d.genre);

                // display simple tooltip
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px')
                    .style('opacity', 1)
                    .text("Total: " + d.count + " " + d.genre.toLowerCase() + " games");
            })
            .on('mouseout', (event, d) => {
                // remove highlights
                vis.dispatcher.call('removeHighlight', event, d);

                // hide tooltip
                d3.select('#tooltip')
                    .style('opacity', 0);
            })
            .on('click', (event, d) => vis.updateSelection(event, d));

        // Draw subset bars if they exist
        vis.chart.selectAll('.sub-bars')
            .data(vis.subsetGenreData)
            .join('rect')
            .attr('class', 'sub-bars')
            .attr('y', d => vis.yScale(d.genre))
            .attr('height', vis.yScale.bandwidth())
            .attr('width', d => vis.xScale(d.count))
            .attr('fill', d => {
                if (vis.activeBars.length === 0 || vis.activeBars.includes(d.genre)) {
                    return vis.colorScale(d.genre);
                } else {
                    return '#F1F1F1';
                }
            })
            .attr('stroke', 'gray')
            .on('mouseover', (event, d) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px')
                    .style('opacity', 1)
                    .text("Remaining: " + d.count + " " + d.genre.toLowerCase() +  " games");
            })
            .on('mouseout', () => {
                d3.select('#tooltip')
                    .style('opacity', 0);
            })
            .on('click', (event, d) => vis.updateSelection(event, d));

        // Draw labels for each genre
        const labels = vis.chart.selectAll('.label')
            .data(vis.genreData);

        labels.enter()
            .append('text')
            .attr('class', 'genre-label')
            .merge(labels)
            .attr('x', -5)
            .attr('y', d => vis.yScale(d.genre) + vis.yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .text(d => d.genre);

        labels.exit().remove();
    }

    /**
     * Update the selection of genres
     * @param event user interaction event that triggered this update
     * @param d mode to add or remove from active set of genres
     */
    updateSelection(event, d) {
        let vis = this;
        // remove highlight
        vis.dispatcher.call('removeHighlight', event, d);

        // update selected genres
        const isActive = vis.activeBars.includes(d.genre);

        if (isActive) {
            vis.activeBars = vis.activeBars.filter(a => a !== d.genre);
        } else {
            vis.activeBars.push(d.genre);
        }

        vis.updateVis();

        vis.dispatcher.call('genreSelected', event, vis.activeBars);
    }

    /**
     * Get counts for each genre from the data. A game may have multiple genres and
     * Contribute to multiple counts.
     * @param data list of games to collect genre counts from
     * @returns {{}} genre counts
     */
    getCounts(data) {
        let genreCounts = {};
        data.forEach(game => {
            game.genres.forEach(genre => {
                if (genreCounts[genre]) {
                    genreCounts[genre]++;
                } else {
                    genreCounts[genre] = 1;
                }
            });
        });
        return genreCounts;
    }
}
