const parseTime = d3.timeParse("%Y-%m-%d");
const difficultyList = ["Simple", "Simple-Easy", "Easy", "Easy-Just Right", "Just Right", "Just Right-Tough",
    "Tough", "Tough-Unforgiving", "Unforgiving"];
const genreColorScale = d3.scaleOrdinal()
    .range(['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd']);

let parallelChart, clusterChart, genres, genreChart, modeChart, singleBar, data;

let dispatcher = d3.dispatch('modeSelected', 'hoverParallel', 'tagSelected', 'removeHighlight', 'genreSelected', 'hoverGenre', 'widgetFilter', 'reset', 'showTitleComparison');

searchFunctionality();
d3.json('data/project_data.json').then(_data => {

    // List of all possible genres
    genres = new Set();

    // process data
    data = _data;
    let filterData = _data;

    // for similarity comparison
    let priceQuantile = d3.scaleQuantile()
        .domain(d3.extent(data, d=>d.price))
        .range([0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1.0]);

    data.forEach(d => {
        d.date = parseTime(d.date);
        d.difficultyNum = difficultyToNum(d.difficulty);

        // Process the mode for display
        d.mode = processMode(d.mode);

        // Process the genres for display
        d.genres = processGenres(d.genres);

        d.genres.forEach(d => genres.add(d));

        // Process the tags for display
        d.tags = processTags(d.tags);

        addSimilarityValues(d, priceQuantile);
    });

    // instantiate charts
    clusterChart = new ClusterChart({
        parentElement: '#cluster-chart',
    }, dispatcher, data);

    singleBar = new TagChart({
        parentElement: '#single-bar-chart',
    }, dispatcher, data);

     genreChart = new GenreBarChart({
        parentElement: '#genre-chart',
    }, dispatcher, data);

     modeChart = new ModeBarChart({
        parentElement: '#mode-chart',
    }, dispatcher, data);

    parallelChart = new ParallelChart({
        parentElement: '#parallel-chart',
    }, dispatcher, data);

    // object to keep track of active filters
    let filters = {
        tags: [],
        genres: [],
        modes: []
    }

    // update selected modes
    dispatcher.on('modeSelected.main', selectedModes => {
        filters.modes = selectedModes;
        const filteredData = updateDataBasedOnAllFilters(filterData, filters);
        singleBar.data = filteredData;
        singleBar.updateVis();

        if (selectedModes.length === 0) {
            genreChart.subsetData = null;
        } else {
            genreChart.subsetData = filteredData;
        }
        genreChart.updateVis();

        clusterChart.data = filteredData;
        clusterChart.updateVis();

        parallelChart.selectedTitle = null;
        parallelChart.data = filteredData;
        parallelChart.updateVis();

    });

    // update selected tags
    dispatcher.on('tagSelected.main', selectedTags => {
        filters.tags = selectedTags;
        const wholeBarData = updateDataBasedOnAllFilters(filterData, filters, true, true);
        const filteredData = updateDataBasedOnAllFilters(filterData, filters);
        clusterChart.data = filteredData;//clusterChart.data.filter(d => filteredData.includes(d));
        clusterChart.updateVis();

        genreChart.data = wholeBarData;//genreChart.data.filter(d => filteredData.includes(d));
        genreChart.subsetData = filteredData;
        genreChart.updateVis();

        modeChart.data = wholeBarData;//modeChart.data.filter(d => filteredData.includes(d));
        modeChart.subsetData = filteredData;
        modeChart.updateVis();

        parallelChart.selectedTitle = null;
        parallelChart.data = filteredData;
        parallelChart.updateVis();
    });

    // update highlighted point based on parallel chart hover
    dispatcher.on('hoverParallel.main', highlightedPoint => {
        clusterChart.selectedGameIds.push(highlightedPoint.id);
        clusterChart.updateVis();
    });

    // update highlighted points based on hovered genre
    dispatcher.on('hoverGenre.main', genre => {
        let matchingData = data.filter(game => game.genres.includes(genre));
        let ids = matchingData.map(d => d.id);
        clusterChart.selectedGameIds = clusterChart.selectedGameIds.concat(ids);
        clusterChart.genreHovered = genre;
        parallelChart.selectedGameIds = parallelChart.selectedGameIds.concat(ids);
        parallelChart.genreHovered = genre;
        clusterChart.updateVis();
        parallelChart.updateVis();
    });

    // remove all highlights
    dispatcher.on('removeHighlight.main', d => {
        clusterChart.selectedGameIds = [];
        parallelChart.selectedGameIds = [];
        clusterChart.updateVis();
        parallelChart.updateVis();
    });

    // include specific title in parallel chart
    dispatcher.on('showTitleComparison.main', title => {
        parallelChart.selectedTitle = title.id;
        parallelChart.updateVis();
    });

    // update charts based on selected genres
    dispatcher.on('genreSelected.main', selectedGenres => {
       filters.genres = selectedGenres;
       const filteredData = updateDataBasedOnAllFilters(filterData, filters);

        clusterChart.data = filteredData;
        clusterChart.updateVis();

        singleBar.data = filteredData;
        singleBar.updateVis();

        parallelChart.selectedTitle = null;
        parallelChart.data = filteredData;
        parallelChart.updateVis();

        if (selectedGenres.length === 0) {
            modeChart.subsetData = null;
        } else {
            modeChart.subsetData = filteredData;
        }

        modeChart.updateVis();
    });

    //Update charts through the data selected from the widgets
    dispatcher.on('widgetFilter', filteredData => {
        //Pass filtered data:
        genreChart.data = filteredData;
        genreChart.updateVis();

        modeChart.data = filteredData;
        modeChart.updateVis();

        singleBar.data = filteredData;
        singleBar.updateVis();

        parallelChart.data = filteredData;
        parallelChart.updateVis();

        // update subset data as well?
        filterData = filteredData;
    });

    //Reset call
    dispatcher.on('reset', resetData => {
        //Pass reset data
        genreChart.data = resetData;
        genreChart.activeBars = [];
        genreChart.subsetData = null;
        genreChart.updateVis();

        modeChart.data = resetData;
        modeChart.activeModes = [];
        modeChart.subsetData = null;
        modeChart.updateVis();

        singleBar.data = resetData;
        singleBar.activeTags = [];
        singleBar.updateVis();

        parallelChart.data = resetData;
        parallelChart.selectedTitle = null;
        parallelChart.updateVis();

        filterData = resetData;
    });


});

