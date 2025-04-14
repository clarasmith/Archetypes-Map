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
        default: '#2e8b57', // green
        selected: '#1a5c38'  
    },
    'risk': {
        default: '#f58231', // org 
        selected: '#d62728'  
    },
    'opportunity': {
        default: '#4682b4', // blue
        selected: '#1e3c6e' 
    },
    'origin': {
        default: '#a9a9a9', // grey
        selected: '#2f2f2f'  
    }
};

function getCityColor(type, isSelected) {
    const lowerType = type.toLowerCase(); 
    
    if (cityColors[lowerType]) { //check for color for city type
        return isSelected ? cityColors[lowerType].selected : cityColors[lowerType].default;
    }
    
    // default colors in case no city type
    return isSelected ? '#ff7700' : '#3887be';
}

// convert CSV data to GeoJSON
function csvToGeoJSON(csvData) {
    const features = csvData.map((row, index) => {
        return {
            type: 'Feature',
            id: index, // use index as feature ID
            properties: {
                NAME_CITY: row.NAME_CITY,
                state: row.state,
                type: row.type
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
        
        const geojsonData = csvToGeoJSON(results.data);
        
        addCitiesToMap(geojsonData); // aaaaand add to map
    } catch (error) {
        console.error("Error loading cities data:", error);
    }
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
                    ['to-string', ['get', 'type']],
                    'destination', cityColors.destination.selected,
                    'risk', cityColors['risk'].selected,
                    'opportunity', cityColors.opportunity.selected,
                    'origin', cityColors.origin.selected,
                    '#ff7700' // default selected color
                ],
                [
                    'match',
                    ['to-string', ['get', 'type']],
                    'destination', cityColors.destination.default,
                    'city', cityColors['risk'].default,
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
                    ['to-string', ['get', 'type']],
                    'destination', cityColors.destination.selected,
                    'risk', cityColors['risk'].selected,
                    'opportunity', cityColors.opportunity.selected,
                    'origin', cityColors.origin.selected,
                    '#ff7700' // Default selected color
                ],
                [
                    'match',
                    ['to-string', ['get', 'type']],
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
        <h2>${cityProps.NAME_CITY}, ${cityProps.state}</h2>
        <div class="city-property"><span>Type:</span> ${cityProps.type}</div>
    `;
    
    // Add more city properties here eventually and add recs here too
}

// wait for map to be loaded before fetching data
map.on('load', () => {
    loadCitiesData();
});