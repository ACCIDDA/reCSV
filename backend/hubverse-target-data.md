Target (observed) data
================

## Definitions

_**Target data**_ are the _observed data. These may be used for modeling and for prediction target. These contain **time series** data[^truth], which are the _observed_ counts or rates partitioned for each unique combination of [task id values](#task-id-vars).

Hubverse tools like [hubVis](https://hubverse-org.github.io/hubVis) make use of
the time series data for visualizations.

[^truth]: Time series data is sometimes referred to as "ground truth" data, but
    we no longer use this term in the hubverse.


## Time series

The first format is *time series* data. This is often the native or
"raw" format for data. Each row of the data set is a **unit of observation**, and the columns consist of:

1. task ID variables that uniquely define the unit of observation. This must include at least one column representing the date of observation. The column should share the same name across target data and model outputs.
2. an `observation` column that records the observed value

Here is an example of this form of data, showing selected dates for
Massachusetts (FIPS code 25), drawn from the forecasting example in
`hubExamples`:

| target_end_date       | location | observation |
|:-----------|:---------|------------:|
| 2022-11-19 | 25       |          79 |
| 2022-11-26 | 25       |         221 |
| 2022-12-03 | 25       |         446 |
| 2022-12-10 | 25       |         578 |

Here, the unit of observation is a target_end_date and location pair. That is, for each target_end_date and location, there is a single observed value.
In settings where a hub is working with multiple observed targets at
each time point (e.g., cases, hospitalizations, and deaths), the values
of those targets will be part of the unit of observation, with a column such as
`target`, indicating what quantity is reported in each row.


| target_end_date | target | location | observation |
|:-----------|:-------|:---------|------------:|
| 2022-11-19 | cases  | 25       |          79 |
| 2022-11-26 | cases  | 25       |         221 |
| 2022-12-03 | cases  | 25       |         446 |
| 2022-12-10 | cases  | 25       |         578 |
| 2022-11-19 | deaths | 25       |           9 |
| 2022-11-26 | deaths | 25       |          21 |
| 2022-12-03 | deaths | 25       |          46 |
| 2022-12-10 | deaths | 25       |          78 |

All the above columns are mandatory!

### Optional `as_of` column to record data versions

Time series data are expected to be compiled from an authoritative upstream
data source after each target date.
Because of reporting delays, the data may initially be represented by one value that could be updated in one or more subsequent versions of the data.

**Data recorded on December 3 for December 3 shows an observation of 420:**

| *as\_of*     | target_end_date       | location | observation |
|:-------------|:-----------|:---------|------------:|
| *2022-12-03* | 2022-11-19 | 25       |          79 |
| *2022-12-03* | 2022-11-26 | 25       |         221 |
| *2022-12-03* | 2022-12-03 | 25       |         **420** |

**Data recorded on December 10 shows that the December 3 observation increased by 26 cases:**

| *as\_of*     | target_end_date       | location | observation |
|:-------------|:-----------|:---------|------------:|
| *2022-12-10* | 2022-11-19 | 25       |          79 |
| *2022-12-10* | 2022-11-26 | 25       |         221 |
| *2022-12-10* | 2022-12-03 | 25       |        **446** |
| *2022-12-10* | 2022-12-10 | 25       |         578 |


If the source data have this pattern of being subsequently updated,
the hubverse recommends recording the date target data were
reported in a column called `as_of`. This will then accurately represent what data were available at a given point in time, and will allow tools like our
[dashboards](dashboards.md) to automatically extract the data that were available for any given model round.

### Additional attributes

More attributes/features may be added along with the target if needed. For example, if we want to encode population of a location, it can be added in `target`, `location` and `observation`, ignoring other entries. User must explicitly approve before 

| target_end_date | target | location | observation |
|:-----------|:-------|:---------|------------:|
| 2022-11-19 | cases  | 25       |          79 |
| 2022-11-26 | cases  | 25       |         221 |
| 2022-12-03 | cases  | 25       |         446 |
| 2022-12-10 | cases  | 25       |         578 |
| 2022-11-19 | deaths | 25       |           9 |
| 2022-11-26 | deaths | 25       |          21 |
| 2022-12-03 | deaths | 25       |          46 |
| 2022-12-10 | deaths | 25       |          78 |
| | **population** | **25** | **3000000**|