/**
 * Combine the filters from the three charts to get the subset of data with all filters applied
 * @param data the data to filter
 * @param filters filters to apply to the data
 * @returns {*} filtered data
 */
function updateDataBasedOnAllFilters(data, filters, skipMode, skipGenre) {
    let filteredData = data;
    if (filters.tags.length > 0) {
        filteredData = filteredData.filter(game => game.tags.some(tag => filters.tags.includes(tag)));
    }
    if (filters.modes.length > 0 && !skipMode) {
        filteredData = filteredData.filter(game => game.mode.some(mode => filters.modes.includes(mode)));
    }
    if (filters.genres.length > 0 && !skipGenre) {
        filteredData = filteredData.filter(game => game.genres.some(genre => filters.genres.includes(genre)));
    }

    return filteredData;
}

/**
 * Convert difficulty measurement to numerical value from 1-5
 */
function difficultyToNum(diff) {
    return .5 * difficultyList.indexOf(diff) + 1;
}

/**
 * Remove extra modes that are not relevant to player count and location
 * Combine like modes
 * @param modes modes of a game
 * @returns {*} filtered list
 */
function processMode(modes) {
    // filter out modes that are not related to player interaction
    modes = modes.filter(d => isRelevantMode(d));

    // combine like modes
    let splitScreen = modes.filter(d => d.startsWith('Shared/Split Screen'));
    if (splitScreen.length > 0) {
        modes = modes.filter(d => !d.startsWith('Shared/Split Screen'));
        modes.push('Shared/Split Screen');
    }
    return modes;
}

/**
 * Remove extra genres that are not really genres
 * Combine like genres
 * @param genres modes of a game
 * @returns {*} filtered list
 */
function processGenres(genres) {
    // filter out modes that are not related to player interaction
    return genres.filter(d => isRelevantGenre(d));
}

/**
 * Return true if mode is in relevant list of modes
 * @param mode mode to check
 * @returns {boolean} false if mode is irrelevant
 */
function isRelevantMode(mode) {
    const relevant = ['Single-player', 'Multi-player', 'Remote Play Together', 'PvP', 'Online PvP', 'Co-op',
        'Online Co-op', 'Shared/Split Screen Co-op', 'Shared/Split Screen', 'Cross-Platform Multiplayer',
        'Shared/Split Screen PvP'];
    return relevant.includes(mode);
}

/**
 * Return true if genre is not in irrelevant list of genres
 * @param genre genre to check
 * @returns {boolean} false if genre is irrelevant
 */
function isRelevantGenre(genre) {
    const irrelevant = ['Nudity', 'Sexual Content', 'Early Access', 'Massively Multiplayer', 'Free to Play', 'Gore'];
    return !irrelevant.includes(genre);
}

