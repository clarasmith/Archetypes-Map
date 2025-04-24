//mapboxgl.accessToken = 'pk.eyJ1IjoiY2xhcmFzbWl0aCIsImEiOiJjbTkxejBsZG4wMGI4MnJvbGs0cWZuMm9sIn0.tbCUFAe - HudP7ZV9OujUPQ'
// mapboxgl.accessToken = PUT TOKEN HERE
mapboxgl.accessToken = 'pk.eyJ1IjoiY3dob25nIiwiYSI6ImNtNnozY2V1cDAwbTEybW9uNnI4dGV4eG4ifQ.tkb0d96wGhGW4-7Ds-iDCw';


const mapOptions = {
    container: 'map-container',
    center: [-98.5795, 39.8283], // center us
    zoom: 3.5, // zoom level to show most of the US
    style: 'mapbox://styles/mapbox/light-v11', // light base map 
};

const map = new mapboxgl.Map(mapOptions);

// Track the currently selected city
let selectedCityId = null;

const cityColors = {
    'destination': {
        default: '#13AAAA', // blue
        selected: '#0C6868'
    },
    'risk': {
        default: '#BA3250', // red 
        selected: '#832232'
    },
    'opportunity': {
        default: '#EC9A29', // orange
        selected: '#9B611C'
    },
    'origin': {
        default: '#839093', // grey
        selected: '#202F33'
    }
};

function getCityColor(archetype, isSelected) {
    const lowerType = archetype.toLowerCase();

    if (cityColors[lowerType]) { //check for color for city type
        return isSelected ? cityColors[lowerType].selected : cityColors[lowerType].default;
    }

    // default colors in case no city archetype
    return isSelected ? '#ff7700' : '#3887be';
}

// convert CSV data to GeoJSON
function csvToGeoJSON(csvData) {
    const features = csvData.map((row, index) => {
        return {
            type: 'Feature',
            id: index, // use index as feature ID
            properties: {
                name: row["name.x"],
                state: row.state,
                archetype: row.type || "unknown",
                county: row.name_county,
                population: row.population,
                median_income: row.median_income,
                median_home_value: row.median_home_value,
                median_age: row.median_age,
                vacancy_rate: row.vacancy_rate,
                climate_val: row.climate_val,
                climate_flag: row.climate_flag,
                growing_val: row.growing_val,
                growing_flag: row.growing_flag,
                type_ind: row.type_ind
                // add other cols here eventually
            },
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
            }
        };
    });

    return {
        type: 'FeatureCollection',
        features: features
    };
}

// load CSV using fetch and Papa Parse
async function loadCitiesData() {
    try {
        const response = await fetch('./data/city_and_archetype.csv');
        const csvText = await response.text();

        const results = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });
        console.log("Parsed CSV columns:", Object.keys(results.data[0]));
        //debugging line


        const geojsonData = csvToGeoJSON(results.data);

        addCitiesToMap(geojsonData); // aaaaand add to map
    } catch (error) {
        console.error("Error loading cities data:", error);
    }
}


