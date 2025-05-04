library(dplyr)
library(tidyverse)
library(st)
library(sf)
library(dplyr)
library(stringr)

setwd("/Users/clara/Documents/NYU/FA24/Capstone/Archetypes Map/data")


#city_df <-read_csv("final_city_risk_dataset.csv")

city_df <- final_dataset %>% filter(population > 50000) %>% st_drop_geometry()

median_events_val <- city_df %>%
  summarize(median = median(extreme_events, na.rm = TRUE)) %>%
  pull(median)

median_health_val <- city_df %>%
  summarize(median = median(health, na.rm = TRUE)) %>%
  pull(median)

median_socio_val <- city_df %>%
  summarize(median = median(socioeconomic, na.rm = TRUE)) %>%
  pull(median)

#determined by criteria weights comparison found here: 
#https://docs.google.com/spreadsheets/d/1-iX6BJ-1JkORKhpIBOfMpKW9jhe5roxHyiXt5ppyGQk/edit?usp=sharing
events_weight <- 0.539614550
health_weight <- 0.163424118
socio_weight <- 0.296961331

median_climate_val <- (median_events_val * events_weight) + (median_socio_val * socio_weight) + (median_health_val * health_weight)


#climate = TRUE means it is relatively safe, growing = TRUE means it is growing
city_with_flags <- city_df %>%
  mutate(
    growing_val = 0.7 * pop_change_pct + 0.3 * empl_change_pct,
    growing_flag = growing_val > 0 | is.na(pop_change_pct),
    climate_val = events_weight * extreme_events + 
      socio_weight * socioeconomic + 
      health_weight * health,
    climate_flag = climate_val < median_climate_val & slr_90pct == 0 & heat_95pct == 0
  ) 


city_archetypes <- city_with_flags %>%
  select(geoid, state_fips, state, name_county, name.x,
         population, median_income, median_home_value, median_age, vacancy_rate,
         longitude, latitude, climate_val, climate_flag, growing_val, growing_flag) %>%
  mutate(
    type = case_when(
      climate_flag & growing_flag  ~ "destination",
      climate_flag & !growing_flag ~ "opportunity",
      !climate_flag & growing_flag ~ "risk",
      TRUE                         ~ "origin"
    ),
    type_name = case_when(
      climate_flag & growing_flag  ~ "Destination City",
      climate_flag & !growing_flag ~ "Opportunity City",
      !climate_flag & growing_flag ~ "City at Risk",
      TRUE                         ~ "Origin City"
    )
  )

city_archetypes <- city_archetypes %>%
  mutate(
    clean_name = name.x %>%
      # Step 1: Remove state
      str_replace(",[^,]+$", "") %>%
      # Step 2: Remove things like " city", " CDP", etc. at the end
      str_remove("\\s+(city|CDP|village|town|municipality|borough|urban county|metro government|consolidated government|unified government|metropolitan government)$") %>%
      # Step 3: Remove anything in parentheses (e.g., "(balance)")
      str_remove("\\s*\\(.*?\\)") %>%
      # Step 4: Trim any leading/trailing whitespace
      str_trim()
  )

write_csv(st_drop_geometry(city_archetypes), "city_and_archetype.csv")

#write_sf(city_archetypes, "city_and_archetype.gpkg")

#modified df for screenshots for presentation
smaller_df <- city_archetypes %>% 
  select(population, name.x, growing_flag, climate_flag, type) 


smaller_df_summary <- smaller_df %>%
  group_by(type) %>%
  summarize(
    num_cities = n(),
    total_population = sum(population, na.rm = TRUE)
  )

smaller_df_summary