/**
 * Remove extra tags that are already accounted for in genre or mode data
 * @param tags
 * @returns {*} tags filtered to only necessary values
 */
function processTags(tags) {
    // filter out modes that are not related to player interaction
    return tags.filter(d => isRelevantTag(d));
}

/**
 * Return true if tag is in relevant list of tags
 * @param tag tag to check
 * @returns {boolean} false if tag is irrelevant
 */
function isRelevantTag(tag) {
    const irrelevant = ['Singleplayer', 'Co-op', 'Multiplayer', "Online Co-Op", 'Local Co-op', 'Local Multiplayer', 'PvP',
                        'Split Screen', 'Asynchronous Multiplayer'];
    return !irrelevant.includes(tag) && !genres.has(tag);
}

/**
 * Process change in value of the dropdown for the parallel axis chart
 */
function updateParallelSort() {
    const selection = document.getElementById("axis-selector").value;
    parallelChart.updateSort(selection);
}

function addSimilarityValues(d, priceQuantile) {
    // Manual similarity calculation
    // https://developers.google.com/machine-learning/clustering/similarity/manual-similarity#:~:text=To%20calculate%20the%20similarity%20between,the%20difference%20between%20their%20sizes.
    // price, mode, genres, tags, difficultyNum, duration, rating

    // price - numeric, poisson, use quantiles
    d.priceQuantile = priceQuantile(d.price);

    // mode, genre, tags, multivalent categorical, use Jaccard similarity

    // difficultyNum - numeric, normal, use Gaussian
    //d.standardizedDiff = (d.difficultyNum - mean)/standardDev;
    d.standardizedDiff = d.difficultyNum / 5;

    // duration - numeric, exponential, use log10 (chosen through visual inspection), then standardize to [0,1]
    d.logDuration = Math.log10(d.duration)/1648;

    // rating - numeric, slight left skew but normal enough based on amount of data,
    // in this case preserve scale distance with simple [0,1] conversion through max
    d.standardRating = d.rating/100;
}

/**
 * Minorly tweaked from https://stackoverflow.com/questions/24784302/wrapping-text-in-d3
 * Used to wrap the text if it is longer than the given width
 * @param text text to wrap
 * @param width width of line before wrapping
 * @param offset rough number of characters in a line (to center align text based on line count)
 */
function wrap(text, width, offset) {
    text.each(function () {
        let text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            x = text.attr("x"),
            y = text.attr("y"),
            dy = d3.sum(words, d => d.length) < offset ? .35: -.25, // set the offset based on estimated number of lines by length proxy
            tspan = text.text(null)
                .append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em");
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan")
                    .attr("x", x)
                    .attr("y", y)
                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                    .text(word);
            }
        }
    });

}

function selectListElement(element) {
    let selectedUserInput = element.textContent;
    const searchInput = document.querySelector(".searchInput");
    searchInput.querySelector("input").value = selectedUserInput;

    searchInput.querySelector(".resultBox").innerHTML = '';

    dispatcher.call('reset', null, data);
    let id = data.find(d => d.name === selectedUserInput).id;

    parallelChart.selectedTitle = id;
    parallelChart.updateVis();

    clusterChart.selectedGameIds.push(id);
    clusterChart.updateVis();
}

function searchFunctionality() {
    //Implemented with guidance from: https://codepen.io/mey_mnry/pen/QWqPvox
    const searchInput = document.querySelector(".searchInput");
    const input = searchInput.querySelector("input");
    const resultBox = searchInput.querySelector(".resultBox");

    input.onkeyup = (e) => {
        let userInput = e.target.value;
        let emptyArray = [];
        const names = clusterChart.data.map(d => d.name);
        if(userInput) {
           emptyArray = names.filter((d) => {
               return d.toString().toLowerCase().startsWith(userInput.toLocaleLowerCase());
           });
            emptyArray = emptyArray.map((data)=>{
                // passing return data inside li tag
                return data = '<li>'+ data +'</li>';
            });
            searchInput.classList.add("active"); //show autocomplete box
            showSuggestions(emptyArray);

            let list = resultBox.querySelectorAll("li");

            for(let i = 0; i < list.length; i ++) {
                list[i].setAttribute("class", "listElement");
                list[i].setAttribute("onclick", "selectListElement(this)");
            }

        } else {
            searchInput.classList.remove("active");
        }

    }

    function showSuggestions(list){
        let listData;
        if(!list.length){
            //userData = input.value;
            listData = '<li>'+ userInput +'</li>';
        }else{
            listData = list.join('');
        }
        resultBox.innerHTML = listData;
    }
}
