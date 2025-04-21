library(dplyr)
library(tidyverse)

#city_df <-read_csv("final_city_risk_dataset.csv")
city_df <- final_dataset

median_events_val <- 0.4405997
median_health_val <- 0.5050763
median_socio_val <- 0.5484554

#50th pctile for extreme events: 0.4405997 (based on Tippecanoe County IN)
#50th pctile for socioeconomic: 0.5484554 (based on Vanderburgh County IN)
#50th pctile for health: 0.5050763 (based on Essex County MA)

events_weight <- 0.7418445831
health_weight <- 0.1829546068
socio_weight <- 0.07520081006

median_climate_val <- (median_events_val * median_events_val) + (median_socio_val * socio_weight) + (median_health_val * health_weight)

city_with_flags <- city_df %>%
  mutate(
    missing_growth_data = is.na(pop_change_pct),# & is.na(jobs_change_pct),
    #growing_val = 0.7 * pop_change_pct + 0.3 * jobs_change_pct,
    growing_val = pop_change_pct,
    growing_flag = growing_val > 0 | is.na(pop_change_pct),
    climate_val = events_weight * extreme_events + 
      socio_weight * socioeconomic + 
      health_weight * health,
    climate_flag = climate_val < .36 & slr_90pct == 0
  ) %>% 
  filter(missing_growth_data==FALSE)
#climate = TRUE means it is relatively safe, growing = TRUE means it is growing

#note: in order to make our models "true", median climate val needs to be > .41 and < .49

city_filtered <- city_with_flags %>%
  select(geoid, state_fips, state, name_county, name.x,
         population, median_income, median_home_value, median_age, vacancy_rate,
         geometry, longitude, latitude, climate_val, climate_flag, growing_val, growing_flag) %>%
  mutate(
    type = case_when(
      climate_flag & growing_flag  ~ "destination",
      climate_flag & !growing_flag ~ "opportunity",
      !climate_flag & growing_flag ~ "risk",
      TRUE                         ~ "origin"
    ),
    type_ind = case_when(
      climate_flag & growing_flag  ~ 1,
      climate_flag & !growing_flag ~ 2,
      !climate_flag & growing_flag ~ 3,
      TRUE                         ~ 4
    )
  )

write_csv(st_drop_geometry(city_filtered), "city_and_archetype.csv")

write_sf(city_filtered, "cities_and_archetype.gpkg")

