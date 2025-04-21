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