// LEGEND!
function addLegend() {
    // Create legend container
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.style.position = 'absolute';
    legend.style.bottom = '30px';
    legend.style.left = '10px';
    legend.style.backgroundColor = 'white';
    legend.style.padding = '10px';
    legend.style.borderRadius = '4px';
    legend.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
    legend.style.maxWidth = '300px';
    legend.style.fontSize = '12px';
    legend.style.lineHeight = '1.5';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'City Types';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    legend.appendChild(title);
    
    // Define legend items
    const legendItems = [
        {
            type: 'destination',
            color: cityColors.destination.default,
            title: 'Destination Cities:',
            description: 'Cities facing relatively low future climate risks that are currently seeing robust economic and demographic growth.',
            icon: './img/icons-01.png' 
        },
        {
            type: 'opportunity',
            color: cityColors.opportunity.default,
            title: 'Opportunity Cities:',
            description: 'Cities with low climate risk but long-term economic and population decline that could benefit from in-migration to revitalize neighborhoods.',
            icon: './img/icons-02.png'
        },
        {
            type: 'risk',
            color: cityColors.risk.default,
            title: 'Cities at Risk:',
            description: 'Cities with high climate risk that continue to grow rapidly, including cities facing increasingly extreme heat and coastal cities that face increasing flood risk.',
            icon: './img/icons-03.png'
        },
        {
            type: 'origin',
            color: cityColors.origin.default,
            title: 'Origin Cities:',
            description: 'Cities experiencing long-term decline in population and a relatively high climate risk. These cities are outside the scope of our project.',
            icon: './img/icons-04.png'
        }
    ];
    
    // Create legend items
    legendItems.forEach(item => {
        const itemContainer = document.createElement('div');
        itemContainer.style.marginBottom = '12px';
        itemContainer.style.display = 'flex';
        itemContainer.style.alignItems = 'flex-start';
        
        // Color circle
        const colorCircle = document.createElement('div');
        colorCircle.style.width = '12px';
        colorCircle.style.height = '12px';
        colorCircle.style.borderRadius = '50%';
        colorCircle.style.backgroundColor = item.color;
        colorCircle.style.marginRight = '8px';
        colorCircle.style.marginTop = '3px';
        colorCircle.style.flexShrink = '0';
        
        // Text container
        const textContainer = document.createElement('div');
        
        // Title with icon
        const titleContainer = document.createElement('div');
        titleContainer.style.display = 'flex';
        titleContainer.style.alignItems = 'center';
        titleContainer.style.marginBottom = '2px';
        
        const titleText = document.createElement('strong');
        titleText.textContent = item.title + ' ';
        titleText.style.marginRight = '4px';
        
        const icon = document.createElement('img');
        icon.src = item.icon;
        icon.alt = item.type + ' icon';
        icon.style.height = '16px';
        icon.style.width = 'auto';
        
        titleContainer.appendChild(titleText);
        titleContainer.appendChild(icon);
        
        // Description
        const description = document.createElement('div');
        description.textContent = item.description;
        
        textContainer.appendChild(titleContainer);
        textContainer.appendChild(description);
        
        itemContainer.appendChild(colorCircle);
        itemContainer.appendChild(textContainer);
        
        legend.appendChild(itemContainer);
    });
    
    // Add toggle functionality
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Hide Legend';
    toggleButton.style.padding = '4px 8px';
    toggleButton.style.fontSize = '11px';
    toggleButton.style.backgroundColor = '#f5f5f5';
    toggleButton.style.border = '1px solid #ddd';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.marginTop = '5px';
    
    let isLegendVisible = true;
    const legendContent = document.createElement('div');
    legendContent.id = 'legend-content';
    
    // Move all children except title to legend content
    while (legend.children.length > 1) {
        legendContent.appendChild(legend.children[1]);
    }
    
    legend.appendChild(legendContent);
    legend.appendChild(toggleButton);
    
    toggleButton.addEventListener('click', () => {
        isLegendVisible = !isLegendVisible;
        legendContent.style.display = isLegendVisible ? 'block' : 'none';
        toggleButton.textContent = isLegendVisible ? 'Hide Legend' : 'Show Legend';
    });
    
    // Add to map container
    document.getElementById('map-container').appendChild(legend);
}

// Create search functionality
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let cityData = [];

    // Get all city data for search
    if (map.getSource('us-cities')) {
        cityData = map.getSource('us-cities')._data.features;
    }

    searchInput.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();

        // Clear results if empty
        if (searchTerm.length < 2) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }

        // Filter cities based on search term
        const matches = cityData.filter(city =>
            city.properties.name.toLowerCase().includes(searchTerm) ||
            `${city.properties.name}, ${city.properties.state}`.toLowerCase().includes(searchTerm)
        );

        // Display results
        searchResults.innerHTML = '';
        if (matches.length > 0) {
            matches.slice(0, 5).forEach(city => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.textContent = `${city.properties.name}, ${city.properties.state}`;

                resultItem.addEventListener('click', () => {
                    // Select the city
                    selectedCityId = city.id;

                    // Update city styling
                    map.setPaintProperty('cities-points', 'circle-radius', [
                        'case',
                        ['==', ['id'], selectedCityId],
                        9,
                        6
                    ]);

                    map.setPaintProperty('cities-points', 'circle-color', [
                        'case',
                        ['==', ['id'], selectedCityId],
                        [
                            'match',
                            ['to-string', ['get', 'archetype']],
                            'destination', cityColors.destination.selected,
                            'risk', cityColors['risk'].selected,
                            'opportunity', cityColors.opportunity.selected,
                            'origin', cityColors.origin.selected,
                            '#ff7700'
                        ],
                        [
                            'match',
                            ['to-string', ['get', 'archetype']],
                            'destination', cityColors.destination.default,
                            'risk', cityColors['risk'].default,
                            'opportunity', cityColors.opportunity.default,
                            'origin', cityColors.origin.default,
                            '#3887be'
                        ]
                    ]);

                    map.setPaintProperty('cities-points', 'circle-stroke-width', [
                        'case',
                        ['==', ['id'], selectedCityId],
                        3,
                        1
                    ]);

                    // Update sidebar
                    displayCityInfo(city.properties);

                    // Fly to the city
                    map.flyTo({
                        center: city.geometry.coordinates,
                        zoom: 8,
                        speed: 0.8
                    });

                    // Clear search
                    searchInput.value = '';
                    searchResults.innerHTML = '';
                    searchResults.style.display = 'none';
                });

                searchResults.appendChild(resultItem);
            });

            searchResults.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="no-results">No cities found</div>';
            searchResults.style.display = 'block';
        }
    });

    // Hide results when clicking outside
    document.addEventListener('click', function (e) {
        if (e.target !== searchInput && e.target !== searchResults) {
            searchResults.style.display = 'none';
        }
    });
}

