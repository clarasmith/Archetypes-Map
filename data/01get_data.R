library(tidyverse)
library(tidycensus)
library(janitor)
library(scales)
library(fs)
library(lubridate)
library(ggplot2)
library(svglite)
library(tigris)
library(sf)
library(readxl)


setwd("/Users/clara/Documents/NYU/FA24/Capstone/Archetypes Map/data")


vars_2021 <- c(
  population = "B01003_001",
  employed = "B23025_004",
  total_housing = "B25002_001",
  vacant_housing = "B25002_003",
  median_income = "B19013_001",
  median_home_value = "B25077_001",
  median_age = "B01002_001"
)


vars_2010 <- c(
  population_2010 = "B01003_001",
  employed_2010 = "B23025_004")

#import data
acs5_2021 <- get_acs(
  geography = "place",
  variables = vars_2021,
  year = 2023,
  survey = "acs5"
) %>%
  select(GEOID, NAME, variable, estimate) %>%
  pivot_wider(names_from = variable, values_from = estimate) %>%
  mutate(year = 2021) %>% 
  clean_names()

acs5_2010 <- get_acs(
  geography = "place",
  variables = vars_2010,
  year = 2012, #2008-2012 average is 2010
  survey = "acs5"
) %>%
  select(GEOID, NAME, variable, estimate) %>%
  pivot_wider(names_from = variable, values_from = estimate) %>%
  mutate(year = 2010) %>% 
  clean_names()

state_fips <- tibble(
  state = c(state.abb, "DC"),
  state_fips = c(
    "01", "02", "04", "05", "06", "08", "09", "10", "12", "13",
    "15", "16", "17", "18", "19", "20", "21", "22", "23", "24",
    "25", "26", "27", "28", "29", "30", "31", "32", "33", "34",
    "35", "36", "37", "38", "39", "40", "41", "42", "44", "45",
    "46", "47", "48", "49", "50", "51", "53", "54", "55", "56",
    "11"
  )
)

places_sf <- places(cb = TRUE, year = 2023) %>% clean_names()

# join datasets
combined_city_data <- acs5_2021 %>%
  #inner_join(decennial_2010 %>% select(geoid, population_2010), by = "geoid") %>%
  inner_join(acs5_2010 %>% select(geoid, population_2010, employed_2010), by = "geoid") %>% 
  mutate(
    state_fips = str_sub(geoid, 1, 2),
    vacancy_rate = vacant_housing / total_housing,
    pop_change_pct = if_else(population_2010 > 0, 
                             (population - population_2010) / population_2010 * 100, 
                             NA_real_),
    empl_change_pct = if_else(employed_2010 > 0, 
                             (employed - employed_2010) / employed_2010 * 100, 
                             NA_real_) 
  ) %>%
  left_join(state_fips, by = "state_fips") %>%
  filter(state != "PR") %>%
  inner_join(places_sf %>% select(geoid, geometry), by = "geoid") %>%
  st_as_sf()

write_csv(combined_city_data, "city_data.csv")


# PART II CLIMATE INDICATORS
#combined_city_data <- read_csv("city_data.csv") %>%
#  st_as_sf()
  

climate_ind <- read_csv("CVI-county-pct-comb-climate.csv") %>%
  clean_names() %>%
  rename(
    geoid_county = fips,
    health = climate_change_health,
    socioeconomic = climate_change_social_economic,
    extreme_events = climate_change_extreme_events
  ) %>%
  select(-row_number, -source, -tox_pi_score)

# SLR data
sea_level_data <- read_csv("CVI-county_data_pct.csv") %>%
  clean_names() %>%
  select(fips, sea_level_rise = `sea_level_rise`) %>%
  rename(geoid_county = fips)

heat_data <- read_csv("CVI-county_data_pct.csv") %>%
  clean_names() %>%
  select(fips, extreme_heat = `days_with_maximum_temperature_above_40c`) %>%
  rename(geoid_county = fips)


# Get county boundaries for spatial joining
counties_sf <- counties(cb = TRUE, year = 2023) %>%
  clean_names() %>%
  rename(geoid_county = geoid) %>%
  select(geoid_county, name_county = name, geometry)

# Step 1: Determine which county each place falls into
city_points <- combined_city_data %>%
  st_centroid()

# Spatial join to find which county each place is in
city_county_joined <- city_points %>%
  mutate(county_index = st_within(geometry, counties_sf, sparse = FALSE) %>% 
           max.col(ties.method = "first")) %>%
  bind_cols(counties_sf[.$county_index, c("geoid_county", "name_county")]) %>%
  st_drop_geometry() %>%
  select(geoid, geoid_county, name_county)


#weird issue with CT planning regions vs counties

ct_crosswalk_raw <- read_excel("ct_cou_to_cousub_crosswalk.xlsx")

ct_crosswalk <- ct_crosswalk_raw %>%
  select(
    county_fips = `OLD_COUNTYFP (INCITS31)`,
    planning_region_code = `NEW_COUNTYFP (INCITS31)`
  ) %>%
  # Format both codes properly
  mutate(
    # Add state code to planning region code (this matches your data)
    planning_region_code = paste0("09", planning_region_code),
    # Add state code to county FIPS (this matches climate data)
    county_fips = paste0("09", str_pad(county_fips, 3, pad = "0"))
  ) %>%
  # Keep only unique combinations
  distinct() %>%
  # For regions that map to multiple counties, take the first one
  group_by(planning_region_code) %>%
  slice(1) %>%
  ungroup()

city_county_joined_fixed <- city_county_joined %>%
  # For Connecticut records, replace planning region codes with county FIPS
  mutate(
    geoid_county = case_when(
      # If it's a Connecticut planning region code
      geoid_county %in% ct_crosswalk$planning_region_code ~ 
        # Look up the corresponding county FIPS code
        ct_crosswalk$county_fips[match(geoid_county, ct_crosswalk$planning_region_code)],
      # Otherwise keep the original geoid_county
      TRUE ~ geoid_county
    )
  )

# Step 2: Calculate centroid coordinates for each place
place_centroids <- combined_city_data %>%
  mutate(
    longitude = st_coordinates(st_centroid(geometry))[,1],
    latitude = st_coordinates(st_centroid(geometry))[,2]
  ) %>%
  st_drop_geometry() %>%
  select(geoid, longitude, latitude)

# Step 3: Join everything together
final_dataset <- combined_city_data %>%
  left_join(city_county_joined_fixed, by = "geoid") %>%
  left_join(place_centroids, by = "geoid") %>%
  left_join(climate_ind, by = "geoid_county") %>%
  left_join(sea_level_data, by = "geoid_county") %>%
  left_join(heat_data, by = "geoid_county") %>% 
  # Add SLR threshold indicators as in the original code
  mutate(
    slr_90pct = if_else(!is.na(sea_level_rise) & sea_level_rise >= 0.9, 1, 0),
    heat_95pct = if_else(!is.na(extreme_heat) & extreme_heat >= 0.95, 1, 0)
    #slr_75pct = if_else(!is.na(sea_level_rise) & sea_level_rise >= 0.75, 1, 0)
  )

# Save final dataset with geometry preserved
write_sf(final_dataset, "cities_with_climate_indicators.gpkg")

# Also save as CSV
write_csv(st_drop_geometry(final_dataset), "cities_with_climate_indicators.csv")

