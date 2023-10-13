class TagChart {

    /**
     * Class constructor with initial configuration
     * @param _config
     * @param _dispatcher handling events across classes
     * @param _data
     */
    constructor(_config, _dispatcher, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 150,
            containerHeight: 625,
            tooltipPadding: 15,
            margin: {top: 25, right: 15, bottom: 20, left: 20}
        }
        this.data = _data;

        this.dispatcher = _dispatcher;
        this.activeTags = [];
        this.initVis();
    }

    /**
     * Create scales, axes, and append static elements
     */
    initVis() {
        let vis = this;

        vis.width = vis.config.containerWidth / 2.8 - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xScale = d3.scaleBand()
            .range([0, vis.width])
            .padding(0.1);

        vis.colorScale = d3.scaleOrdinal( ['#8EC6C5'] );

        vis.title = vis.chart.append('text')
            .attr('class', 'chart-title')
            .attr('x', vis.width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .text('Tags');


        vis.updateVis();
    }


    /**
     * Prepare data for rendering
     */
    updateVis() {
        let vis = this;

        // Count tag occurrences
        let tagCounts = {};
        vis.data.forEach(game => {
            game.tags.forEach(tag => {
                if (tagCounts[tag]) {
                    tagCounts[tag]++;
                } else {
                    tagCounts[tag] = 1;
                }
            });
        });

        // Convert to array and sort by count
        vis.tagData = Object.entries(tagCounts)
            .map(([tag, count]) => ({tag, count}))
            .sort((a, b) => b.count - a.count);

        // Limit to top 50 tags
        vis.tagData = vis.tagData.slice(0,50);

        // Calculate the total count of all tags
        vis.totalTags = vis.tagData.reduce((sum, tagObj) => sum + tagObj.count, 0);

        // Calculate the proportion of each tag
        vis.tagData.forEach(tagObj => {
            tagObj.proportion = tagObj.count / vis.totalTags;
        });


        // Remove existing labels
        vis.chart.selectAll('.tag-label').remove();

        // Update scales
        vis.yScale.domain([0, 1]);
        vis.xScale.domain(vis.tagData.map(d => d.tag));

        vis.renderVis();
    }


    /**
     * Bind data to visual elements and update axes
     */
    renderVis() {
        let vis = this;

        // mute unselected bars
        function updateBarFill() {
            bars.attr('fill', d => {
                if (vis.activeTags.length === 0 || vis.activeTags.includes(d.tag)) {
                    return vis.colorScale(d.tag);
                } else {
                    return '#ccc';
                }
            });
        }


        // Draw the bar chart
        let bars = vis.chart.selectAll('.bar')
            .data(vis.tagData);

        bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .merge(bars)
            .attr('x', 0)
            .attr('y', (d, i) => {
                // Bars are overlayed by having height up to the sum of larger proportions
                let sum = 0;
                for (let j = 0; j < i; j++) {
                    sum += vis.tagData[j].proportion;
                }
                return vis.yScale(1 - sum);
            })
            .attr('width', vis.width)
            .attr('height', d => vis.height * d.proportion)
            .attr('fill', d => vis.colorScale(d.tag))
            .call(updateBarFill)
            .attr('stroke', 'gray')
            .on('mouseover', (event, d) => {
                // Show the tooltip on mouseover
                d3.select('#tooltip')
                    .style('opacity', 1)
                    .html(d.tag + ": " + d.count + " games");
            })
            .on('mousemove', (event, d) => {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 20) + 'px');
            })
            .on('mouseout', (event, d) => {
                d3.select('#tooltip')
                    .style('opacity', 0);
            })
            .on('click', (event, d) => {
                // Toggle the tag's presence in the activeTags array
                if (vis.activeTags.includes(d.tag)) {
                    vis.activeTags = vis.activeTags.filter(t => t !== d.tag);
                } else {
                    vis.activeTags.push(d.tag);
                }

            // Update the bars selection
            bars = vis.chart.selectAll('.bar')
                .data(vis.tagData);

            // Update the fill attribute of the bars after modifying activeTags
            updateBarFill();

            // Notify other visualizations
            vis.dispatcher.call('tagSelected', null, vis.activeTags);
        });

        // Draw labels for large enough sections
        const labels = vis.chart.selectAll('.label')
            .data(vis.tagData);

        labels.enter()
            .append('text')
            .attr('class', 'tag-label')
            .merge(labels)
            .attr('x', vis.width)
            .attr('dx', '.2em')
            .attr('y', (d, i) => {
                let sum = 0;
                for (let j = 0; j < i; j++) {
                    sum += vis.tagData[j].proportion;
                }
                return vis.yScale(1 - sum - d.proportion / 2);
            })
            .attr('dy', '0.35em')
            .attr('text-anchor', 'start')
            .text(d => {
                // Set a threshold for the minimum area to show the label
                const minAreaThreshold = 15;
                if (vis.height * d.proportion >= minAreaThreshold) {
                    return d.tag;
                }
                return '';
            });

        bars.exit().remove();
        labels.exit().remove();
    }
}