function addCitiesToMap(geojsonData) {
    map.addSource('us-cities', { //add source for US cities
        type: 'geojson',
        data: geojsonData,
        generateId: true
    });

    map.addLayer({ // and add cities (AS POINTS FOR NOW) with color based on archetype
        id: 'cities-points',
        type: 'circle',
        source: 'us-cities',
        paint: {
            'circle-radius': [
                'case',
                ['==', ['id'], selectedCityId],
                9, // select city radius is larger by 1.5
                6  // default radius
            ],
            'circle-color': [
                'case',
                ['==', ['id'], selectedCityId],
                [
                    'match',
                    ['to-string', ['get', 'archetype']],
                    'destination', cityColors.destination.selected,
                    'risk', cityColors['risk'].selected,
                    'opportunity', cityColors.opportunity.selected,
                    'origin', cityColors.origin.selected,
                    '#ff7700' // default selected color
                ],
                [
                    'match',
                    ['to-string', ['get', 'archetype']],
                    'destination', cityColors.destination.default,
                    'risk', cityColors['risk'].default,
                    'opportunity', cityColors.opportunity.default,
                    'origin', cityColors.origin.default,
                    '#3887be' // default general color
                ]
            ],
            'circle-opacity': 0.9,
            'circle-stroke-width': [
                'case',
                ['==', ['id'], selectedCityId],
                3, // selected city has thicker stroke x3
                1  // default stroke width
            ],
            'circle-stroke-color': '#ffffff'
        }
    });

    // click interaction: show city details in the sidebar
    map.on('click', 'cities-points', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const cityProps = feature.properties;

            // updated the selected city ID
            selectedCityId = feature.id;

            // styling for the selected city (this is handled by the paint property expressions)
            map.setPaintProperty('cities-points', 'circle-radius', [
                'case',
                ['==', ['id'], selectedCityId],
                9, //  radius for selected city
                6  // default radius
            ]);

            // trigger a repaint to apply the new color settings
            map.setPaintProperty('cities-points', 'circle-color', [
                'case',
                ['==', ['id'], selectedCityId],
                [
                    'match',
                    ['to-string', ['get', 'archetype']],
                    'destination', cityColors.destination.selected,
                    'risk', cityColors['risk'].selected,
                    'opportunity', cityColors.opportunity.selected,
                    'origin', cityColors.origin.selected,
                    '#ff7700' // Default selected color
                ],
                [
                    'match',
                    ['to-string', ['get', 'archetype']],
                    'destination', cityColors.destination.default,
                    'risk', cityColors['risk'].default,
                    'opportunity', cityColors.opportunity.default,
                    'origin', cityColors.origin.default,
                    '#3887be' // Default color
                ]
            ]);

            map.setPaintProperty('cities-points', 'circle-stroke-width', [
                'case',
                ['==', ['id'], selectedCityId],
                3, // thicker stroke for selected city
                1  // default stroke width
            ]);

            // Update sidebar with city information
            displayCityInfo(cityProps);

            // Animation! Fly to the selected city
            map.flyTo({
                center: feature.geometry.coordinates,
                zoom: 8,
                speed: 0.8
            });
        }
    });

    // Cursor to pointer on city hover
    map.on('mouseenter', 'cities-points', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'cities-points', () => {
        map.getCanvas().style.cursor = '';
    });
}


// Display city information in the sidebar
function displayCityInfo(cityProps) {
    const cityInfoDiv = document.getElementById('city-info');

    cityInfoDiv.innerHTML = `
        <h2>${cityProps.name}, ${cityProps.state}</h2>
        <div class="city-property"><span>Archetype:</span> ${cityProps.archetype}</div>
        <div class="city-property"><span>County:</span> ${cityProps.county}</div>
        <div class="city-property"><span>Population:</span> ${cityProps.population.toLocaleString()}</div>
        <div class="city-property"><span>Median Income:</span> $${cityProps.median_income?.toLocaleString()}</div>
        <div class="city-property"><span>Median Home Value:</span> $${cityProps.median_home_value?.toLocaleString()}</div>
       <!-- <div class="city-property"><span>Climate Risk Value:</span> ${cityProps.climate_val?.toFixed(2)}</div> -->
       <!-- <div class="city-property"><span>Growth Value:</span> ${cityProps.growing_val?.toFixed(2)}</div> -->
    `;

    // Add more city properties here eventually and add recs here too
}

// wait for map to be loaded before fetching data
map.on('load', () => {
    loadCitiesData().then(() => {
        setupSearch();
        addLegend(); 
    });
});


// Make loadCitiesData return a promise
async function loadCitiesData() {
    try {
        const response = await fetch('./data/city_and_archetype.csv');
        const csvText = await response.text();

        const results = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        const geojsonData = csvToGeoJSON(results.data);

        addCitiesToMap(geojsonData);
        return true; // Return success
    } catch (error) {
        console.error("Error loading cities data:", error);
        return false;
    }
}