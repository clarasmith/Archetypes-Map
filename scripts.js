// Using the provided Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiY3dob25nIiwiYSI6ImNtNnozY2V1cDAwbTEybW9uNnI4dGV4eG4ifQ.tkb0d96wGhGW4-7Ds-iDCw';

const mapOptions = {
    container: 'map-container',
    center: [-98.5795, 39.8283], // center us
    zoom: 3.5, // zoom level to show most of the US
    style: 'mapbox://styles/mapbox/light-v11', // light base map 
};

const map = new mapboxgl.Map(mapOptions);

// Track the currently selected city and active filter
let selectedCityId = null;
let activeFilter = null;

// Map tooltips
const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

const cityColors = {
    'destination': {
        default: '#87aa4b', // green
        selected: '#66842c'
    },
    'opportunity': {
        default: '#786994', // purple 
        selected: '#534870'
    },
    'risk': {
        default: '#a5444d', // red
        selected: '#89303b'
    },
    'origin': {
        default: '#839093', // grey
        selected: '#6d6360'
    }
};

// Map archetype to full name
const archetypeNames = {
    'destination': 'Destination City',
    'opportunity': 'Opportunity City',
    'risk': 'City at Risk',
    'origin': 'Origin City'
};

function getCityColor(archetype, isSelected) {
    const lowerType = archetype.toLowerCase();

    if (cityColors[lowerType]) { //check for color for city type
        return isSelected ? cityColors[lowerType].selected : cityColors[lowerType].default;
    }

    // default colors in case no city archetype
    return isSelected ? '#ff7700' : '#3887be';
}

