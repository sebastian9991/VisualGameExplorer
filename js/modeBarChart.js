class ModeBarChart {

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
            margin: {top: 25, right: 15, bottom: 10, left: 100}
        }
        this.data = _data;
        this.subsetData = null;
        this.dispatcher = _dispatcher;
        this.activeModes = [];
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

        vis.colorScale = d3.scaleOrdinal()
            .domain(['modes'])
            .range(['#C7CEEA']);

        vis.updateVis();
    }


    /**
     * Prepare data for rendering
     */
    updateVis() {
        let vis = this;

        // Count mode occurrences
        let modeCounts = vis.getCounts(vis.data);

        // Convert to array and sort by count
        vis.modeData = Object.entries(modeCounts)
            .map(([mode, count]) => ({mode, count}))
            .sort((a, b) => b.count - a.count);

        vis.subsetModeData = [];
        if (vis.subsetData !== null) {
            let subsetModeCounts = vis.getCounts(vis.subsetData);
            vis.subsetModeData = Object.entries(subsetModeCounts)
                .map(([mode, count]) => ({mode, count}))
                .sort((a, b) => {
                    // Sort in same order as modeData
                    return vis.modeData.findIndex(c => c.mode === a.mode) - vis.modeData.findIndex(c => c.mode === b.mode);
                });
        }

        // Update scales
        vis.yScale.domain(vis.modeData.map(d => d.mode));
        vis.xScale.domain([0, d3.max(vis.modeData, d => d.count)]);

        // Remove existing labels
        vis.chart.selectAll('.mode-label').remove();


        vis.title = vis.chart.append('text')
            .attr('class', 'chart-title')
            .attr('x', vis.width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .text('Choose gameplay');

        vis.renderVis();
    }

    /**
     * Get counts for each mode from the data. A game may have multiple modes and
     * Contribute to multiple counts.
     * @param data list of games to collect mode counts from
     * @returns {{}} mode counts
     */
    getCounts(data) {
        let vis = this;
        let modeCounts = {};
        data.forEach(game => {
            game.mode.forEach(mode => {
                if (modeCounts[mode]) {
                    modeCounts[mode]++;
                } else {
                    modeCounts[mode] = 1;
                }
            });
        });
        return modeCounts;
    }

    /**
     * Bind data to visual elements and update axes
     */
    renderVis() {
        let vis = this;

        // Draw the horizontal bars
        let bars = vis.chart.selectAll('.bar')
            .data(vis.modeData);

        function updateBarFill() {
            bars.attr('fill', d => {
                if (vis.activeModes.length === 0) {
                    return vis.colorScale('modes');
                } else {
                    return vis.activeModes.includes(d.mode) ? '#C7CEEA' : '#ccc';
                }
            });
        }


        // Enter new bars and update the selection
        const enteredBars = bars.enter()
            .append('rect')
            .attr('class', 'bar');

        bars = enteredBars.merge(bars);

        // Set attributes for all bars (including the newly entered ones)
        bars.attr('y', d => vis.yScale(d.mode))
            .attr('height', vis.yScale.bandwidth())
            .attr('width', d => vis.xScale(d.count))
            .call(updateBarFill) // apply fill attribute on initial render
            .style('opacity', vis.subsetData === null ? 1 : .5)
            .on('mouseover', (event, d) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px')
                    .style('opacity', 1)
                    .text("Total: " + d.count + " " + d.mode.toLowerCase()  + " games");
            })
            .on('mouseout', () => {
                d3.select('#tooltip')
                    .style('opacity', 0);
            })
            .on('click', function (event, d) {
                vis.updateSelection(event, d);
            });

        // Draw subset bars if they exist
        vis.chart.selectAll('.sub-bars')
            .data(vis.subsetModeData)
            .join('rect')
            .attr('class', 'sub-bars')
            .attr('y', d => vis.yScale(d.mode))
            .attr('height', vis.yScale.bandwidth())
            .attr('width', d => vis.xScale(d.count))
            .attr('fill', d => (vis.activeModes.length === 0 || vis.activeModes.includes(d.mode)) ? '#C7CEEA' : '#ccc')
            .on('mouseover', (event, d) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY + 10) + 'px')
                    .style('opacity', 1)
                    .text("Remaining: " + d.count + " " + d.mode.toLowerCase() + " games" );
            })
            .on('mouseout', () => {
                d3.select('#tooltip')
                    .style('opacity', 0);
            })
            .on('click', (event, d) => vis.updateSelection(event, d));


        // Draw labels for each mode
        const labels = vis.chart.selectAll('.label')
            .data(vis.modeData);

        let modes = vis.modeData.map(d => d.mode);

        labels.enter()
            .append('text')
            .attr('class', 'mode-label')
            .merge(labels)
            .attr('x', -5)
            .attr('y', d => vis.yScale(d.mode) + vis.yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .text(d => d.mode)
            .call(wrap, 90, 15);

        bars.exit().remove();
        labels.exit().remove();
    }

    /**
     * Update the selection of modes
     * @param event user interaction event that triggered this update
     * @param d mode to add or remove from active set of modes
     */
    updateSelection(event, d) {
        let vis = this;
        const isActive = vis.activeModes.includes(d.mode);

        // Toggle the mode in the activeModes array
        if (isActive) {
            vis.activeModes = vis.activeModes.filter(a => a !== d.mode);
        } else {
            vis.activeModes.push(d.mode);
        }

        vis.updateVis();

        // Notify other visualizations
        vis.dispatcher.call('modeSelected', event, vis.activeModes);
    }

}