// Convert CSV data to GeoJSON
function csvToGeoJSON(csvData) {
    const features = csvData.filter(row => {
        // Filter out rows with invalid coordinates
        return row && row.longitude && row.latitude && 
               !isNaN(parseFloat(row.longitude)) && 
               !isNaN(parseFloat(row.latitude));
    }).map((row, index) => {
        return {
            type: 'Feature',
            id: index, // use index as feature ID
            properties: {
                name: row.clean_name || row.name || "Unknown",
                state: row.state || "Unknown",
                archetype: row.type && row.type.toLowerCase() || "unknown",
                type_name: row.type_name || row.type || "unknown", // Use type_name if available
                county: row.name_county || "Unknown",
                population: row.population || 0,
                median_income: row.median_income,
                median_home_value: row.median_home_value,
                median_age: row.median_age,
                vacancy_rate: row.vacancy_rate,
                climate_val: row.climate_val,
                climate_flag: row.climate_flag,
                growing_val: row.growing_val,
                growing_flag: row.growing_flag,
                type_ind: row.type_ind
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

// Load CSV using fetch and Papa Parse
async function loadCitiesData() {
    try {
        const response = await fetch('./data/city_and_archetype.csv');
        const csvText = await response.text();

        const results = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
        });

        // Check if data was parsed correctly
        if (results.data && results.data.length > 0) {
            const geojsonData = csvToGeoJSON(results.data);
            addCitiesToMap(geojsonData); // Add to map
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

// Format population numbers to be more readable (K for thousands, M for millions)
function formatPopulation(population) {
    if (!population) return 'N/A';
    
    if (population >= 1000000) {
        return (population / 1000000).toFixed(1) + 'M';
    } else if (population >= 1000) {
        return (population / 1000).toFixed(0) + 'K';
    } else {
        return population.toString();
    }
}

// Format vacancy rate as percentage
function formatVacancyRate(rate) {
    if (rate === null || rate === undefined) return 'N/A';
    return Math.round(rate * 100) + '%';
}

// Add legend with icons instead of color circles
function addLegend() {
    // Create legend container
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    
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
            title: 'Destination Cities:',
            description: 'Cities facing relatively low future climate risks that are currently seeing robust economic and demographic growth.',
            icon: './img/icons-02.png' 
        },
        {
            type: 'opportunity',
            title: 'Opportunity Cities:',
            description: 'Cities with low climate risk but long-term economic and population decline that could benefit from in-migration to revitalize neighborhoods.',
            icon: './img/icons-01.png'
        },
        {
            type: 'risk',
            title: 'Cities at Risk:',
            description: 'Cities with high climate risk that continue to grow rapidly, including cities facing increasingly extreme heat and coastal cities that face increasing flood risk.',
            icon: './img/icons-04.png'
        },
        {
            type: 'origin',
            title: 'Origin Cities:',
            description: 'Cities experiencing long-term decline in population and a relatively high climate risk. These cities are outside the scope of our project.',
            icon: './img/icons-03.png'
        }
    ];
    
    // Create legend items
    legendItems.forEach(item => {
        const itemContainer = document.createElement('div');
        itemContainer.style.marginBottom = '12px';
        itemContainer.style.display = 'flex';
        itemContainer.style.alignItems = 'flex-start';
        
        // Icon directly instead of color circle
        const icon = document.createElement('img');
        icon.src = item.icon;
        icon.alt = item.type + ' icon';
        icon.style.height = '16px';
        icon.style.width = 'auto';
        icon.style.marginRight = '8px';
        icon.style.marginTop = '3px';
        icon.style.flexShrink = '0';
        
        // Text container
        const textContainer = document.createElement('div');
        
        // Title text
        const titleText = document.createElement('strong');
        titleText.textContent = item.title + ' ';
        
        // Description
        const description = document.createElement('div');
        description.textContent = item.description;
        
        textContainer.appendChild(titleText);
        textContainer.appendChild(description);
        
        itemContainer.appendChild(icon);
        itemContainer.appendChild(textContainer);
        
        legend.appendChild(itemContainer);
    });
    
    // Add to map container
    document.getElementById('map-container').appendChild(legend);
}

// Create filter buttons in the legend
function addFilterButtons() {
    // Get or create the legend
    let legend = document.querySelector('.map-legend');
    if (!legend) {
        legend = document.createElement('div');
        legend.className = 'map-legend';
        document.getElementById('map-container').appendChild(legend);
    }
    
    // Create filter text
    const filterText = document.createElement('div');
    filterText.style.margin = '15px 0 8px 0';
    filterText.style.fontWeight = 'bold';
    filterText.textContent = 'Filter by city type:';
    legend.appendChild(filterText);
    
    // Create the filter container
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-buttons';
    
    const archetypes = [
        { id: 'destination', label: 'Destination' },
        { id: 'opportunity', label: 'Opportunity' },
        { id: 'risk', label: 'At Risk' },
        { id: 'origin', label: 'Origin' },
    ];
    
    // Add show all button first, more distinct
    const resetButton = document.createElement('button');
    resetButton.className = 'filter-button reset active'; // Active by default
    resetButton.textContent = 'All';
    resetButton.addEventListener('click', clearFilter);
    filterContainer.appendChild(resetButton);
    
    // Create buttons for each archetype
    archetypes.forEach(archetype => {
        const button = document.createElement('button');
        button.className = `filter-button ${archetype.id}`;
        button.textContent = archetype.label;
        button.dataset.filter = archetype.id;
        
        button.addEventListener('click', () => {
            if (activeFilter === archetype.id) {
                // Clicking active filter resets it
                clearFilter();
            } else {
                applyFilter(archetype.id);
            }
        });
        
        filterContainer.appendChild(button);
    });
    
    legend.appendChild(filterContainer);
}

// Apply filter to show only cities of selected archetype
function applyFilter(archetype) {
    // Remove active class from all buttons
    document.querySelectorAll('.filter-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to selected filter button
    const activeBtn = document.querySelector(`.filter-button[data-filter="${archetype}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Set the active filter
    activeFilter = archetype;
    
    // Apply filter to the map layer - check if map layer exists first
    if (map.getLayer('cities-points')) {
        map.setFilter('cities-points', ['==', ['get', 'archetype'], archetype]);
    }
}

// Clear filter to show all cities
function clearFilter() {
    // Remove active class from all buttons except the reset button
    document.querySelectorAll('.filter-button:not(.reset)').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active class to reset button
    const resetBtn = document.querySelector('.filter-button.reset');
    if (resetBtn) {
        resetBtn.classList.add('active');
    }
    
    // Clear the active filter
    activeFilter = null;
    
    // Remove the filter from the map layer - check if map layer exists first
    if (map.getLayer('cities-points')) {
        map.setFilter('cities-points', null);
    }
}

// Setup search functionality
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
                    selectCity(city);
                    
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

// Function to select a city (used by both search and click events)
function selectCity(city) {
    // Select the city
    selectedCityId = city.id;

    // Update city styling
    updateSelectedCityStyle();

    // Update sidebar
    displayCityInfo(city.properties);

    // Fly to the city
    map.flyTo({
        center: city.geometry.coordinates,
        zoom: 8,
        speed: 0.8
    });
}

// Update the style for the selected city
function updateSelectedCityStyle() {
    if (!map.getLayer('cities-points')) {
        return;
    }
    
    // Set a fixed larger radius for the selected city (not zoom-dependent)
    map.setPaintProperty('cities-points', 'circle-radius', [
        'case',
        ['==', ['id'], selectedCityId],
        12, // Selected city radius (fixed larger size)
        {
            'base': 1.5,
            'stops': [
                [3, 4.5],   // At zoom level 3, radius is 4.5px (1.5x larger)
                [6, 7.5],   // At zoom level 6, radius is 7.5px (1.5x larger)
                [10, 10.5]  // At zoom level 10, radius is 10.5px (1.5x larger)
            ]
        }
    ]);
    
    map.setPaintProperty('cities-points', 'circle-color', [
        'case',
        ['==', ['id'], selectedCityId],
        [
            'match',
            ['to-string', ['get', 'archetype']],
            'destination', cityColors.destination.selected,
            'risk', cityColors.risk.selected,
            'opportunity', cityColors.opportunity.selected,
            'origin', cityColors.origin.selected,
            '#ff7700'
        ],
        [
            'match',
            ['to-string', ['get', 'archetype']],
            'destination', cityColors.destination.default,
            'risk', cityColors.risk.default,
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
}

function addCitiesToMap(geojsonData) {
    // Check if source already exists
    if (map.getSource('us-cities')) {
        map.getSource('us-cities').setData(geojsonData);
        return;
    }
    
    // Add source for US cities
    map.addSource('us-cities', {
        type: 'geojson',
        data: geojsonData,
        generateId: true
    });
    
    // Add cities layer with zoom-dependent styling
    map.addLayer({
        id: 'cities-points',
        type: 'circle',
        source: 'us-cities',
        paint: {
            // Simple stops array for circle-radius with less dramatic change
            'circle-radius': {
                'base': 1.5,
                'stops': [
                    [3, 4.5],   // At zoom level 3, radius is 4.5px (1.5x larger)
                    [6, 7.5],   // At zoom level 6, radius is 7.5px (1.5x larger)
                    [10, 10.5]  // At zoom level 10, radius is 10.5px (1.5x larger)
                ]
            },
            'circle-color': [
                'case',
                ['==', ['id'], selectedCityId],
                [
                    'match',
                    ['to-string', ['get', 'archetype']],
                    'destination', cityColors.destination.selected,
                    'risk', cityColors.risk.selected,
                    'opportunity', cityColors.opportunity.selected,
                    'origin', cityColors.origin.selected,
                    '#ff7700' // default selected color
                ],
                [
                    'match',
                    ['to-string', ['get', 'archetype']],
                    'destination', cityColors.destination.default,
                    'risk', cityColors.risk.default,
                    'opportunity', cityColors.opportunity.default,
                    'origin', cityColors.origin.default,
                    '#3887be' // default general color
                ]
            ],
            'circle-opacity': 1,
            'circle-stroke-width': [
                'case',
                ['==', ['id'], selectedCityId],
                3, // selected city has thicker stroke
                1  // default stroke width
            ],
            'circle-stroke-color': '#ffffff'
        }
    });
    
    // Add hover effect with tooltip
    map.on('mouseenter', 'cities-points', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        
        if (e.features && e.features.length > 0) {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const name = e.features[0].properties.name;
            const state = e.features[0].properties.state;
            
            // Create tooltip content
            const tooltipContent = `${name}, ${state}`;
            
            // Ensure that if the map is zoomed out such that multiple
            // copies of the feature are visible, the popup appears
            // over the copy being pointed to.
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }
            
            // Show the tooltip
            popup.setLngLat(coordinates)
                .setHTML(tooltipContent)
                .addTo(map);
        }
    });
    
    map.on('mouseleave', 'cities-points', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    // Click interaction: show city details in the sidebar
    map.on('click', 'cities-points', (e) => {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            selectCity(feature);
        }
    });
}

// Display city information in the sidebar
function displayCityInfo(cityProps) {
    const cityInfoDiv = document.getElementById('city-info');
    
    // Get the full archetype name
    const archetypeName = cityProps.type_name || archetypeNames[cityProps.archetype] || cityProps.archetype;
    
    // Get the color for this archetype
    const archetypeColor = cityColors[cityProps.archetype]?.default || '#333';

    // City Best Practices by Archetype
    const bestPracticesByArchetype = {
        'risk': [
            "Make a climate migration plan.",
            "Right size real estate risk.",
            "Overhaul zoning comprehensively, focused on density and resilience.",
            "Improve climate resilience in civil infrastructure.",
            "Strengthen healthcare and EMS infrastructure."
        ],
        'destination': [
            "Make a climate migration plan.",
            "Expand inclusive, innovative outreach and public participation.",
            "Overhaul zoning comprehensively, focused on density and resilience.",
            "Create tax and subsidy programs for affordable, resilient housing development.",
            "Foster policies that facilitate community land ownership."
        ],
        'opportunity': [
            "Expand small business financial support.",
            "Encourage incentives for private sector inter-office transfers.",
            "Make a climate migration plan.",
            "Strengthen healthcare and EMS infrastructure.",
            "Expand bus transit."
        ],
        'origin': [] // No specific practices for this type
    };
    
    // Get best practices for this city type
    const bestPractices = bestPracticesByArchetype[cityProps.archetype] || [];
    
    // Basic city info
    let cityInfoHTML = `
        <h2>${cityProps.name}, ${cityProps.state}</h2>
        <div class="city-archetype" style="color: ${archetypeColor};">${archetypeName}</div>
        <div class="city-property"><span>Population:</span> ${formatPopulation(cityProps.population)}</div>
        <div class="city-property"><span>County:</span> ${cityProps.county || 'N/A'}</div>
        <div class="city-property"><span>Vacancy Rate:</span> ${formatVacancyRate(cityProps.vacancy_rate)}</div>
        <div class="city-property"><span>Median Income:</span> $${cityProps.median_income?.toLocaleString() || 'N/A'}</div>
        <div class="city-property"><span>Median Home Value:</span> $${cityProps.median_home_value?.toLocaleString() || 'N/A'}</div>
    `;
    
    // Add best practices section if available for this city type
    if (bestPractices.length > 0) {
        cityInfoHTML += `
            <div class="best-practices">
                <h3>Urgent priority actions for ${cityProps.name}:</h3>
                <ul>
                    ${bestPractices.map(practice => `<li>${practice}</li>`).join('')}
                </ul>
                <a href="https://drive.google.com/file/d/1B68MkBP_PyyLm_oDq9HBN__tvExSU_WO/view?usp=sharing" target="_blank">
                    See the full report and full list of best practices here
                </a>
            </div>
        `;
    }
    
    cityInfoDiv.innerHTML = cityInfoHTML;
}

// Add page title
function addPageTitle() {
    const title = document.createElement('div');
    title.className = 'page-title';
    title.textContent = 'Climate Migration Archetype Map';
    document.body.appendChild(title);
}

// Wait for map to be loaded before fetching data
map.on('load', () => {
    addPageTitle();
    
    // Small delay to ensure map is ready
    setTimeout(() => {
        loadCitiesData().then(() => {
            setupSearch();
            addLegend();
            addFilterButtons();
        });
    }, 100);
});